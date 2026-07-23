<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { auth } from './services/auth'
import { loaded } from './services/loaded'
import { GitHubClient } from './services/github'
import { Registry } from './services/registry'
import { SHELL } from './config'
import type { Plugin } from './types/plugin'
import AiConnections from './components/AiConnections.vue'
import GitHubConnect from './components/GitHubConnect.vue'
import ChatPanel from './components/ChatPanel.vue'
import SelfEdit from './components/SelfEdit.vue'
import PluginGallery from './components/PluginGallery.vue'
import LoadedPlugins from './components/LoadedPlugins.vue'

const plugins = ref<Plugin[]>([])
const loading = ref(false)

const tab = ref<'plugins' | 'settings'>('plugins')

// "New plugin" and "Edit app" live in the Settings tab.
const showCreate = ref(false)
const showSelfEdit = ref(false)

// Editing an existing plugin from the gallery lives in the Settings tab too,
// alongside the plugin loader.
const editingPlugin = ref<Plugin | null>(null)
const showEditPanel = ref(false)

async function refresh() {
  // Browse the connected user's plugins, or the configured owner's as a guest.
  const owner = auth.state.login ?? SHELL.owner
  const authed = auth.state.login !== null
  loading.value = true
  try {
    const gh = new GitHubClient(() => auth.state.githubPat)
    plugins.value = await new Registry(gh, owner, authed).list()
  } catch (err) {
    console.warn('Plugin discovery failed:', err)
    plugins.value = []
  } finally {
    loading.value = false
  }
}

function edit(p: Plugin) {
  editingPlugin.value = p
  showEditPanel.value = true
}

function cancelEditPlugin() {
  showEditPanel.value = false
  editingPlugin.value = null
}

async function onEditPublished(p: Plugin) {
  cancelEditPlugin()
  loaded.loadPlugin(p)
  await refresh()
}

function load(p: Plugin) {
  loaded.loadPlugin(p)
}

function toggleCreate() {
  if (showCreate.value) {
    showCreate.value = false
  } else {
    showCreate.value = true
    showSelfEdit.value = false
  }
}

function toggleSelfEdit() {
  showSelfEdit.value = !showSelfEdit.value
  if (showSelfEdit.value) showCreate.value = false
}

function cancelCreate() {
  showCreate.value = false
}

async function onPublished(p: Plugin) {
  cancelCreate()
  loaded.loadPlugin(p)
  await refresh()
}

onMounted(async () => {
  if (auth.state.githubPat) await auth.validate()
  await refresh() // works as a guest even without a token
})
</script>

<template>
  <div class="app">
    <header>
      <strong>builder-shell</strong>
      <nav class="tabs">
        <button type="button" :class="{ active: tab === 'plugins' }" @click="tab = 'plugins'">
          Plugins
        </button>
        <button type="button" :class="{ active: tab === 'settings' }" @click="tab = 'settings'">
          Settings
        </button>
      </nav>
      <span v-if="auth.state.login" class="user">
        <img v-if="auth.state.avatarUrl" :src="auth.state.avatarUrl" alt="" />
        {{ auth.state.login }}
      </span>
    </header>

    <main>
      <section v-if="tab === 'settings'" class="tab">
        <div class="panel">
          <AiConnections />
          <hr />
          <GitHubConnect @connected="refresh" />
        </div>

        <div class="panel">
          <PluginGallery
            :plugins="plugins"
            :loading="loading"
            @load="load"
            @edit="edit"
            @refresh="refresh"
          />

          <div v-if="showEditPanel" class="editor-area">
            <ChatPanel
              :editing="editingPlugin"
              @published="onEditPublished"
              @cancel-edit="cancelEditPlugin"
            />
          </div>
        </div>

        <div class="panel">
          <div class="toolbar">
            <button @click="toggleCreate">{{ showCreate ? 'Close' : 'New plugin' }}</button>
            <button
              v-if="auth.state.login === SHELL.owner"
              class="secondary"
              @click="toggleSelfEdit"
            >
              {{ showSelfEdit ? 'Close' : 'Edit app' }}
            </button>
          </div>

          <div v-if="showCreate" class="editor-area">
            <ChatPanel :editing="null" @published="onPublished" @cancel-edit="cancelCreate" />
          </div>

          <div v-if="showSelfEdit" class="editor-area">
            <SelfEdit />
          </div>
        </div>
      </section>

      <section v-else class="tab">
        <LoadedPlugins />
      </section>
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 64rem;
  margin: 0 auto;
  padding: 1rem;
}
header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}
.tabs {
  display: flex;
  gap: 0.4rem;
}
.tabs button {
  padding: 0.4rem 0.9rem;
  border: 1px solid #ccc;
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
  font-weight: 600;
  color: #444;
}
.tabs button.active {
  background: #1f6feb;
  border-color: #1f6feb;
  color: #fff;
}
.user {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.user img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
main {
  margin-top: 1rem;
}
.tab {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.panel {
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  padding: 1rem;
  background: #fff;
}
.toolbar {
  display: flex;
  gap: 0.6rem;
}
.toolbar button {
  padding: 0.55rem 0.9rem;
  border: 0;
  border-radius: 8px;
  background: #1f6feb;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.toolbar button.secondary {
  background: #fff;
  color: #333;
  border: 1px solid #ccc;
}
.editor-area {
  margin-top: 1rem;
}
hr {
  border: 0;
  border-top: 1px solid #eee;
  margin: 1rem 0;
}
</style>
