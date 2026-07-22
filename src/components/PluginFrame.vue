<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { Plugin } from '../types/plugin'

const props = defineProps<{ plugin: Plugin }>()
defineEmits<{ unload: [] }>()

const height = ref(420)

/** Only trust messages coming from the plugin's own Pages origin. */
function expectedOrigin(): string | null {
  try {
    return new URL(props.plugin.url).origin
  } catch {
    return null
  }
}

function onMessage(event: MessageEvent) {
  if (event.origin !== expectedOrigin()) return
  const data = event.data as { type?: string; height?: number }
  if (data?.type === 'resize' && typeof data.height === 'number') {
    height.value = Math.min(Math.max(data.height, 200), 2000)
  }
}

onMounted(() => window.addEventListener('message', onMessage))
onUnmounted(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <div class="frame">
    <div class="bar">
      <span class="title">{{ plugin.emoji }} {{ plugin.name }}</span>
      <a class="open" :href="plugin.url" target="_blank" rel="noreferrer" title="Open in new tab">↗</a>
      <button class="unload" @click="$emit('unload')">Unload</button>
    </div>
    <iframe
      :src="plugin.url"
      :style="{ height: height + 'px' }"
      sandbox="allow-scripts"
      title="plugin"
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
.open {
  text-decoration: none;
  color: #666;
}
.unload {
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 6px;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  font-size: 0.8rem;
}
iframe {
  width: 100%;
  border: 0;
  display: block;
}
</style>
