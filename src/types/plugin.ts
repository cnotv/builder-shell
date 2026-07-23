/** The manifest committed to every plugin repo as `plugin.json`. */
export interface PluginManifest {
  name: string
  description: string
  emoji: string
  /** File the iframe loads, relative to the repo's Pages root. */
  entry: string
}

/** A plugin discovered in the registry, with its computed live URL. */
export interface Plugin extends PluginManifest {
  repo: string
  url: string
}

/** Result of asking Claude to generate a plugin. */
export interface GeneratedPlugin {
  manifest: PluginManifest
  html: string
  /** The model's raw response text, kept so the UI can display it. */
  raw?: string
}

const SLUG_RE = /[^a-z0-9]+/g

/** Derive a valid, lowercase, hyphenated repo name from a plugin name. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(SLUG_RE, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

/**
 * Validate and normalise an untrusted `plugin.json` payload.
 * Returns null when the payload is unusable (so the registry can skip it).
 */
export function parseManifest(raw: unknown): PluginManifest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.name !== 'string' || r.name.trim() === '') return null
  const entry = typeof r.entry === 'string' && r.entry.trim() !== '' ? r.entry : 'index.html'
  return {
    name: r.name,
    description: typeof r.description === 'string' ? r.description : '',
    emoji: typeof r.emoji === 'string' && r.emoji !== '' ? r.emoji : '🧩',
    entry,
  }
}
