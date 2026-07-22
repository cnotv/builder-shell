<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { auth } from './services/auth'
import { GitHubClient } from './services/github'
import { Registry } from './services/registry'
import type { Plugin } from './types/plugin'
import SettingsGate from './components/SettingsGate.vue'
import ChatPanel from './components/ChatPanel.vue'
import PluginGallery from './components/PluginGallery.vue'
import PluginHost from './components/PluginHost.vue'

const plugins = ref<Plugin[]>([])
const loading = ref(false)
const selected = ref<Plugin | null>(null)

async function refresh() {
  if (!auth.state.login) return
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

onMounted(async () => {
  await auth.validate()
  if (auth.isReady.value) await refresh()
})
</script>

<template>
  <SettingsGate v-if="!auth.isReady.value" />

  <div v-else class="app">
    <header>
      <strong>builder-shell</strong>
      <span class="user">
        <img v-if="auth.state.avatarUrl" :src="auth.state.avatarUrl" alt="" />
        {{ auth.state.login }}
      </span>
      <button class="logout" @click="auth.clear()">Sign out</button>
    </header>

    <main>
      <aside>
        <ChatPanel @published="refresh" />
        <hr />
        <PluginGallery
          :plugins="plugins"
          :loading="loading"
          :selected="selected?.repo ?? null"
          @select="select"
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
.logout {
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
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
