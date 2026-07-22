import { describe, it, expect, vi } from 'vitest'
import { Registry } from './registry'
import type { GitHubClient } from './github'

function mockGitHub(files: Record<string, string>, repos: string[]): GitHubClient {
  return {
    searchPluginRepos: vi.fn().mockResolvedValue(repos),
    getFile: vi.fn((_login: string, repo: string) => {
      const content = files[repo]
      if (content === undefined) return Promise.reject(new Error('404'))
      return Promise.resolve(content)
    }),
  } as unknown as GitHubClient
}

describe('Registry', () => {
  it('loads valid plugins and computes their URLs', async () => {
    const gh = mockGitHub(
      { timer: JSON.stringify({ name: 'Timer', emoji: '⏱️', entry: 'index.html' }) },
      ['timer'],
    )
    const plugins = await new Registry(gh, 'cnotv').list()
    expect(plugins).toHaveLength(1)
    expect(plugins[0]).toMatchObject({
      name: 'Timer',
      repo: 'timer',
      url: 'https://cnotv.github.io/timer/index.html',
    })
  })

  it('skips repos with missing or invalid manifests without failing the list', async () => {
    const gh = mockGitHub(
      {
        good: JSON.stringify({ name: 'Good' }),
        bad: 'not json',
        // "missing" repo returns 404 from getFile
      },
      ['good', 'bad', 'missing'],
    )
    const plugins = await new Registry(gh, 'cnotv').list()
    expect(plugins.map((p) => p.repo)).toEqual(['good'])
  })
})
