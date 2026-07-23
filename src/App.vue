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
const editing = ref<Plugin | null>(null)

async function refresh() {
  if (!auth.state.login) {
    plugins.value = []
    return
  }
  loading.value = true
  try {
    const gh = new GitHubClient(() => auth.state.githubPat)
    plugins.value = await new Registry(gh, auth.state.login).list()
  } finally {
    loading.value = false
  }
}

function edit(p: Plugin) {
  editing.value = p
}

function load(p: Plugin) {
  loaded.loadPlugin(p)
}

async function onPublished(p: Plugin) {
  editing.value = null
  loaded.loadPlugin(p)
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
      <!-- Left column: Connections + Plugin loader -->
      <aside class="left">
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
        </div>
      </aside>

      <!-- Right column: Plugin creator + Loaded plugins -->
      <section class="work">
        <div class="panel">
          <ChatPanel :editing="editing" @published="onPublished" @cancel-edit="editing = null" />
        </div>

        <div v-if="auth.state.login === SHELL.owner" class="panel">
          <SelfEdit />
        </div>

        <div class="panel grow">
          <h3 class="panel-title">Loaded plugins</h3>
          <LoadedPlugins />
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 84rem;
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
  gap: 1.25rem;
  margin-top: 1rem;
  align-items: start;
}
.left,
.work {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}
.panel {
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  padding: 1rem;
  background: #fff;
}
.panel.grow {
  min-height: 12rem;
}
.panel-title {
  margin: 0 0 0.6rem;
}
hr {
  border: 0;
  border-top: 1px solid #eee;
  margin: 1rem 0;
}
@media (max-width: 820px) {
  main {
    grid-template-columns: 1fr;
  }
}
</style>
