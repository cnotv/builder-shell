import { reactive, markRaw } from 'vue'
import type { PublishStep } from './publisher'

/**
 * A chat session's state, kept outside any component instance so closing
 * (unmounting) a ChatPanel — e.g. by clicking elsewhere — never loses the
 * in-flight request's progress, draft text, or last result. Sessions are
 * keyed by context: one per "new plugin" flow, one per edited plugin repo.
 */
export interface ChatSession {
  /** Text currently being drafted, not yet submitted. */
  prompt: string
  /** The prompt text of the request currently running (or last run). */
  activePrompt: string | null
  busy: boolean
  steps: PublishStep[]
  error: string | null
  answer: string | null
  controller: AbortController | null
}

function empty(): ChatSession {
  return {
    prompt: '',
    activePrompt: null,
    busy: false,
    steps: [],
    error: null,
    answer: null,
    controller: null,
  }
}

const sessions = reactive<Record<string, ChatSession>>({})

/** Get (creating if needed) the persistent chat session for a key. */
function get(key: string): ChatSession {
  if (!sessions[key]) sessions[key] = empty()
  return sessions[key]
}

/** Store an AbortController without letting Vue attempt to deep-wrap it. */
function setController(key: string, controller: AbortController | null): void {
  get(key).controller = controller ? markRaw(controller) : null
}

function clear(key: string): void {
  delete sessions[key]
}

export const chatStore = { get, setController, clear }
