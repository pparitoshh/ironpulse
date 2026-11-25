// LLM router. Providers, models and fallback order come from config/llm.yaml —
// change models there, not here. Keys come from env vars named in that file.
import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

type Provider = { base_url: string; key_env: string }
type Step = {
  provider: string
  model: string
  max_tokens?: number
  timeout_s?: number
  json_mode?: boolean
  reasoning_effort?: string
  temperature?: number
}
type LLMConfig = { providers: Record<string, Provider>; tasks: Record<string, Step[]> }

export type Task =
  | 'workout_plan' | 'estimate_macros' | 'progressive_overload'
  | 'food_photo' | 'cardio_photo' | 'machine_photo'

let cached: LLMConfig | null = null
export function llmConfig(): LLMConfig {
  if (!cached) {
    const file = path.join(process.cwd(), 'config', 'llm.yaml')
    cached = YAML.parse(fs.readFileSync(file, 'utf8')) as LLMConfig
  }
  return cached
}

/** Pull the first JSON object out of a model reply (handles ```json fences, prose, <think> blocks). */
export function parseJSON<T = any>(text: string): T {
  const clean = (text || '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```json|```/g, '')
    .trim()
  try {
    return JSON.parse(clean)
  } catch {
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1))
    throw new Error('Model did not return JSON')
  }
}

async function callStep(step: Step, content: any): Promise<string> {
  const provider = llmConfig().providers[step.provider]
  if (!provider) throw new Error(`Unknown provider "${step.provider}" in llm.yaml`)
  const key = process.env[provider.key_env]
  if (!key) throw new Error(`Env var ${provider.key_env} is not set`)

  const body: Record<string, any> = {
    model: step.model,
    messages: [{ role: 'user', content }],
    max_tokens: step.max_tokens ?? 2000,
    temperature: step.temperature ?? 0.2,
  }
  if (step.json_mode) body.response_format = { type: 'json_object' }
  if (step.reasoning_effort) body.reasoning_effort = step.reasoning_effort

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), (step.timeout_s ?? 30) * 1000)
  try {
    const res = await fetch(`${provider.base_url}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new Error('empty reply')
    return text
  } finally {
    clearTimeout(timer)
  }
}

/** Run a task through its fallback chain; returns parsed JSON from the first model that succeeds. */
async function runTask<T>(task: Task, content: any): Promise<T> {
  const steps = llmConfig().tasks[task]
  if (!steps?.length) throw new Error(`No models configured for task "${task}" in llm.yaml`)
  const errors: string[] = []
  for (const step of steps) {
    try {
      return parseJSON<T>(await callStep(step, content))
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'timeout' : e?.message
      errors.push(`${step.provider}/${step.model}: ${msg}`)
      console.warn(`[llm] ${task} failed on ${step.provider}/${step.model}: ${msg}`)
    }
  }
  throw new Error(`All models failed for ${task}: ${errors.join(' | ')}`)
}

/** Text prompt -> JSON. */
export function askJSON<T = any>(task: Task, prompt: string): Promise<T> {
  return runTask<T>(task, prompt)
}

/** Image + prompt -> JSON. */
export function askVisionJSON<T = any>(task: Task, base64Image: string, mimeType: string, prompt: string): Promise<T> {
  return runTask<T>(task, [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
  ])
}
