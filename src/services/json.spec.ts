import { describe, it, expect } from 'vitest'
import { extractJson } from './json'

describe('extractJson', () => {
  it('parses a bare JSON object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('extracts JSON surrounded by prose or fences', () => {
    const text = 'Here you go:\n```json\n{"name":"X","html":"<b>hi</b>"}\n```\nDone.'
    expect(extractJson(text)).toEqual({ name: 'X', html: '<b>hi</b>' })
  })

  it('handles braces inside strings', () => {
    expect(extractJson('{"html":"<div>{not json}</div>"}')).toEqual({
      html: '<div>{not json}</div>',
    })
  })

  it('returns null when there is no JSON', () => {
    expect(extractJson('no json here')).toBeNull()
  })
})
