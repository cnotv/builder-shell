<script setup lang="ts">
import { computed, ref } from 'vue'
import { auth } from '../services/auth'
import { ai, type Agent } from '../services/ai'
import { GitHubClient } from '../services/github'
import { publishPlugin, updatePlugin, type PublishStage } from '../services/publisher'
import { buildUpdatePrompt } from '../services/pluginGen'
import { slugify, type Plugin, type PluginManifest } from '../types/plugin'

const props = defineProps<{ editing: Plugin | null }>()
const emit = defineEmits<{ published: []; cancelEdit: [] }>()

const github = new GitHubClient(() => auth.state.githubPat)

const prompt = ref('')
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

async function build() {
  if (prompt.value.trim() === '' || busy.value) return
  const selected = ai.clientForSelected()
  if (!selected) {
    error.value = 'Connect an AI provider first.'
    return
  }
  // GitHub is only required to publish/update — request it at build time.
  const login = auth.state.login
  if (!login) {
    error.value = 'Connect GitHub in the sidebar to publish your plugin.'
    return
  }

  busy.value = true
  error.value = null
  lastUrl.value = null
  const onStage = (s: PublishStage) => (stage.value = s)

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
      )
      lastUrl.value = await updatePlugin(github, login, target.repo, target.entry, updated, onStage)
      prompt.value = ''
      emit('published')
      emit('cancelEdit')
    } else {
      const plugin = await selected.client.generatePlugin(prompt.value, selected.modelId)
      const repo = slugify(plugin.manifest.name) || `plugin-${Date.now()}`
      lastUrl.value = await publishPlugin(github, login, repo, plugin, onStage)
      prompt.value = ''
      emit('published')
    }
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
      <select
        :value="selectedId"
        :disabled="busy || !ai.hasAgents.value"
        @change="onSelect"
      >
        <template v-if="ai.hasAgents.value">
          <optgroup v-for="g in grouped" :key="g.providerLabel" :label="g.providerLabel">
            <option v-for="a in g.agents" :key="a.id" :value="a.id">{{ a.label }}</option>
          </optgroup>
        </template>
      </select>
      <button
        :disabled="busy || prompt.trim() === '' || !ai.hasAgents.value"
        @click="build"
      >
        {{ busy ? (editing ? 'Updating…' : 'Building…') : editing ? 'Update plugin' : 'Build & publish' }}
      </button>
    </div>

    <button v-if="editing && !busy" class="link" @click="$emit('cancelEdit')">
      Cancel edit
    </button>

    <p v-if="!ai.hasAgents.value" class="hint">
      Connect an AI provider above to enable building.
    </p>
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
