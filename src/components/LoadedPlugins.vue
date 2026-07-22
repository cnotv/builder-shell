<script setup lang="ts">
import { loaded } from '../services/loaded'
import PluginFrame from './PluginFrame.vue'
</script>

<template>
  <section class="loaded">
    <p v-if="loaded.state.plugins.length === 0" class="empty">
      No plugins loaded. Load one from the plugin loader — you can load several at once.
    </p>
    <PluginFrame
      v-for="p in loaded.state.plugins"
      :key="p.repo"
      :plugin="p"
      @reload="loaded.reload(p.repo)"
      @unload="loaded.unload(p.repo)"
    />
  </section>
</template>

<style scoped>
.loaded {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.empty {
  color: #888;
}
</style>
