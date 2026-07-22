import type { GeneratedPlugin } from '../types/plugin'
import { parseManifest } from '../types/plugin'
import { extractJson } from './json'

/**
 * Provider-agnostic system prompt asking any chat model to produce a
 * self-contained single-file plugin as a JSON object.
 */
export const PLUGIN_SYSTEM = [
  'You generate self-contained single-file web mini-apps ("plugins").',
  'Respond with ONLY a JSON object, no markdown fences, matching:',
  '{ "name": string, "description": string, "emoji": string (one emoji), "html": string }',
  'The "html" is a COMPLETE standalone HTML document with all CSS and JS inline.',
  'It must make NO external network requests and load NO external resources.',
  'It runs inside a sandboxed iframe (sandbox="allow-scripts", opaque origin):',
  'do not use localStorage, cookies, or top-level navigation.',
].join('\n')

/** Parse a model's raw text into a validated plugin, or throw if unusable. */
export function parseGenerated(text: string): GeneratedPlugin {
  const json = extractJson(text)
  if (json === null) throw new Error('Model did not return valid JSON.')
  const manifest = parseManifest(json)
  if (manifest === null) throw new Error('Generated plugin has no valid name.')
  const html = (json as { html?: unknown }).html
  if (typeof html !== 'string' || html.trim() === '') {
    throw new Error('Generated plugin has no HTML.')
  }
  return { manifest, html }
}
