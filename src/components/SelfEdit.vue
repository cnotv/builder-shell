<script setup lang="ts">
import { ref } from 'vue'
import { auth } from '../services/auth'
import { ai } from '../services/ai'
import { GitHubClient } from '../services/github'
import { selfEdit, type SelfEditStep } from '../services/selfEdit'

const github = new GitHubClient(() => auth.state.githubPat)

const prompt = ref('')
const busy = ref(false)
const steps = ref<SelfEditStep[]>([])
const error = ref<string | null>(null)

function report(step: SelfEditStep) {
  const i = steps.value.findIndex((s) => s.key === step.key)
  if (i >= 0) steps.value.splice(i, 1, step)
  else steps.value.push(step)
}

async function apply() {
  if (prompt.value.trim() === '' || busy.value) return
  const selected = ai.clientForSelected()
  if (!selected) {
    error.value = 'Connect an AI provider first.'
    return
  }
  busy.value = true
  error.value = null
  steps.value = []
  try {
    await selfEdit(github, selected.client, selected.modelId, prompt.value, report)
    prompt.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="self">
    <h3 class="title">Edit this app <span class="owner">owner only</span></h3>
    <p class="warn">
      Changes commit straight to <code>main</code> and auto-deploy after CI. A
      change that fails the build won't deploy, but a working-yet-wrong one will.
    </p>
    <textarea
      v-model="prompt"
      :disabled="busy"
      rows="3"
      placeholder="Describe a change to builder-shell itself…"
    />
    <div class="row">
      <span class="using">
        {{ ai.selectedAgent.value ? `Using ${ai.selectedAgent.value.label}` : 'No AI connected' }}
      </span>
      <button :disabled="busy || prompt.trim() === '' || !ai.hasAgents.value" @click="apply">
        {{ busy ? 'Applying…' : 'Apply to app' }}
      </button>
    </div>

    <ul v-if="steps.length" class="steps">
      <li v-for="s in steps" :key="s.key" :class="s.status">
        <span class="dot">{{ s.status === 'done' ? '✓' : s.status === 'error' ? '✕' : '…' }}</span>
        <span class="lbl">{{ s.label }}</span>
        <a v-if="s.url" :href="s.url" target="_blank" rel="noreferrer" title="View">↗</a>
      </li>
    </ul>
    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<style scoped>
.self {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.title {
  margin: 0;
}
.owner {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #b26a00;
  background: #fff4e5;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  vertical-align: middle;
}
.warn {
  margin: 0;
  font-size: 0.8rem;
  color: #8a6d3b;
  background: #fcf6e6;
  border: 1px solid #f0e2bf;
  border-radius: 8px;
  padding: 0.5rem;
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
  align-items: center;
  gap: 0.5rem;
}
.using {
  flex: 1;
  font-size: 0.8rem;
  color: #666;
}
button {
  padding: 0.6rem 0.9rem;
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
.steps {
  list-style: none;
  margin: 0;
  padding: 0.6rem;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}
.steps li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.steps .dot {
  width: 1rem;
  text-align: center;
}
.steps li.active .lbl {
  color: #1f6feb;
}
.steps .lbl {
  flex: 1;
}
.steps a {
  text-decoration: none;
}
.error {
  color: #c0392b;
}
</style>
