import type { GeneratedPlugin } from '../types/plugin'
import { GitHubClient, PLUGIN_TOPIC } from './github'

export type PublishStage =
  | 'creating-repo'
  | 'committing'
  | 'tagging'
  | 'enabling-pages'
  | 'building'
  | 'done'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Turn a generated plugin into a live GitHub Pages site.
 * Reports progress via `onStage`; returns the plugin's live URL.
 */
export async function publishPlugin(
  gh: GitHubClient,
  login: string,
  repo: string,
  plugin: GeneratedPlugin,
  onStage: (stage: PublishStage) => void,
): Promise<string> {
  onStage('creating-repo')
  await gh.createRepo(repo, plugin.manifest.description)

  // Newly-created repos can lag before the Contents API accepts writes.
  onStage('committing')
  await withRetry(() =>
    gh.putFile(login, repo, 'index.html', plugin.html, 'Add plugin'),
  )
  await gh.putFile(
    login,
    repo,
    'plugin.json',
    JSON.stringify({ ...plugin.manifest }, null, 2),
    'Add manifest',
  )

  onStage('tagging')
  await gh.addTopics(login, repo, [PLUGIN_TOPIC])

  onStage('enabling-pages')
  await withRetry(() => gh.enablePages(login, repo))

  onStage('building')
  await waitForPages(gh, login, repo)

  onStage('done')
  return `https://${login}.github.io/${repo}/${plugin.manifest.entry}`
}

/**
 * Commit updated files to an existing plugin repo (in place). Requires each
 * file's current `sha`, which the Contents API needs to overwrite it.
 */
export async function updatePlugin(
  gh: GitHubClient,
  login: string,
  repo: string,
  entry: string,
  plugin: GeneratedPlugin,
  onStage: (stage: PublishStage) => void,
): Promise<string> {
  onStage('committing')
  const current = await gh.getContent(login, repo, entry)
  await gh.putFile(login, repo, entry, plugin.html, 'Update plugin', current.sha)

  let manifestSha: string | undefined
  try {
    manifestSha = (await gh.getContent(login, repo, 'plugin.json')).sha
  } catch {
    // Older plugins may predate the manifest; create it.
  }
  const manifest = { ...plugin.manifest, entry } // keep the existing entry path
  await gh.putFile(
    login,
    repo,
    'plugin.json',
    JSON.stringify(manifest, null, 2),
    'Update manifest',
    manifestSha,
  )

  onStage('tagging')
  await gh.addTopics(login, repo, [PLUGIN_TOPIC]) // migrate to the current topic

  onStage('done')
  return `https://${login}.github.io/${repo}/${entry}`
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      await sleep(1500 * (i + 1))
    }
  }
  throw lastErr
}

async function waitForPages(
  gh: GitHubClient,
  login: string,
  repo: string,
  timeoutMs = 120_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const info = await gh.getPagesStatus(login, repo)
      if (info.status === 'built') return
      if (info.status === 'errored') throw new Error('GitHub Pages build failed.')
    } catch {
      /* Pages metadata may 404 momentarily right after enabling. */
    }
    await sleep(4000)
  }
  // Not fatal: Pages often finishes building shortly after we stop polling.
}
