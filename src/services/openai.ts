import type { GeneratedPlugin } from '../types/plugin'
import { PLUGIN_SYSTEM, parseGenerated } from './pluginGen'

const API = 'https://api.openai.com/v1/chat/completions'

export class OpenAiError extends Error {}

/**
 * Direct-from-browser OpenAI Chat Completions client. The key is read lazily so
 * it always reflects the current connection value.
 *
 * NOTE: this path has not yet been exercised against a live OpenAI key.
 */
export class OpenAiClient {
  constructor(private readonly getKey: () => string) {}

  /** Raw completion for the self-edit flow. */
  async completeText(prompt: string, system: string, model: string, signal?: AbortSignal): Promise<string> {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getKey()}`,
        'content-type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!res.ok) throw new OpenAiError(`OpenAI ${res.status}: ${await res.text()}`)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content ?? ''
  }

  async generatePlugin(prompt: string, model: string, signal?: AbortSignal): Promise<GeneratedPlugin> {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getKey()}`,
        'content-type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model,
        // The system prompt already instructs JSON-only output; json_object
        // mode enforces valid JSON on models that support it.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PLUGIN_SYSTEM },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!res.ok) {
      throw new OpenAiError(`OpenAI ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const text = data.choices?.[0]?.message?.content ?? ''
    return parseGenerated(text)
  }
}
