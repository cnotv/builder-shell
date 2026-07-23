import type { GeneratedPlugin } from '../types/plugin'
import { AnthropicClient } from './anthropic'
import { OpenAiClient } from './openai'

/** A client any provider must expose to generate a plugin. */
export interface ProviderClient {
  generatePlugin(prompt: string, modelId: string): Promise<GeneratedPlugin>
  /** Raw completion — used by the multi-file self-edit flow. */
  completeText(prompt: string, system: string, modelId: string): Promise<string>
}

export interface ProviderModel {
  id: string
  label: string
}

export interface ProviderDef {
  id: string
  label: string
  models: ProviderModel[]
  keyPlaceholder: string
  docsUrl: string
  /** Vite env var read as a local-dev fallback for the key (from .env). */
  envVar: string
  createClient(getKey: () => string): ProviderClient
}

const anthropic: ProviderDef = {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  models: [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
  keyPlaceholder: 'sk-ant-...',
  docsUrl: 'https://console.anthropic.com/settings/keys',
  envVar: 'VITE_ANTHROPIC_API_KEY',
  createClient: (getKey) => new AnthropicClient(getKey),
}

const openai: ProviderDef = {
  id: 'openai',
  label: 'OpenAI (GPT)',
  models: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  ],
  keyPlaceholder: 'sk-...',
  docsUrl: 'https://platform.openai.com/api-keys',
  envVar: 'VITE_OPENAI_API_KEY',
  createClient: (getKey) => new OpenAiClient(getKey),
}

export const PROVIDERS: ProviderDef[] = [anthropic, openai]

export function providerById(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id)
}
