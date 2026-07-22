import { describe, it, expect } from 'vitest'
import { parseManifest, slugify } from './plugin'

describe('parseManifest', () => {
  it('accepts a full manifest', () => {
    expect(parseManifest({ name: 'Timer', description: 'd', emoji: '⏱️', entry: 'app.html' })).toEqual({
      name: 'Timer',
      description: 'd',
      emoji: '⏱️',
      entry: 'app.html',
    })
  })

  it('fills defaults for optional fields', () => {
    expect(parseManifest({ name: 'Timer' })).toEqual({
      name: 'Timer',
      description: '',
      emoji: '🧩',
      entry: 'index.html',
    })
  })

  it('rejects payloads with no valid name', () => {
    expect(parseManifest({ name: '' })).toBeNull()
    expect(parseManifest({})).toBeNull()
    expect(parseManifest(null)).toBeNull()
    expect(parseManifest('nope')).toBeNull()
  })
})

describe('slugify', () => {
  it('produces a valid repo name', () => {
    expect(slugify('My Cool App!')).toBe('my-cool-app')
    expect(slugify('  spaced  ')).toBe('spaced')
    expect(slugify('a/b:c')).toBe('a-b-c')
  })
})
