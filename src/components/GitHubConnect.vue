<script setup lang="ts">
import { computed, ref } from 'vue'
import { auth } from '../services/auth'

const emit = defineEmits<{ connected: [] }>()

const pat = ref(auth.state.githubPat)

/**
 * GitHub lets you pre-fill a fine-grained personal access token's
 * description, target account, and permissions via query parameters on the
 * token creation page. We use it so the exact scopes builder-shell needs
 * (Administration, Contents, Pages — all read/write) are already selected;
 * the user just has to review and click "Generate token", then paste it
 * back here. If we already know the connected user's login, we target their
 * account directly so they can create a fresh token without hunting for it.
 */
const tokenUrl = computed(() => {
  const params = new URLSearchParams({
    description: 'builder-shell',
    contents: 'write',
    administration: 'write',
    pages: 'write',
  })
  if (auth.state.login) params.set('target_name', auth.state.login)
  return `https://github.com/settings/personal-access-tokens/new?${params.toString()}`
})

async function connect() {
  auth.setGithubPat(pat.value)
  await auth.validate()
  if (auth.isReady.value) emit('connected')
}
</script>

<template>
  <section class="gh">
    <h2>GitHub</h2>

    <div v-if="auth.isReady.value" class="row connected">
      <img v-if="auth.state.avatarUrl" :src="auth.state.avatarUrl" alt="" />
      <span>Connected as <b>{{ auth.state.login }}</b></span>
      <a
        class="new-token"
        :href="tokenUrl"
        target="_blank"
        rel="noreferrer"
        title="Open GitHub with a new pre-filled token ready to generate"
      >
        New token →
      </a>
      <button class="secondary" @click="auth.signOut()">Sign out</button>
    </div>

    <template v-else>
      <p class="hint">
        Only needed to <b>publish or edit</b> plugins. Browsing and running
        existing plugins works without connecting.
      </p>
      <input
        v-model="pat"
        type="password"
        autocomplete="off"
        placeholder="github_pat_… or a classic token"
        @keyup.enter="connect"
      />
      <button :disabled="auth.state.validating" @click="connect">
        {{ auth.state.validating ? 'Connecting…' : 'Connect GitHub' }}
      </button>
      <p class="hint">
        Need a token? We can open GitHub with the required access
        (<b>Administration</b>, <b>Contents</b>, and <b>Pages</b>, all
        <b>Read and write</b>) already selected — just review and generate
        it, then paste it above. Or use a classic token with the
        <code>repo</code> scope.
        <a :href="tokenUrl" target="_blank" rel="noreferrer">Create (pre-filled) →</a>
      </p>
      <p v-if="auth.state.error" class="error">{{ auth.state.error }}</p>
    </template>
  </section>
</template>

<style scoped>
.gh {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.hint {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.connected img {
  width: 22px;
  height: 22px;
  border-radius: 50%;
}
.connected .new-token {
  font-size: 0.85rem;
  white-space: nowrap;
}
.connected button {
  margin-left: auto;
}
input {
  padding: 0.55rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font: inherit;
}
button {
  padding: 0.55rem 0.8rem;
  border: 0;
  border-radius: 8px;
  background: #1f6feb;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
button.secondary {
  background: #fff;
  color: #333;
  border: 1px solid #ccc;
}
button:disabled {
  opacity: 0.6;
  cursor: default;
}
.error {
  color: #c0392b;
}
</style>
