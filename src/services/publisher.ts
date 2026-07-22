import type { GeneratedPlugin } from '../types/plugin'
import { GitHubClient, PLUGIN_TOPIC } from './github'

/** One reported step of a publish/update, with a link to view it on GitHub. */
export interface PublishStep {
  key: 'repo' | 'commit' | 'pages' | 'deploy'
  label: string
  url?: string
  status: 'active' | 'done' | 'error'
}

export type Report = (step: PublishStep) => void

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Create a repo and deploy a generated plugin to GitHub Pages. */
export async function publishPlugin(
  gh: GitHubClient,
  login: string,
  repo: string,
  plugin: GeneratedPlugin,
  report: Report,
): Promise<string> {
  const repoUrl = `https://github.com/${login}/${repo}`
  const entry = plugin.manifest.entry
  const liveUrl = `https://${login}.github.io/${repo}/${entry}`

  report({ key: 'repo', label: 'Creating repository…', status: 'active' })
  await gh.createRepo(repo, plugin.manifest.description)
  report({ key: 'repo', label: 'Repository created', url: repoUrl, status: 'done' })

  report({ key: 'commit', label: 'Committing files…', status: 'active' })
  await withRetry(() => gh.putFile(login, repo, 'index.html', plugin.html, 'Add plugin'))
  await gh.putFile(login, repo, 'plugin.json', JSON.stringify({ ...plugin.manifest }, null, 2), 'Add manifest')
  report({ key: 'commit', label: 'Files committed', url: repoUrl, status: 'done' })

  report({ key: 'pages', label: 'Enabling GitHub Pages…', status: 'active' })
  await gh.addTopics(login, repo, [PLUGIN_TOPIC])
  await withRetry(() => gh.enablePages(login, repo))
  report({ key: 'pages', label: 'GitHub Pages enabled', url: `${repoUrl}/settings/pages`, status: 'done' })

  await deploy(gh, login, repo, repoUrl, liveUrl, report, false, plugin.html)
  return liveUrl
}

/** Commit updated files to an existing plugin repo and redeploy. */
export async function updatePlugin(
  gh: GitHubClient,
  login: string,
  repo: string,
  entry: string,
  plugin: GeneratedPlugin,
  report: Report,
): Promise<string> {
  const repoUrl = `https://github.com/${login}/${repo}`
  const liveUrl = `https://${login}.github.io/${repo}/${entry}`

  report({ key: 'commit', label: 'Committing changes…', status: 'active' })
  const current = await gh.getContent(login, repo, entry)
  await gh.putFile(login, repo, entry, plugin.html, 'Update plugin', current.sha)

  let manifestSha: string | undefined
  try {
    manifestSha = (await gh.getContent(login, repo, 'plugin.json')).sha
  } catch {
    // older plugins may predate the manifest
  }
  const manifest = { ...plugin.manifest, entry }
  await gh.putFile(login, repo, 'plugin.json', JSON.stringify(manifest, null, 2), 'Update manifest', manifestSha)
  await gh.addTopics(login, repo, [PLUGIN_TOPIC])
  report({ key: 'commit', label: 'Changes committed', url: repoUrl, status: 'done' })

  await deploy(gh, login, repo, repoUrl, liveUrl, report, true, plugin.html)
  return liveUrl
}

/** Report the deploy step while polling the Pages build to completion. */
async function deploy(
  gh: GitHubClient,
  login: string,
  repo: string,
  repoUrl: string,
  liveUrl: string,
  report: Report,
  requireRebuild: boolean,
  expectedHtml: string,
): Promise<void> {
  const deploymentsUrl = `${repoUrl}/deployments`
  report({ key: 'deploy', label: 'Deploying to GitHub Pages…', url: deploymentsUrl, status: 'active' })

  const built = await waitForPages(
    gh,
    login,
    repo,
    (status) =>
      report({ key: 'deploy', label: `Deploying to GitHub Pages… (${status})`, url: deploymentsUrl, status: 'active' }),
    requireRebuild,
  )

  if (!built) {
    report({ key: 'deploy', label: 'Deploy still building — reload in a moment', url: deploymentsUrl, status: 'done' })
    return
  }

  // Confirm the CDN edge is actually serving the new bytes before we call it
  // done — the Pages "built" status can flip before propagation completes.
  report({ key: 'deploy', label: 'Verifying live content…', url: liveUrl, status: 'active' })
  const live = await verifyLive(liveUrl, expectedHtml)
  report({
    key: 'deploy',
    label: live ? 'Deployed ✓ (live)' : 'Deployed — CDN still catching up, reload shortly',
    url: liveUrl,
    status: 'done',
  })
}

/**
 * Poll the live Pages URL (same origin as the shell on github.io) until it
 * serves exactly the bytes we just committed. Confirms propagation is done.
 */
async function verifyLive(liveUrl: string, expectedHtml: string, attempts = 12): Promise<boolean> {
  const want = expectedHtml.trim()
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${liveUrl}?_cb=${Date.now()}`, { cache: 'no-store' })
      if (res.ok && (await res.text()).trim() === want) return true
    } catch {
      // Cross-origin in local dev (no CORS on Pages) — degrade gracefully.
    }
    await sleep(3000)
  }
  return false
}

async function waitForPages(
  gh: GitHubClient,
  login: string,
  repo: string,
  onStatus: (status: string) => void,
  requireRebuild: boolean,
  timeoutMs = 120_000,
): Promise<boolean> {
  const start = Date.now()
  const deadline = start + timeoutMs
  let sawBuilding = false
  while (Date.now() < deadline) {
    try {
      const info = await gh.getPagesStatus(login, repo)
      const status = info.status
      if (status) onStatus(status)
      if (status === 'building') sawBuilding = true
      if (status === 'errored') return false
      // For updates, the site is already "built" from the previous deploy —
      // wait until we observe a fresh build cycle (or a grace period elapses).
      if (status === 'built' && (!requireRebuild || sawBuilding || Date.now() - start > 25_000)) {
        return true
      }
    } catch {
      // Pages metadata may 404 momentarily right after enabling.
    }
    await sleep(4000)
  }
  return false
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
