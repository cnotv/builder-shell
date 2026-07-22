import type { GeneratedPlugin } from '../types/plugin'
import { parseManifest } from '../types/plugin'

const API = 'https://api.anthropic.com/v1/messages'
const VERSION = '2023-06-01'

export const MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
] as const

export type ModelId = (typeof MODELS)[number]['id']

export class AnthropicError extends Error {}

interface MessageOpts {
  model: ModelId
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
 * reflects the current auth-store value.
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

  /** Streaming completion for the freeform chat; invokes `onDelta` per text chunk. */
  async stream(opts: MessageOpts, onDelta: (text: string) => void): Promise<string> {
    const res = await fetch(API, {
      method: 'POST',
      headers: headers(this.getKey()),
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 4000,
        system: opts.system,
        messages: opts.messages,
        stream: true,
      }),
    })
    if (!res.ok || !res.body) {
      throw new AnthropicError(`Anthropic ${res.status}: ${await res.text()}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '' || payload === '[DONE]') continue
        const evt = JSON.parse(payload) as {
          type: string
          delta?: { type: string; text?: string }
        }
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          const text = evt.delta.text ?? ''
          full += text
          onDelta(text)
        }
      }
    }
    return full
  }

  /**
   * Ask Claude to design a self-contained single-file plugin.
   * Returns the parsed manifest + HTML, or throws if the output is unusable.
   */
  async generatePlugin(prompt: string, model: ModelId): Promise<GeneratedPlugin> {
    const system = [
      'You generate self-contained single-file web mini-apps ("plugins").',
      'Respond with ONLY a JSON object, no markdown fences, matching:',
      '{ "name": string, "description": string, "emoji": string (one emoji), "html": string }',
      'The "html" is a COMPLETE standalone HTML document with all CSS and JS inline.',
      'It must make NO external network requests and load NO external resources.',
      'It runs inside a sandboxed iframe (sandbox="allow-scripts", opaque origin):',
      'do not use localStorage, cookies, or top-level navigation.',
    ].join('\n')

    const text = await this.complete({
      model,
      system,
      maxTokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    })

    const json = extractJson(text)
    if (json === null) throw new AnthropicError('Model did not return valid JSON.')
    const manifest = parseManifest(json)
    if (manifest === null) throw new AnthropicError('Generated plugin has no valid name.')
    const html = (json as { html?: unknown }).html
    if (typeof html !== 'string' || html.trim() === '') {
      throw new AnthropicError('Generated plugin has no HTML.')
    }
    return { manifest, html }
  }
}

/** Pull the first balanced JSON object out of a model response. */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}
