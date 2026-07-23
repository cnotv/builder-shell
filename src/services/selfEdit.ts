import { SHELL } from '../config'
import { extractJson } from './json'
import { GitHubClient } from './github'
import type { ProviderClient } from './providers'

export interface SelfEditStep {
  key: 'read' | 'generate' | 'commit' | 'ci'
  label: string
  url?: string
  status: 'active' | 'done' | 'error'
}
export type Report = (step: SelfEditStep) => void

const SYSTEM = [
  'You are editing "builder-shell", a Vue 3 + Vite + TypeScript single-page app.',
  'You are given its current source files. Apply the requested change.',
  'Respond with ONLY a JSON object, no markdown fences:',
  '{ "message": string (concise git commit message), "files": [ { "path": string, "content": string } ] }',
  'Include the FULL new content of every file you change. Include a file ONLY if it changed.',
  'Keep TypeScript valid and the build passing (vue-tsc + vite build). Do not remove existing features.',
  'Do not touch credentials, secrets, or .github/workflows unless explicitly asked.',
].join('\n')

/** Files to hand the model as context (and that it may modify). */
function wanted(path: string): boolean {
  return (
    path.startsWith('src/') ||
    ['package.json', 'index.html', 'vite.config.ts', 'env.d.ts', 'tsconfig.json'].includes(path)
  )
}

interface EditResult {
  message: string
  files: { path: string; content: string }[]
}

export function parseEdit(raw: string): EditResult {
  const json = extractJson(raw)
  if (!json || typeof json !== 'object') throw new Error('Model did not return a JSON object.')
  const files = (json as { files?: unknown }).files
  if (!Array.isArray(files) || files.length === 0) throw new Error('No file changes were returned.')
  for (const f of files) {
    if (typeof f?.path !== 'string' || typeof f?.content !== 'string') {
      throw new Error('Malformed file entry in the response.')
    }
    if (!wanted(f.path)) throw new Error(`Refusing to write outside allowed paths: ${f.path}`)
  }
  const message = typeof (json as { message?: unknown }).message === 'string'
    ? (json as { message: string }).message
    : ''
  return { message, files: files as EditResult['files'] }
}

function buildPrompt(sources: Record<string, string>, change: string): string {
  const parts = ['# Current source files', '']
  for (const [path, content] of Object.entries(sources)) {
    parts.push(`## ${path}`, '```', content, '```', '')
  }
  parts.push('# Requested change', change)
  return parts.join('\n')
}

/** Read the shell's own source, ask the model for changes, commit to main. */
export async function selfEdit(
  gh: GitHubClient,
  client: ProviderClient,
  model: string,
  change: string,
  report: Report,
): Promise<void> {
  const { owner, repo, branch } = SHELL
  const repoUrl = `https://github.com/${owner}/${repo}`

  report({ key: 'read', label: 'Reading source…', status: 'active' })
  const headSha = await gh.getRef(owner, repo, branch)
  const tree = await gh.getTree(owner, repo, headSha)
  const paths = tree.filter((t) => t.type === 'blob' && wanted(t.path)).map((t) => t.path)
  const sources: Record<string, string> = {}
  for (const p of paths) sources[p] = await gh.getFile(owner, repo, p)
  report({ key: 'read', label: `Read ${paths.length} source files`, url: repoUrl, status: 'done' })

  report({ key: 'generate', label: 'Generating changes…', status: 'active' })
  const raw = await client.completeText(buildPrompt(sources, change), SYSTEM, model)
  const result = parseEdit(raw)
  report({ key: 'generate', label: `Proposed changes to ${result.files.length} file(s)`, status: 'done' })

  report({ key: 'commit', label: 'Committing to main…', status: 'active' })
  const commit = await gh.commitFiles(
    owner,
    repo,
    branch,
    result.files,
    result.message || `self-edit: ${change.slice(0, 60)}`,
  )
  report({ key: 'commit', label: 'Committed to main', url: commit.html_url, status: 'done' })

  report({
    key: 'ci',
    label: 'CI is building, testing & deploying…',
    url: `${repoUrl}/actions`,
    status: 'done',
  })
}
