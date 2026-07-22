<script setup lang="ts">
import type { Plugin } from '../types/plugin'
import { loaded } from '../services/loaded'

defineProps<{ plugins: Plugin[]; loading: boolean }>()
defineEmits<{ load: [plugin: Plugin]; edit: [plugin: Plugin]; refresh: [] }>()
</script>

<template>
  <section class="gallery">
    <div class="head">
      <h2>Plugin loader</h2>
      <button class="refresh" :disabled="loading" @click="$emit('refresh')">
        {{ loading ? '…' : '↻' }}
      </button>
    </div>

    <p v-if="!loading && plugins.length === 0" class="empty">
      No plugins found. Build one, or connect GitHub.
    </p>

    <ul>
      <li v-for="p in plugins" :key="p.repo">
        <span class="emoji">{{ p.emoji }}</span>
        <span class="meta">
          <b>{{ p.name }}</b>
          <small>{{ p.description }}</small>
        </span>
        <button v-if="loaded.isLoaded(p.repo)" class="ghost" disabled>Loaded</button>
        <button v-else @click="$emit('load', p)">Load</button>
        <button class="edit" @click="$emit('edit', p)">Edit</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.refresh {
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
}
.empty {
  color: #888;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
li {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  padding: 0.6rem;
  border: 1px solid #e2e2e2;
  border-radius: 10px;
}
.emoji {
  font-size: 1.4rem;
}
.meta {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
small {
  color: #666;
}
button {
  border: 0;
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
  font-size: 0.8rem;
  background: #1f6feb;
  color: #fff;
  font-weight: 600;
}
button.edit {
  background: #fff;
  color: #333;
  border: 1px solid #ccc;
  font-weight: 400;
}
button.ghost {
  background: #eef4ff;
  color: #1f6feb;
  cursor: default;
}
</style>
