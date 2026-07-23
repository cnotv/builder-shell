<script setup lang="ts">
import { ref } from 'vue'
import { auth } from '../services/auth'

const emit = defineEmits<{ connected: [] }>()

const pat = ref(auth.state.githubPat)

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
        Token must have <b>All repositories</b> access with
        <b>Administration</b>, <b>Contents</b>, and <b>Pages</b> set to
        <b>Read and write</b> — or just use a classic token with the
        <code>repo</code> scope.
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
          Create →
        </a>
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
