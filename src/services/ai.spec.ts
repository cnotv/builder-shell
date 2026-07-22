import { describe, it, expect, beforeEach } from 'vitest'
import { ai } from './ai'

describe('ai store', () => {
  beforeEach(() => {
    ai.disconnect('anthropic')
    ai.disconnect('openai')
    localStorage.clear()
  })

  it('has no agents until a provider is connected', () => {
    expect(ai.hasAgents.value).toBe(false)
    expect(ai.agents.value).toEqual([])
    expect(ai.selectedAgent.value).toBeNull()
  })

  it('exposes a provider\'s models as agents once connected', () => {
    ai.connect('anthropic', 'sk-ant-test')
    expect(ai.hasAgents.value).toBe(true)
    expect(ai.agents.value.map((a) => a.modelId)).toContain('claude-opus-4-8')
    // selection defaults to the first agent
    expect(ai.selectedAgent.value?.providerId).toBe('anthropic')
  })

  it('flattens multiple connected providers', () => {
    ai.connect('anthropic', 'sk-ant-test')
    ai.connect('openai', 'sk-openai-test')
    const providerIds = new Set(ai.agents.value.map((a) => a.providerId))
    expect(providerIds).toEqual(new Set(['anthropic', 'openai']))
  })

  it('disconnecting removes its agents and clears a stale selection', () => {
    ai.connect('anthropic', 'sk-ant-test')
    ai.selectAgent('anthropic:claude-sonnet-5')
    ai.disconnect('anthropic')
    expect(ai.hasAgents.value).toBe(false)
    expect(ai.selectedAgent.value).toBeNull()
  })
})
