import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

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
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!key) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return aiClient;
}

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!key) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // use as is
      }
    }

    const { transcript, phase, history } = body || {};
    const spokenText = transcript || '';

    // 1. Try Gemini
    const ai = getGenAI();
    if (ai && spokenText) {
      try {
        const chatContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

        if (Array.isArray(history)) {
          for (const item of history) {
            if (item.sender === 'user' && item.text) {
              chatContents.push({ role: 'user', parts: [{ text: item.text }] });
            } else if ((item.sender === 'ixx' || item.sender === 'assistant') && item.text) {
              chatContents.push({ role: 'model', parts: [{ text: item.text }] });
            }
          }
        }

        chatContents.push({
          role: 'user',
          parts: [
            {
              text: `[CURRENT USER SKIN PHASE CONTEXT]: ${phase || 'General Consultation'}\nUser spoken words: "${spokenText}"`,
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

        const replyText =
          response.text || "I'm right here with you! What would you like to achieve with your skin?";

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

        return res.status(200).json({
          reply: replyText,
          audio: base64Audio,
          provider: 'gemini',
        });
      } catch (geminiErr: any) {
        console.warn('Gemini voice consult failed, attempting OpenAI:', geminiErr.message);
      }
    }

    // 2. Try OpenAI
    const openai = getOpenAI();
    if (openai && spokenText) {
      try {
        const openAiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: IXX_VOICE_SYSTEM_INSTRUCTION },
        ];

        if (Array.isArray(history)) {
          for (const item of history) {
            if (item.sender === 'user' && item.text) {
              openAiMessages.push({ role: 'user', content: item.text });
            } else if ((item.sender === 'ixx' || item.sender === 'assistant') && item.text) {
              openAiMessages.push({ role: 'assistant', content: item.text });
            }
          }
        }

        openAiMessages.push({
          role: 'user',
          content: `[CURRENT USER SKIN PHASE CONTEXT]: ${phase || 'General Consultation'}\nUser spoken words: "${spokenText}"`,
        });

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: openAiMessages,
          temperature: 0.7,
        });

        const gptReply = completion.choices[0]?.message?.content;
        if (gptReply) {
          return res.status(200).json({ reply: gptReply, provider: 'openai' });
        }
      } catch (openAiErr: any) {
        console.warn('OpenAI voice consult failed:', openAiErr.message);
      }
    }

    // 3. Clinical Fallback Persona for IXX
    const lower = (spokenText || '').toLowerCase();
    let reply = "Hi, I'm IXX, your S.19 skincare consultant! What's bothering you about your skin today?";

    if (lower.includes('oil') || lower.includes('greas') || lower.includes('shine') || lower.includes('sebum')) {
      reply = "For excess shine and oily zones, I recommend our Sebum Control Capsule Cream (₹1,250) with encapsulated salicylic acid to keep your skin fresh!";
    } else if (lower.includes('dry') || lower.includes('flak') || lower.includes('tight') || lower.includes('hydrate')) {
      reply = "Sounds like your skin needs a big drink of water! Our Hydrating Capsule Cream (₹1,300) with 13D Hyaluronic Acid will plump it right up.";
    } else if (lower.includes('dark spot') || lower.includes('mark') || lower.includes('uneven') || lower.includes('pigment')) {
      reply = "To fade stubborn marks and brighten your tone, our TXA + NIA Capsule Cream (₹1,300) with tranexamic acid and niacinamide works wonders!";
    } else if (lower.includes('burn') || lower.includes('irritat') || lower.includes('sensitiv') || lower.includes('red')) {
      reply = "Oh no, let's calm that down immediately! Please pause all active treatments and focus on gentle barrier recovery.";
    } else if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
      reply = "Hey there! I'm IXX from S.19 Skinlabs. Tell me, how is your skin feeling today?";
    } else if (spokenText) {
      reply = "Got you! Let's get that glow on. Tell me, what's your main skin goal right now?";
    }

    return res.status(200).json({ reply, provider: 'knowledge_base' });
  } catch (err: any) {
    console.error('Voice consult error on Vercel:', err);
    return res.status(200).json({
      reply: "Hi! I'm IXX, your S.19 skincare bestie. What would you like to achieve with your skin today?",
      provider: 'fallback',
    });
  }
}
