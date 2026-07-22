import { describe, it, expect, beforeEach } from 'vitest'
import { pluginStore } from './pluginStore'

describe('pluginStore', () => {
  beforeEach(() => localStorage.clear())

  it('stores and reads values per plugin repo', () => {
    pluginStore.setKey('timer', 'theme', 'dark')
    expect(pluginStore.getAll('timer')).toEqual({ theme: 'dark' })
  })

  it('keeps plugins isolated from each other', () => {
    pluginStore.setKey('a', 'x', '1')
    pluginStore.setKey('b', 'x', '2')
    expect(pluginStore.getAll('a')).toEqual({ x: '1' })
    expect(pluginStore.getAll('b')).toEqual({ x: '2' })
  })

  it('never exposes the shell\'s own keys', () => {
    localStorage.setItem('builder-shell.githubPat', 'secret')
    pluginStore.setKey('p', 'k', 'v')
    expect(pluginStore.getAll('p')).toEqual({ k: 'v' })
    expect(JSON.stringify(pluginStore.getAll('p'))).not.toContain('secret')
  })

  it('removes keys', () => {
    pluginStore.setKey('p', 'k', 'v')
    pluginStore.removeKey('p', 'k')
    expect(pluginStore.getAll('p')).toEqual({})
  })
})
