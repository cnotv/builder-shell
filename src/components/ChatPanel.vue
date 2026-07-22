<script setup lang="ts">
import { ref } from 'vue'
import { auth } from '../services/auth'
import { AnthropicClient, MODELS, type ModelId } from '../services/anthropic'
import { GitHubClient } from '../services/github'
import { publishPlugin, type PublishStage } from '../services/publisher'
import { slugify } from '../types/plugin'

const emit = defineEmits<{ published: [] }>()

const anthropic = new AnthropicClient(() => auth.state.anthropicApiKey)
const github = new GitHubClient(() => auth.state.githubPat)

const prompt = ref('')
const model = ref<ModelId>('claude-opus-4-8')
const busy = ref(false)
const stage = ref<PublishStage | null>(null)
const error = ref<string | null>(null)
const lastUrl = ref<string | null>(null)

const stageLabel: Record<PublishStage, string> = {
  'creating-repo': 'Creating repository…',
  committing: 'Committing files…',
  tagging: 'Tagging plugin…',
  'enabling-pages': 'Enabling GitHub Pages…',
  building: 'Waiting for Pages build…',
  done: 'Done!',
}

async function build() {
  if (prompt.value.trim() === '' || busy.value) return
  const login = auth.state.login
  if (!login) return
  busy.value = true
  error.value = null
  lastUrl.value = null
  try {
    const plugin = await anthropic.generatePlugin(prompt.value, model.value)
    const repo = slugify(plugin.manifest.name) || `plugin-${Date.now()}`
    const url = await publishPlugin(github, login, repo, plugin, (s) => (stage.value = s))
    lastUrl.value = url
    prompt.value = ''
    emit('published')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
    stage.value = null
  }
}
</script>

<template>
  <section class="chat">
    <h2>Describe a mini-app</h2>
    <textarea
      v-model="prompt"
      :disabled="busy"
      rows="4"
      placeholder="e.g. A pomodoro timer with start/stop and a tomato that fills up"
    />
    <div class="row">
      <select v-model="model" :disabled="busy">
        <option v-for="m in MODELS" :key="m.id" :value="m.id">{{ m.label }}</option>
      </select>
      <button :disabled="busy || prompt.trim() === ''" @click="build">
        {{ busy ? 'Building…' : 'Build & publish' }}
      </button>
    </div>

    <p v-if="stage" class="status">{{ stageLabel[stage] }}</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="lastUrl" class="ok">
      Published → <a :href="lastUrl" target="_blank" rel="noreferrer">{{ lastUrl }}</a>
    </p>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
textarea {
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font: inherit;
  resize: vertical;
}
.row {
  display: flex;
  gap: 0.5rem;
}
select {
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid #ccc;
}
button {
  flex: 1;
  padding: 0.6rem;
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
.status {
  color: #1f6feb;
}
.error {
  color: #c0392b;
}
.ok {
  color: #2e7d32;
  word-break: break-all;
}
</style>
