<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { LoadedPlugin } from '../services/loaded'
import { loaded } from '../services/loaded'
import { pluginStore } from '../services/pluginStore'
import type { Plugin } from '../types/plugin'
import ChatPanel from './ChatPanel.vue'

const props = defineProps<{ plugin: LoadedPlugin }>()
defineEmits<{ unload: []; reload: [] }>()

const frame = ref<HTMLIFrameElement | null>(null)
const height = ref(420)
const collapsed = ref(false)
const editing = ref(false)
const status = ref<'loading' | 'ready' | 'error'>('loading')

/** Cache-busted src: a new reloadKey forces the iframe to re-fetch. */
const src = computed(() => {
  const sep = props.plugin.url.includes('?') ? '&' : '?'
  return `${props.plugin.url}${sep}r=${props.plugin.reloadKey}`
})

// Reset the status indicator whenever the iframe is about to (re)load.
watch(src, () => {
  status.value = 'loading'
})

function onFrameLoad() {
  status.value = 'ready'
}

function onFrameError() {
  status.value = 'error'
}

function reply(msg: unknown) {
  frame.value?.contentWindow?.postMessage(msg, '*')
}

/**
 * Handle messages from THIS plugin's iframe. Sandboxed frames have an opaque
 * origin ("null"), so we identify our frame by event.source, not origin.
 */
function onMessage(event: MessageEvent) {
  if (!frame.value || event.source !== frame.value.contentWindow) return
  const d = event.data as { type?: string; height?: number; key?: string; value?: string }
  switch (d?.type) {
    case 'resize':
      if (typeof d.height === 'number') height.value = Math.min(Math.max(d.height, 200), 2000)
      break
    case 'bs-storage-load':
      reply({ type: 'bs-storage-data', data: pluginStore.getAll(props.plugin.repo) })
      break
    case 'bs-storage-set':
      if (typeof d.key === 'string') pluginStore.setKey(props.plugin.repo, d.key, String(d.value ?? ''))
      break
    case 'bs-storage-remove':
      if (typeof d.key === 'string') pluginStore.removeKey(props.plugin.repo, d.key)
      break
  }
}

/** Applied from the inline editor: refresh the loaded plugin and go back to the frame. */
function onPublished(p: Plugin) {
  loaded.loadPlugin(p)
  editing.value = false
}

onMounted(() => window.addEventListener('message', onMessage))
onUnmounted(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <div class="frame">
    <div class="bar">
      <button class="icon" :title="collapsed ? 'Expand' : 'Collapse'" @click="collapsed = !collapsed">
        {{ collapsed ? '▸' : '▾' }}
      </button>
      <span class="title">{{ plugin.emoji }} {{ plugin.name }}</span>
      <span class="status" :class="status">
        {{ status === 'ready' ? 'Ready' : status === 'error' ? 'Error' : 'Loading…' }}
      </span>
      <a class="open" :href="plugin.url" target="_blank" rel="noreferrer" title="Open in new tab">↗</a>
      <button class="act" :class="{ active: editing }" @click="editing = !editing">
        {{ editing ? 'Close editor' : 'Edit' }}
      </button>
      <button class="act" @click="$emit('reload')">Reload</button>
      <button class="act" @click="$emit('unload')">Unload</button>
    </div>

    <div v-if="!collapsed && editing" class="editor">
      <ChatPanel :editing="plugin" @published="onPublished" @cancel-edit="editing = false" />
    </div>

    <iframe
      v-show="!collapsed && !editing"
      ref="frame"
      :src="src"
      :style="{ height: height + 'px' }"
      sandbox="allow-scripts"
      title="plugin"
      @load="onFrameLoad"
      @error="onFrameError"
    />
  </div>
</template>

<style scoped>
.frame {
  border: 1px solid #e2e2e2;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: #f6f8fa;
  border-bottom: 1px solid #e2e2e2;
}
.title {
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status {
  font-size: 0.75rem;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: #eee;
  color: #666;
  white-space: nowrap;
  flex: none;
}
.status.loading {
  background: #eef4ff;
  color: #1f6feb;
}
.status.ready {
  background: #e8f5e9;
  color: #2e7d32;
}
.status.error {
  background: #fdecea;
  color: #c0392b;
}
.open {
  text-decoration: none;
  color: #666;
}
.icon {
  border: 0;
  background: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: #555;
  padding: 0 0.2rem;
}
.act {
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 6px;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  font-size: 0.8rem;
}
.act.active {
  background: #eef4ff;
  color: #1f6feb;
  border-color: #1f6feb;
}
.editor {
  padding: 0.75rem;
}
iframe {
  width: 100%;
  border: 0;
  display: block;
}
</style>
