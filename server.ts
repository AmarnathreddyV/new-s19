import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// S.19 Approved Knowledge Base & Persona for IXX Consultant
const IXX_VOICE_SYSTEM_INSTRUCTION = `
You are IXX, an expert female skincare consultant for S.19 Skinlabs.

PERSONALITY & VOICE TONE:
- Super warm, sweet, caring, witty, playfully humorous, confident, and natural.
- Indian conversational charm (friendly like an honest, knowledgeable skincare bestie).
- Add gentle, lighthearted humor (e.g., "Don't worry, your skin's just being a little dramatic today!", "Let's get that glow on before your mirror gets jealous!").
- Do NOT sound robotic.
- Do NOT sound like a customer-support IVR.
- Speak relatively quickly but clearly.
- Normal responses:
  * 1 or 2 short sentences.
  * Maximum approximately 35 words.
  * Ask only one question at a time during assessment.
- Do NOT give long lectures unless the user explicitly requests more details.

LANGUAGES & AUTOMATIC DETECTION:
- Automatically detect the language the user speaks.
- Supported primary languages: English, Hindi, and Telugu.
- If the user speaks Telugu: Respond predominantly in natural conversational Telugu with sweet friendly tone. Occasional English skincare terms are okay. Do NOT use overly formal Telugu.
- If the user speaks Hindi: Respond predominantly in natural conversational Hindi with friendly warmth and wit. Occasional English skincare terms are okay. Do NOT use overly formal Hindi.
- If the user speaks English: Use natural Indian English.
- Naturally switch language whenever the user switches language.

CONSULTATION FLOW:
Start with: "Hi, I'm IXX, your S.19 skin consultant. What's bothering you about your skin?"
Then ask short questions one at a time:
1. Main skin concern
2. How long they have had it
3. Current skin phase or behavior (CRITICAL: NEVER say "skin type". S.19 teaches that skin is not a static type; it is an evolving phase. Always use "skin phase")
4. Current skincare routine if relevant
5. Sensitivity / irritation
6. What result they want

Once enough information is collected, recommend the exact S.19 capsule cream (Hydrating, TXA + NIA, PDRN Collagen, or Sebum Control) and mention its price cheerfully so the visual card pops up on screen!

STRICT TERMINOLOGY RULE:
- NEVER use the word "skin type" or ask the user for their "skin type".
- ALWAYS use the term "skin phase" (e.g., "current skin phase", "present skin phase", "skin's evolving phase").

OFFICIAL S.19 PRODUCTS & EXACT PRICES:
1. HYDRATING CAPSULE CREAM — ₹1,300 (65g)
   - Code: S19 / 01 | Tagline: "For Extra Hydration Boost"
   - Best for: Dryness, tightness, parched skin, dull texture.
   - Actives: 5% 13D Hyaluronic Acid, 2% Hydroviton, 2% Pentavitin.

2. TXA + NIA CAPSULE CREAM — ₹1,300 (65g)
   - Code: S19 / 02 | Tagline: "Your tone. More in tune."
   - Best for: Uneven skin tone, post-acne marks, dark spots, hyperpigmentation.
   - Actives: 4% Tranexamic Acid, 2% Niacinamide, 2% Rose PDRN.

3. PDRN COLLAGEN CAPSULE CREAM — ₹1,650 (65g)
   - Code: S19 / 03 | Tagline: "A little care. A new phase."
   - Best for: Skin recovery, stress & damage, firmness, cellular barrier replenishment.
   - Actives: 3% Salmon PDRN, 2% Peptides, Cellular Collagen Matrix.

4. SEBUM CONTROL CAPSULE CREAM — ₹1,250 (65g)
   - Code: S19 / 04 | Tagline: "Find your own balance."
   - Best for: Oily skin, midday shine, enlarged clogged pores, sebum imbalance.
   - Actives: 3% Encapsulated Salicylic Acid, 2% Tranexamic Acid, 0.5% Sebum Control Complex.

SAFETY RULES:
- Provide general skincare guidance only.
- Never diagnose medical conditions or claim to cure diseases.
- If the user reports severe burning, severe swelling, serious rash, allergic reaction, or emergency symptoms: recommend stopping all active products and seeing a dermatologist immediately.
`;

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    brand: 'S.19 SKINLABS',
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Fast streaming voice consultation endpoint for zero-delay speech responses
app.post('/api/voice-consult-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { transcript, phase, history } = req.body;
    const ai = getGenAI();

    if (!ai) {
      res.write(`data: ${JSON.stringify({ chunk: "Hi, I'm IXX, your S.19 skin consultant! What's bothering you about your skin today?", done: true })}\n\n`);
      return res.end();
    }

    const chatContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history)) {
      for (const item of history) {
        if (item.sender === 'user' && item.text) {
          chatContents.push({ role: 'user', parts: [{ text: item.text }] });
        } else if (item.sender === 'ixx' && item.text) {
          chatContents.push({ role: 'model', parts: [{ text: item.text }] });
        }
      }
    }

    chatContents.push({
      role: 'user',
      parts: [
        {
          text: `[CURRENT USER SKIN PHASE CONTEXT]: ${phase || 'General Consultation'}\nUser question: "${transcript}"\nInstruction: Answer directly, warmly, and concisely in 1 or 2 short sentences (max 30 words) so voice playback begins immediately!`,
        },
      ],
    });

    let stream: any = null;
    try {
      stream = await ai.models.generateContentStream({
        model: 'gemini-3.1-flash-lite',
        contents: chatContents,
        config: {
          systemInstruction: IXX_VOICE_SYSTEM_INSTRUCTION,
          temperature: 0.65,
        },
      });
    } catch {
      stream = await ai.models.generateContentStream({
        model: 'gemini-3.8-flash',
        contents: chatContents,
        config: {
          systemInstruction: IXX_VOICE_SYSTEM_INSTRUCTION,
          temperature: 0.65,
        },
      });
    }

    let fullReply = '';
    for await (const chunk of stream) {
      const chunkText = chunk.text || '';
      if (chunkText) {
        fullReply += chunkText;
        res.write(`data: ${JSON.stringify({ chunk: chunkText, done: false })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ fullText: fullReply, done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('Streaming voice consult error:', err);
    res.write(`data: ${JSON.stringify({ chunk: "I'm right here with you! Tell me what's bothering your skin.", done: true })}\n\n`);
    res.end();
  }
});

// HTTP voice consultation fallback endpoint (works reliably across all iframe / proxy environments)
app.post('/api/voice-consult', async (req, res) => {
  try {
    const { transcript, phase, history, withTts } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.json({
        reply: "Hi, I'm IXX, your S.19 skin consultant. What's bothering you about your skin?",
      });
    }

    const chatContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history)) {
      for (const item of history) {
        if (item.sender === 'user' && item.text) {
          chatContents.push({ role: 'user', parts: [{ text: item.text }] });
        } else if (item.sender === 'ixx' && item.text) {
          chatContents.push({ role: 'model', parts: [{ text: item.text }] });
        }
      }
    }

    chatContents.push({
      role: 'user',
      parts: [
        {
          text: `[CURRENT USER SKIN PHASE CONTEXT]: ${phase || 'General Consultation'}\nUser spoken words: "${transcript}"\nInstruction: Answer warmly in 1 or 2 crisp sentences (under 30 words) for instant vocal response.`,
        },
      ],
    });

    let response: any = null;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: chatContents,
        config: {
          systemInstruction: IXX_VOICE_SYSTEM_INSTRUCTION,
          temperature: 0.65,
        },
      });
    } catch {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: chatContents,
        config: {
          systemInstruction: IXX_VOICE_SYSTEM_INSTRUCTION,
          temperature: 0.65,
        },
      });
    }

    const replyText = response.text || "I'm right here with you. What would you like to achieve with your skin?";

    let base64Audio = '';
    const openai = getOpenAI();
    if (openai) {
      try {
        const mp3 = await openai.audio.speech.create({
          model: 'tts-1',
          voice: 'nova',
          input: replyText,
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        base64Audio = buffer.toString('base64');
      } catch (ttsErr: any) {
        console.warn('OpenAI TTS audio generation warning:', ttsErr.message);
      }
    }

    res.json({
      reply: replyText,
      audio: base64Audio,
    });
  } catch (err: any) {
    console.error('Voice consult error:', err);
    res.json({
      reply: "Got you! Let's work on getting your skin balanced. What's your main concern right now?",
    });
  }
});

// Chat endpoint (Fallback & Text mode)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, phase, product, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const userContext = `
[CURRENT USER CONTEXT]
- Identified Skin Phase: ${phase || 'Unknown'}
- Recommended Product: ${product || 'Care-first barrier pause'}
`;

    const ai = getGenAI();
    if (!ai) {
      const p = (product || '').toLowerCase();
      let replyText = "Hi, I'm IXX, your S.19 skin consultant. What's bothering you about your skin?";
      if (p.includes('sebum') || (phase || '').toLowerCase().includes('oil')) {
        replyText = "For oil imbalance, S.19 recommends Sebum Control Capsule Cream with encapsulated salicylic acid and tranexamic acid to balance shine.";
      } else if (p.includes('txa') || (phase || '').toLowerCase().includes('tone')) {
        replyText = "For uneven tone, S.19 recommends TXA + NIA Capsule Cream with 4% tranexamic acid and niacinamide for marks.";
      } else if ((phase || '').toLowerCase().includes('recovery')) {
        replyText = "With irritation or sensitivity, S.19 pauses all active treatments to let your skin barrier rest comfortably.";
      }
      return res.json({ reply: replyText });
    }

    const chatContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history)) {
      for (const item of history) {
        if (item.sender === 'user' && item.text) {
          chatContents.push({ role: 'user', parts: [{ text: item.text }] });
        } else if (item.sender === 'assistant' && item.text) {
          chatContents.push({ role: 'model', parts: [{ text: item.text }] });
        }
      }
    }

    chatContents.push({
      role: 'user',
      parts: [
        {
          text: `${userContext}\nUser said: ${message}`,
        },
      ],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: chatContents,
      config: {
        systemInstruction: IXX_VOICE_SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    res.json({ reply: response.text || '' });
  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    res.json({
      reply: "Hi, I'm IXX! Let's get your skin balanced. What's your main concern right now?",
    });
  }
});

// WebSocket Server for Gemini Live Voice Stream
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  const pathname = url.split('?')[0];
  if (pathname === '/api/live-ixx' || pathname.endsWith('/api/live-ixx')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('Client connected to IXX Live Voice session');
  const ai = getGenAI();

  if (!ai) {
    clientWs.send(
      JSON.stringify({
        type: 'error',
        message: 'GEMINI_API_KEY is not configured on the server. Please verify your environment.',
      })
    );
    clientWs.close();
    return;
  }

  let session: any = null;
  let isClosing = false;

  try {
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Aoede' },
          },
        },
        systemInstruction: IXX_VOICE_SYSTEM_INSTRUCTION,
      },
      callbacks: {
        onopen: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'ready' }));
          }
        },
        onmessage: (message: LiveServerMessage) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;

          const parts = message.serverContent?.modelTurn?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    audio: part.inlineData.data,
                  })
                );
              }
              if (part.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'transcript',
                    sender: 'ixx',
                    text: part.text,
                  })
                );
              }
            }
          }

          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }

          if (message.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: 'state', state: 'listening' }));
          }
        },
        onerror: (err: any) => {
          console.error('Gemini Live session error:', err);
          if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                message: 'Unable to connect to IXX right now. Please try again.',
              })
            );
          }
        },
        onclose: () => {
          console.log('Gemini Live session closed');
        },
      },
    });

    clientWs.send(JSON.stringify({ type: 'ready' }));
  } catch (err: any) {
    console.error('Failed to establish Gemini Live connection:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: 'Unable to connect to IXX right now. Please try again.',
        })
      );
    }
    return;
  }

  clientWs.on('message', (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());

      if (data.type === 'init' && session) {
        if (data.phaseContext) {
          session.sendRealtimeInput({
            text: `[SYSTEM CONTEXT]: ${data.phaseContext}`,
          });
        }
      } else if (data.type === 'audio' && data.audio && session) {
        session.sendRealtimeInput({
          audio: {
            data: data.audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } else if (data.type === 'user_turn_complete' && session) {
        clientWs.send(JSON.stringify({ type: 'state', state: 'thinking' }));
      } else if (data.type === 'text' && data.text && session) {
        session.sendRealtimeInput({
          text: data.text,
        });
        clientWs.send(JSON.stringify({ type: 'state', state: 'thinking' }));
      }
    } catch (e) {
      console.error('Error parsing client WS message:', e);
    }
  });

  clientWs.on('close', () => {
    isClosing = true;
    if (session && typeof session.close === 'function') {
      try {
        session.close();
      } catch {
        // ignore
      }
    }
  });
});

// Start server with Vite middleware in dev or static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`S.19 SKINLABS server with Gemini Live running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
