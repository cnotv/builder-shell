import type { GeneratedPlugin } from '../types/plugin'
import { PLUGIN_SYSTEM, parseGenerated } from './pluginGen'

const API = 'https://api.anthropic.com/v1/messages'
const VERSION = '2023-06-01'

export class AnthropicError extends Error {}

interface MessageOpts {
  model: string
  system?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
}

function headers(apiKey: string): HeadersInit {
  return {
    'x-api-key': apiKey,
    'anthropic-version': VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
  }
}

/**
 * Direct-from-browser Anthropic client. The key is read lazily so it always
 * reflects the current connection value.
 */
export class AnthropicClient {
  constructor(private readonly getKey: () => string) {}

  /** One-shot completion, returns the concatenated text of the response. */
  async complete(opts: MessageOpts): Promise<string> {
    const res = await fetch(API, {
      method: 'POST',
      headers: headers(this.getKey()),
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 8000,
        system: opts.system,
        messages: opts.messages,
      }),
    })
    if (!res.ok) {
      throw new AnthropicError(`Anthropic ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as {
      stop_reason: string
      content: { type: string; text?: string }[]
    }
    if (data.stop_reason === 'refusal') {
      throw new AnthropicError('The request was declined by the model.')
    }
    return data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
  }

  /** Ask Claude to design a self-contained single-file plugin. */
  async generatePlugin(prompt: string, model: string): Promise<GeneratedPlugin> {
    const text = await this.complete({
      model,
      system: PLUGIN_SYSTEM,
      maxTokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    })
    return parseGenerated(text)
  }
}
