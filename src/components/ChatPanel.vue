<script setup lang="ts">
import { computed, ref } from 'vue'
import { auth } from '../services/auth'
import { ai, type Agent } from '../services/ai'
import { GitHubClient } from '../services/github'
import { publishPlugin, updatePlugin, type PublishStep } from '../services/publisher'
import { buildUpdatePrompt } from '../services/pluginGen'
import { slugify, type Plugin, type PluginManifest } from '../types/plugin'

const props = defineProps<{ editing: Plugin | null }>()
const emit = defineEmits<{ published: [plugin: Plugin]; cancelEdit: [] }>()

const github = new GitHubClient(() => auth.state.githubPat)

const prompt = ref('')
const busy = ref(false)
const steps = ref<PublishStep[]>([])
const error = ref<string | null>(null)
const answer = ref<string | null>(null)
const controller = ref<AbortController | null>(null)

/** Upsert a reported step by key, preserving order. */
function report(step: PublishStep) {
  const i = steps.value.findIndex((s) => s.key === step.key)
  if (i >= 0) steps.value.splice(i, 1, step)
  else steps.value.push(step)
}

// Group agents by provider for optgroups in the dropdown.
const grouped = computed(() => {
  const map = new Map<string, { providerLabel: string; agents: Agent[] }>()
  for (const a of ai.agents.value) {
    if (!map.has(a.providerId)) map.set(a.providerId, { providerLabel: a.providerLabel, agents: [] })
    map.get(a.providerId)!.agents.push(a)
  }
  return [...map.values()]
})

const selectedId = computed(() => ai.selectedAgent.value?.id ?? '')

function onSelect(e: Event) {
  ai.selectAgent((e.target as HTMLSelectElement).value)
}

function stop() {
  controller.value?.abort()
}

async function build() {
  if (prompt.value.trim() === '' || busy.value) return
  const selected = ai.clientForSelected()
  if (!selected) {
    error.value = 'Connect an AI provider first.'
    return
  }
  const login = auth.state.login
  if (!login) {
    error.value = 'Connect GitHub in the sidebar to publish your plugin.'
    return
  }

  busy.value = true
  error.value = null
  answer.value = null
  steps.value = []
  const abort = new AbortController()
  controller.value = abort

  try {
    if (props.editing) {
      const target = props.editing
      const current = await github.getContent(login, target.repo, target.entry)
      const manifest: PluginManifest = {
        name: target.name,
        description: target.description,
        emoji: target.emoji,
        entry: target.entry,
      }
      const updated = await selected.client.generatePlugin(
        buildUpdatePrompt(manifest, current.text, prompt.value),
        selected.modelId,
        abort.signal,
      )
      answer.value = updated.raw ?? null
      const url = await updatePlugin(github, login, target.repo, target.entry, updated, report)
      prompt.value = ''
      emit('published', {
        name: updated.manifest.name,
        description: updated.manifest.description,
        emoji: updated.manifest.emoji,
        entry: target.entry,
        repo: target.repo,
        url,
      })
      emit('cancelEdit')
    } else {
      const plugin = await selected.client.generatePlugin(prompt.value, selected.modelId, abort.signal)
      answer.value = plugin.raw ?? null
      const repo = slugify(plugin.manifest.name) || `plugin-${Date.now()}`
      const url = await publishPlugin(github, login, repo, plugin, report)
      prompt.value = ''
      emit('published', { ...plugin.manifest, repo, url })
    }
  } catch (err) {
    if (abort.signal.aborted) {
      error.value = 'Stopped.'
    } else {
      error.value = err instanceof Error ? err.message : String(err)
    }
  } finally {
    busy.value = false
    controller.value = null
  }
}
</script>

<template>
  <section class="chat">
    <h2 v-if="editing">Update: {{ editing.name }}</h2>
    <h2 v-else>Describe a plugin</h2>

    <textarea
      v-model="prompt"
      :disabled="busy"
      rows="4"
      :placeholder="
        editing
          ? 'Describe the changes to apply…'
          : 'e.g. A pomodoro timer with start/stop and a tomato that fills up'
      "
    />
    <div class="row">
      <select :value="selectedId" :disabled="busy || !ai.hasAgents.value" @change="onSelect">
        <template v-if="ai.hasAgents.value">
          <optgroup v-for="g in grouped" :key="g.providerLabel" :label="g.providerLabel">
            <option v-for="a in g.agents" :key="a.id" :value="a.id">{{ a.label }}</option>
          </optgroup>
        </template>
      </select>
      <button v-if="busy" class="stop" @click="stop">Stop</button>
      <button v-else :disabled="prompt.trim() === '' || !ai.hasAgents.value" @click="build">
        {{ editing ? 'Update plugin' : 'Build & publish' }}
      </button>
    </div>

    <button v-if="editing && !busy" class="link" @click="$emit('cancelEdit')">Cancel edit</button>

    <p v-if="!ai.hasAgents.value" class="hint">Connect an AI provider above to enable building.</p>

    <ul v-if="steps.length" class="steps">
      <li v-for="s in steps" :key="s.key" :class="s.status">
        <span class="dot">{{ s.status === 'done' ? '✓' : s.status === 'error' ? '✕' : '…' }}</span>
        <span class="lbl">{{ s.label }}</span>
        <a v-if="s.url" :href="s.url" target="_blank" rel="noreferrer" title="View">↗</a>
      </li>
    </ul>

    <div v-if="answer" class="answer">
      <div class="answer-head">
        <span>AI response</span>
        <button class="link" @click="answer = null">Hide</button>
      </div>
      <pre>{{ answer }}</pre>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
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
  min-width: 8rem;
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
button.stop {
  background: #c0392b;
}
button.link {
  flex: none;
  align-self: flex-start;
  background: none;
  color: #666;
  padding: 0;
  font-weight: 400;
  text-decoration: underline;
}
.hint {
  color: #888;
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
}
.steps li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}
.steps .dot {
  width: 1rem;
  text-align: center;
}
.steps li.active .lbl {
  color: #1f6feb;
}
.steps li.done .dot {
  color: #2e7d32;
}
.steps .lbl {
  flex: 1;
}
.steps a {
  text-decoration: none;
}
.answer {
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  overflow: hidden;
}
.answer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.6rem;
  background: #f6f8fa;
  font-size: 0.8rem;
  font-weight: 600;
  color: #555;
}
.answer-head button {
  flex: none;
}
.answer pre {
  margin: 0;
  padding: 0.6rem;
  max-height: 16rem;
  overflow: auto;
  font-size: 0.78rem;
  white-space: pre-wrap;
  word-break: break-word;
}
.error {
  color: #c0392b;
}
</style>
