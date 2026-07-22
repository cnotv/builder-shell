import type { Plugin } from '../types/plugin'
import { parseManifest } from '../types/plugin'
import { GitHubClient } from './github'

/**
 * Discovers plugins by searching the user's repos for the plugin topic and
 * reading each repo's `plugin.json`. A repo with a missing/invalid manifest is
 * skipped, never fatal.
 */
export class Registry {
  constructor(
    private readonly gh: GitHubClient,
    private readonly login: string,
  ) {}

  async list(): Promise<Plugin[]> {
    const repos = await this.gh.searchPluginRepos(this.login)
    const results = await Promise.all(repos.map((repo) => this.load(repo)))
    return results.filter((p): p is Plugin => p !== null)
  }

  private async load(repo: string): Promise<Plugin | null> {
    try {
      const raw = await this.gh.getFile(this.login, repo, 'plugin.json')
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
}
