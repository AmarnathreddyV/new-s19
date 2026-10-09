import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const IXX_VOICE_SYSTEM_INSTRUCTION = `
You are IXX, an expert female skincare consultant for S.19 Skinlabs.

PERSONALITY & VOICE TONE:
- Warm, sweet, caring, witty, playful, confident, and natural.
- Indian conversational charm, like an honest skincare bestie.
- Use gentle humor without overdoing it.
- Never sound robotic or like a customer-support IVR.
- Speak clearly and naturally.
- Normal responses should be 1 or 2 short sentences, around 35 words maximum.
- Ask only one question at a time.
- Avoid long lectures unless the user asks for detail.

LANGUAGES & AUTOMATIC DETECTION:
- Language matching is mandatory for every reply.
- Detect the language of the user's latest message.
- Support English, Telugu, Roman Telugu, and Hindi.
- If the user speaks Telugu, reply in natural conversational Telugu using Telugu script.
- If the user writes Roman Telugu, understand the Telugu meaning and reply in Telugu script unless Roman Telugu is requested.
- If the user speaks Hindi, reply in natural conversational Hindi using Devanagari script.
- If the user speaks English, reply in natural Indian English.
- Switch languages immediately when the user switches languages.
- For mixed-language messages, respond in the dominant language.
- Generate the answer directly in the detected language.
- Never force English when the user is speaking Telugu or Hindi.
- Preserve the same warm, friendly female-consultant personality in every language.

CONSULTATION FLOW:
Start with a friendly greeting equivalent to:
"Hi, I'm IXX, your S.19 skin consultant. What's bothering you about your skin?"

Ask short questions one at a time:
1. Main skin concern.
2. How long the concern has been present.
3. Current skin phase or behavior.
4. Current skincare routine, when relevant.
5. Sensitivity or irritation.
6. Desired result.

STRICT TERMINOLOGY:
- NEVER ask for the user's "skin type".
- ALWAYS use "skin phase".
- Explain that skin can change over time rather than treating it as a permanent type.

OFFICIAL PRODUCTS AND PRICES:
1. HYDRATING CAPSULE CREAM — ₹1,300 (65g)
   Code: S19 / 01
   Best for dryness, tightness, parched skin, and dull texture.
   Actives: 5% 13D Hyaluronic Acid, 2% Hydroviton, 2% Pentavitin.

2. TXA + NIA CAPSULE CREAM — ₹1,300 (65g)
   Code: S19 / 02
   Best for uneven tone, post-acne marks, dark spots, and hyperpigmentation.
   Actives: 4% Tranexamic Acid, 2% Niacinamide, 2% Rose PDRN.

3. PDRN COLLAGEN CAPSULE CREAM — ₹1,650 (65g)
   Code: S19 / 03
   Best for skin recovery, firmness, and barrier replenishment.
   Actives: 3% Salmon PDRN, 2% Peptides, Cellular Collagen Matrix.

4. SEBUM CONTROL CAPSULE CREAM — ₹1,250 (65g)
   Code: S19 / 04
   Best for excess shine, oily areas, and sebum imbalance.
   Actives: 3% Encapsulated Salicylic Acid, 2% Tranexamic Acid, 0.5% Sebum Control Complex.

Recommend products based on the user's concern and the official product information.
Mention the exact price when recommending a product.

SAFETY:
- Provide general skincare guidance only.
- Never diagnose a medical condition or promise a cure.
- For severe burning, swelling, serious rash, or possible allergic reaction,
  advise stopping active products and seeking medical attention.
`;

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;

  if (!key) return null;

  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
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
  const key =
    process.env.OPENAI_API_KEY ||
    process.env.VITE_OPENAI_API_KEY;

  if (!key) return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: key });
  }

  return openaiClient;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    let body = req.body;

    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { transcript, phase, history } = body || {};
    const spokenText =
      typeof transcript === 'string' ? transcript.trim() : '';

    if (!spokenText) {
      return res.status(400).json({
        error: 'Transcript is required',
      });
    }

    const ai = getGenAI();

    if (ai) {
      try {
        const chatContents: Array<{
          role: 'user' | 'model';
          parts: Array<{ text: string }>;
        }> = [];

        if (Array.isArray(history)) {
          for (const item of history) {
            if (item.sender === 'user' && item.text) {
              chatContents.push({
                role: 'user',
                parts: [{ text: item.text }],
              });
            } else if (
              (item.sender === 'ixx' ||
                item.sender === 'assistant') &&
              item.text
            ) {
              chatContents.push({
                role: 'model',
                parts: [{ text: item.text }],
              });
            }
          }
        }

        chatContents.push({
          role: 'user',
          parts: [
            {
              text:
                `[CURRENT USER SKIN PHASE CONTEXT]: ${phase || 'General Consultation'}\n` +
                `User's exact spoken words: "${spokenText}"\n` +
                'Respond in the same language as the latest user message. ' +
                'Keep the response concise and natural.',
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

        const reply =
          response.text ||
          "I'm right here with you! What would you like to achieve with your skin?";

        // Return text only. Do not force Telugu and Hindi replies
        // through a fixed English-oriented OpenAI TTS voice.
        return res.status(200).json({
          reply,
          provider: 'gemini',
        });
      } catch (error: any) {
        console.warn(
          'Gemini voice consultation failed:',
          error.message
        );
      }
    }

    const openai = getOpenAI();

    if (openai) {
      try {
        const messages: Array<{
          role: 'system' | 'user' | 'assistant';
          content: string;
        }> = [
          {
            role: 'system',
            content: IXX_VOICE_SYSTEM_INSTRUCTION,
          },
        ];

        if (Array.isArray(history)) {
          for (const item of history) {
            if (item.sender === 'user' && item.text) {
              messages.push({
                role: 'user',
                content: item.text,
              });
            } else if (
              (item.sender === 'ixx' ||
                item.sender === 'assistant') &&
              item.text
            ) {
              messages.push({
                role: 'assistant',
                content: item.text,
              });
            }
          }
        }

        messages.push({
          role: 'user',
          content:
            `[CURRENT USER SKIN PHASE CONTEXT]: ${phase || 'General Consultation'}\n` +
            `User's exact spoken words: "${spokenText}"\n` +
            'Reply in the language of the latest user message.',
        });

        const completion =
          await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
          });

        const reply =
          completion.choices[0]?.message?.content;

        if (reply) {
          return res.status(200).json({
            reply,
            provider: 'openai',
          });
        }
      } catch (error: any) {
        console.warn(
          'OpenAI voice consultation failed:',
          error.message
        );
      }
    }

    return res.status(503).json({
      error: 'The AI consultation service is unavailable.',
    });
  } catch (error: any) {
    console.error('Voice consultation error:', error);

    return res.status(500).json({
      error: 'Unable to process the voice consultation.',
    });
  }
}
