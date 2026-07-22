<script setup lang="ts">
import { ref } from 'vue'
import { auth } from '../services/auth'

const pat = ref(auth.state.githubPat)
const key = ref(auth.state.anthropicApiKey)

async function save() {
  auth.setGithubPat(pat.value)
  auth.setAnthropicApiKey(key.value)
  await auth.validate()
}
</script>

<template>
  <div class="gate">
    <h1>builder-shell</h1>
    <p class="lead">
      A backendless, self-extending app. Paste your own credentials — they are
      stored only in this browser's <code>localStorage</code> and sent directly
      to GitHub and Anthropic.
    </p>

    <label>
      GitHub fine-grained PAT
      <input v-model="pat" type="password" placeholder="github_pat_..." autocomplete="off" />
    </label>
    <p class="hint">
      Grant on your account: <b>Administration</b>, <b>Contents</b>, and
      <b>Pages</b> — all Read&nbsp;and&nbsp;write.
      <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
        Create one →
      </a>
    </p>

    <label>
      Anthropic API key
      <input v-model="key" type="password" placeholder="sk-ant-..." autocomplete="off" />
    </label>
    <p class="hint">
      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
        Get a key →
      </a>
    </p>

    <button :disabled="auth.state.validating" @click="save">
      {{ auth.state.validating ? 'Validating…' : 'Save & continue' }}
    </button>
    <p v-if="auth.state.error" class="error">{{ auth.state.error }}</p>
  </div>
</template>

<style scoped>
.gate {
  max-width: 30rem;
  margin: 4rem auto;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.lead {
  color: #555;
  line-height: 1.5;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}
input {
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font: inherit;
}
.hint {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
}
button {
  margin-top: 0.5rem;
  padding: 0.7rem;
  border: 0;
  border-radius: 8px;
  background: #1f6feb;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: default;
}
.error {
  color: #c0392b;
}
</style>
