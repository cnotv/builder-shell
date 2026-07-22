const API = 'https://api.github.com'
export const PLUGIN_TOPIC = 'cnotv-builder-plugin'
/** Topics from earlier versions, still discovered for backward compatibility. */
export const LEGACY_TOPICS = ['claude-plugin']

export interface GitHubUser {
  login: string
  avatar_url: string
}

export interface PagesInfo {
  html_url: string
  status: 'built' | 'building' | 'errored' | null
}

/** UTF-8 safe base64 encoding for file contents sent to the Contents API. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly rateLimited = false,
  ) {
    super(message)
    this.name = 'GitHubError'
  }
}

/**
 * Thin wrapper over the GitHub REST API. Reads the PAT lazily via `getToken`
 * so it always uses the latest value from the auth store.
 */
export class GitHubClient {
  constructor(private readonly getToken: () => string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
    if (!res.ok) {
      const rateLimited =
        res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0'
      const body = await res.text()
      let message = `GitHub ${res.status}`
      try {
        message = (JSON.parse(body) as { message?: string }).message ?? message
      } catch {
        /* non-JSON error body */
      }
      throw new GitHubError(message, res.status, rateLimited)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  getUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>('/user')
  }

  createRepo(name: string, description: string): Promise<{ name: string }> {
    return this.request('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        private: false,
        auto_init: true,
      }),
    })
  }

  /** Create or (with `sha`) update a file via the Contents API. */
  async putFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: toBase64(content),
        ...(sha ? { sha } : {}),
      }),
    })
  }

  /** Read a file plus its blob `sha` (needed to update it later). */
  async getContent(
    owner: string,
    repo: string,
    path: string,
  ): Promise<{ text: string; sha: string }> {
    const res = await this.request<{ content: string; sha: string }>(
      `/repos/${owner}/${repo}/contents/${path}`,
    )
    return { text: fromBase64(res.content), sha: res.sha }
  }

  getFile(owner: string, repo: string, path: string): Promise<string> {
    return this.getContent(owner, repo, path).then((r) => r.text)
  }

  addTopics(owner: string, repo: string, topics: string[]): Promise<void> {
    return this.request(`/repos/${owner}/${repo}/topics`, {
      method: 'PUT',
      body: JSON.stringify({ names: topics }),
    })
  }

  enablePages(owner: string, repo: string): Promise<void> {
    return this.request(`/repos/${owner}/${repo}/pages`, {
      method: 'POST',
      body: JSON.stringify({ source: { branch: 'main', path: '/' } }),
    })
  }

  getPagesStatus(owner: string, repo: string): Promise<PagesInfo> {
    return this.request<PagesInfo>(`/repos/${owner}/${repo}/pages`)
  }

  private async searchByTopic(login: string, topic: string): Promise<string[]> {
    const q = encodeURIComponent(`user:${login} topic:${topic}`)
    const res = await this.request<{ items: { name: string }[] }>(
      `/search/repositories?q=${q}`,
    )
    return res.items.map((i) => i.name)
  }

  /** Discover plugin repos under the current + legacy topics, de-duplicated. */
  async searchPluginRepos(login: string): Promise<string[]> {
    const topics = [PLUGIN_TOPIC, ...LEGACY_TOPICS]
    const lists = await Promise.all(topics.map((t) => this.searchByTopic(login, t)))
    return [...new Set(lists.flat())]
  }
}
