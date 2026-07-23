import type { Plugin } from '../types/plugin'
import { parseManifest } from '../types/plugin'
import { GitHubClient } from './github'

/**
 * Discovers plugins by topic and reads each repo's `plugin.json`. A repo with
 * a missing/invalid manifest is skipped, never fatal.
 *
 * When `authed` is false (guest browse mode), manifests are read from the
 * public GitHub Pages URL instead of the authenticated Contents API.
 */
export class Registry {
  constructor(
    private readonly gh: GitHubClient,
    private readonly login: string,
    private readonly authed = true,
  ) {}

  async list(): Promise<Plugin[]> {
    const repos = await this.gh.searchPluginRepos(this.login)
    const results = await Promise.all(repos.map((repo) => this.load(repo)))
    return results.filter((p): p is Plugin => p !== null)
  }

  private async load(repo: string): Promise<Plugin | null> {
    try {
      const raw = this.authed
        ? await this.gh.getFile(this.login, repo, 'plugin.json')
        : await this.fetchPublic(repo, 'plugin.json')
      if (raw === null) return null
      const manifest = parseManifest(JSON.parse(raw))
      if (manifest === null) return null
      return {
        ...manifest,
        repo,
        url: `https://${this.login}.github.io/${repo}/${manifest.entry}`,
      }
    } catch (err) {
      console.warn(`Skipping plugin repo "${repo}":`, err)
      return null
    }
  }

  /** Read a file from the plugin's public Pages site (no auth needed). */
  private async fetchPublic(repo: string, path: string): Promise<string | null> {
    const res = await fetch(`https://${this.login}.github.io/${repo}/${path}`, { cache: 'no-store' })
    return res.ok ? res.text() : null
  }
}
