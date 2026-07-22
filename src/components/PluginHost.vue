<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { Plugin } from '../types/plugin'

const props = defineProps<{ plugin: Plugin | null }>()

const frame = ref<HTMLIFrameElement | null>(null)
const height = ref(480)

/** Only trust messages coming from the plugin's own Pages origin. */
function expectedOrigin(): string | null {
  if (!props.plugin) return null
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

watch(
  () => props.plugin?.repo,
  () => (height.value = 480),
)

onMounted(() => window.addEventListener('message', onMessage))
onUnmounted(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <section class="host">
    <p v-if="!plugin" class="empty">Select a plugin to run it.</p>
    <iframe
      v-else
      ref="frame"
      :key="plugin.repo"
      :src="plugin.url"
      :style="{ height: height + 'px' }"
      sandbox="allow-scripts"
      title="plugin"
    />
  </section>
</template>

<style scoped>
.host {
  flex: 1;
}
.empty {
  color: #888;
}
iframe {
  width: 100%;
  border: 1px solid #e2e2e2;
  border-radius: 10px;
  background: #fff;
}
</style>
