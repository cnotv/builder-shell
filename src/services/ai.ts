import { computed, reactive } from 'vue'
import { PROVIDERS, providerById, type ProviderClient } from './providers'

const CONN_KEY = 'builder-shell.aiConnections'
const AGENT_KEY = 'builder-shell.selectedAgent'

/** A selectable AI: one model of one connected provider. */
export interface Agent {
  id: string
  providerId: string
  providerLabel: string
  modelId: string
  label: string
}

interface AiState {
  /** providerId -> apiKey for every connected provider. */
  connections: Record<string, string>
  selectedAgentId: string | null
}

function loadConnections(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CONN_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

const state = reactive<AiState>({
  connections: loadConnections(),
  selectedAgentId: localStorage.getItem(AGENT_KEY),
})

// Local-dev fallback: auto-connect from .env (VITE_*) when a key is present
// and the provider is not already connected in this browser.
const env = import.meta.env as unknown as Record<string, string | undefined>
for (const p of PROVIDERS) {
  const fromEnv = env[p.envVar]
  if (fromEnv && !state.connections[p.id]) state.connections[p.id] = fromEnv
}

/** Flattened list of connected provider models. Empty when nothing is connected. */
const agents = computed<Agent[]>(() => {
  const list: Agent[] = []
  for (const p of PROVIDERS) {
    if (!state.connections[p.id]) continue
    for (const m of p.models) {
      list.push({
        id: `${p.id}:${m.id}`,
        providerId: p.id,
        providerLabel: p.label,
        modelId: m.id,
        label: m.label,
      })
    }
  }
  return list
})

const hasAgents = computed(() => agents.value.length > 0)

/** The chosen agent, falling back to the first available one. */
const selectedAgent = computed<Agent | null>(
  () => agents.value.find((a) => a.id === state.selectedAgentId) ?? agents.value[0] ?? null,
)

function persist(): void {
  localStorage.setItem(CONN_KEY, JSON.stringify(state.connections))
}

function connect(providerId: string, key: string): void {
  state.connections[providerId] = key.trim()
  persist()
}

function disconnect(providerId: string): void {
  delete state.connections[providerId]
  persist()
  if (state.selectedAgentId?.startsWith(`${providerId}:`)) {
    state.selectedAgentId = null
    localStorage.removeItem(AGENT_KEY)
  }
}

function isConnected(providerId: string): boolean {
  return Boolean(state.connections[providerId])
}

function selectAgent(id: string): void {
  state.selectedAgentId = id
  localStorage.setItem(AGENT_KEY, id)
}

/** Build a client for the currently selected agent, or null if none. */
function clientForSelected(): { client: ProviderClient; modelId: string } | null {
  const agent = selectedAgent.value
  if (!agent) return null
  const provider = providerById(agent.providerId)
  if (!provider) return null
  return {
    client: provider.createClient(() => state.connections[agent.providerId] ?? ''),
    modelId: agent.modelId,
  }
}

export const ai = {
  state,
  agents,
  hasAgents,
  selectedAgent,
  connect,
  disconnect,
  isConnected,
  selectAgent,
  clientForSelected,
}
