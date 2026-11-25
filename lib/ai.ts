// Shared LLM helpers. All providers are free tiers.
// Text: Groq (OpenAI-compatible). Vision: Mistral pixtral.
// Model names are env-overridable because providers retire models.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'

export const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-120b'
export const VISION_MODEL = process.env.MISTRAL_VISION_MODEL || 'pixtral-12b-latest'

/** Pull the first JSON object out of a model reply (handles ```json fences and stray prose). */
export function parseJSON<T = any>(text: string): T {
  const clean = (text || '').replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1))
    throw new Error('Model did not return JSON')
  }
}

async function post(url: string, key: string | undefined, body: any) {
  if (!key) throw new Error(`Missing API key for ${url}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LLM ${res.status}: ${detail.slice(0, 300)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content as string
}

/** Text prompt -> parsed JSON object, via Groq. */
export async function askJSON<T = any>(prompt: string, opts: { maxTokens?: number; temperature?: number } = {}): Promise<T> {
  const content = await post(GROQ_URL, process.env.GROQ_API_KEY, {
    model: TEXT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: opts.temperature ?? 0.2,
    // gpt-oss is a reasoning model: thinking tokens count against max_tokens, so leave headroom.
    max_tokens: (opts.maxTokens ?? 1000) + 1500,
    reasoning_effort: 'low',
    response_format: { type: 'json_object' },
  })
  return parseJSON<T>(content)
}

/** Image + prompt -> parsed JSON object, via Mistral vision. */
export async function askVisionJSON<T = any>(base64Image: string, mimeType: string, prompt: string): Promise<T> {
  const content = await post(MISTRAL_URL, process.env.MISTRAL_API_KEY, {
    model: VISION_MODEL,
    temperature: 0.1,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: `data:${mimeType};base64,${base64Image}` },
      ],
    }],
  })
  return parseJSON<T>(content)
}
