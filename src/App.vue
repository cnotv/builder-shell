<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { auth } from './services/auth'
import { GitHubClient } from './services/github'
import { Registry } from './services/registry'
import type { Plugin } from './types/plugin'
import AiConnections from './components/AiConnections.vue'
import GitHubConnect from './components/GitHubConnect.vue'
import ChatPanel from './components/ChatPanel.vue'
import PluginGallery from './components/PluginGallery.vue'
import PluginHost from './components/PluginHost.vue'

const plugins = ref<Plugin[]>([])
const loading = ref(false)
const selected = ref<Plugin | null>(null)
const editing = ref<Plugin | null>(null)

async function refresh() {
  if (!auth.state.login) {
    plugins.value = []
    return
  }
  loading.value = true
  try {
    const gh = new GitHubClient(() => auth.state.githubPat)
    const registry = new Registry(gh, auth.state.login)
    plugins.value = await registry.list()
  } finally {
    loading.value = false
  }
}

function select(p: Plugin) {
  selected.value = p
}

function edit(p: Plugin) {
  editing.value = p
}

async function onPublished() {
  editing.value = null
  await refresh()
}

onMounted(async () => {
  if (auth.state.githubPat) {
    await auth.validate()
    if (auth.isReady.value) await refresh()
  }
})
</script>

<template>
  <div class="app">
    <header>
      <strong>builder-shell</strong>
      <span v-if="auth.state.login" class="user">
        <img v-if="auth.state.avatarUrl" :src="auth.state.avatarUrl" alt="" />
        {{ auth.state.login }}
      </span>
    </header>

    <main>
      <aside>
        <AiConnections />
        <hr />
        <GitHubConnect @connected="refresh" />
        <hr />
        <ChatPanel
          :editing="editing"
          @published="onPublished"
          @cancel-edit="editing = null"
        />
        <hr />
        <PluginGallery
          :plugins="plugins"
          :loading="loading"
          :selected="selected?.repo ?? null"
          @select="select"
          @edit="edit"
          @refresh="refresh"
        />
      </aside>
      <PluginHost :plugin="selected" />
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 72rem;
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
  display: grid;
  grid-template-columns: 22rem 1fr;
  gap: 1.5rem;
  margin-top: 1rem;
}
aside {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
hr {
  border: 0;
  border-top: 1px solid #eee;
  width: 100%;
}
@media (max-width: 720px) {
  main {
    grid-template-columns: 1fr;
  }
}
</style>
