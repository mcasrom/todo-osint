import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export interface AIResult {
  text: string;
  provider: 'gemini' | 'groq' | 'fallback';
}

async function callGemini(model: string, prompt: string, system?: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const contents = system
    ? [{ role: 'user', parts: [{ text: `${system}\n\n${prompt}` }] }]
    : [{ role: 'user', parts: [{ text: prompt }] }];
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
}

async function callGroq(model: string, prompt: string, system?: string): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2048 }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Llama a la IA con Gemini como principal y Groq como fallback.
 * Si no hay ninguna API key configurada, devuelve null (el caller usa lógica local).
 */
export async function generateAI(prompt: string, opts: {
  model?: string;
  system?: string;
  fallbackModel?: string;
} = {}): Promise<AIResult | null> {
  const model = opts.model || 'gemini-2.5-flash';
  const fallbackModel = opts.fallbackModel || 'llama-3.3-70b-versatile';

  if (GEMINI_API_KEY) {
    try {
      const text = await callGemini(model, prompt, opts.system);
      if (text) return { text, provider: 'gemini' };
    } catch (e) {
      console.warn('[AI] Gemini failed, trying Groq:', (e as Error).message);
    }
  }
  if (GROQ_API_KEY) {
    try {
      const text = await callGroq(fallbackModel, prompt, opts.system);
      if (text) return { text, provider: 'groq' };
    } catch (e) {
      console.warn('[AI] Groq failed:', (e as Error).message);
    }
  }
  return null;
}

export function hasAnyAI(): boolean {
  return Boolean(GEMINI_API_KEY || GROQ_API_KEY);
}
