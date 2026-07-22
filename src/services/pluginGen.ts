import type { GeneratedPlugin, PluginManifest } from '../types/plugin'
import { parseManifest } from '../types/plugin'
import { extractJson } from './json'

/**
 * Provider-agnostic system prompt asking any chat model to produce a
 * self-contained single-file plugin as a JSON object.
 */
export const PLUGIN_SYSTEM = [
  'You generate self-contained single-file web plugins.',
  'Respond with ONLY a JSON object, no markdown fences, matching:',
  '{ "name": string, "description": string, "emoji": string (one emoji), "html": string }',
  'The "html" is a COMPLETE standalone HTML document with all CSS and JS inline.',
  'It must make NO external network requests and load NO external resources.',
  'It runs inside a sandboxed iframe (sandbox="allow-scripts", opaque origin):',
  'do not use localStorage, cookies, or top-level navigation.',
  '',
  'P2P Hub integration — ONLY when the plugin needs presence, shared state, or',
  'chat with other plugins. Talk to the parent "P2P Hub" via',
  'window.parent.postMessage(msg, "*"):',
  '  - {type:"p2p-subscribe"} to join the hub',
  '  - {type:"p2p-send", room, payload} to broadcast to a room',
  '  - {type:"p2p-set-data", data} to publish your shared state',
  'Listen with window.addEventListener("message", e => ...) for e.data.type:',
  '  - "p2p-users": the current peer list',
  '  - "p2p-message": an incoming {room, payload}',
  '  - "p2p-self": your own identity',
  'Ignore messages whose type you do not recognize.',
].join('\n')

/** Compose an update request that gives the model the current plugin as context. */
export function buildUpdatePrompt(
  current: PluginManifest,
  currentHtml: string,
  changes: string,
): string {
  return [
    'Here is an existing plugin. Apply the requested changes and return the FULL',
    'updated plugin as a JSON object with the same schema (name, description,',
    'emoji, html). Preserve existing behaviour unless a change requires otherwise.',
    '',
    'Current plugin.json:',
    JSON.stringify(current),
    '',
    'Current index.html:',
    currentHtml,
    '',
    'Requested changes:',
    changes,
  ].join('\n')
}

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
