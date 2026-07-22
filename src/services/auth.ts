import { computed, reactive } from 'vue'
import { GitHubClient } from './github'

const PAT_KEY = 'builder-shell.githubPat'
const ANTHROPIC_KEY = 'builder-shell.anthropicApiKey'

interface AuthState {
  githubPat: string
  anthropicApiKey: string
  login: string | null
  avatarUrl: string | null
  validating: boolean
  error: string | null
}

const state = reactive<AuthState>({
  githubPat: localStorage.getItem(PAT_KEY) ?? '',
  anthropicApiKey: localStorage.getItem(ANTHROPIC_KEY) ?? '',
  login: null,
  avatarUrl: null,
  validating: false,
  error: null,
})

/** True once both credentials are present and the PAT has been validated. */
const isReady = computed(
  () => state.login !== null && state.anthropicApiKey.trim() !== '',
)

/** Validate the current PAT by resolving the GitHub user. Safe to call repeatedly. */
async function validate(): Promise<void> {
  state.error = null
  if (state.githubPat.trim() === '') {
    state.login = null
    state.avatarUrl = null
    return
  }
  state.validating = true
  try {
    const gh = new GitHubClient(() => state.githubPat)
    const user = await gh.getUser()
    state.login = user.login
    state.avatarUrl = user.avatar_url
  } catch (err) {
    state.login = null
    state.avatarUrl = null
    state.error = err instanceof Error ? err.message : 'Failed to validate GitHub token'
  } finally {
    state.validating = false
  }
}

function setGithubPat(value: string): void {
  state.githubPat = value.trim()
  localStorage.setItem(PAT_KEY, state.githubPat)
}

function setAnthropicApiKey(value: string): void {
  state.anthropicApiKey = value.trim()
  localStorage.setItem(ANTHROPIC_KEY, state.anthropicApiKey)
}

function clear(): void {
  setGithubPat('')
  setAnthropicApiKey('')
  state.login = null
  state.avatarUrl = null
  state.error = null
}

export const auth = {
  state,
  isReady,
  validate,
  setGithubPat,
  setAnthropicApiKey,
  clear,
}
