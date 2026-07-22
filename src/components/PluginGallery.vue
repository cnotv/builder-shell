<script setup lang="ts">
import type { Plugin } from '../types/plugin'

defineProps<{ plugins: Plugin[]; loading: boolean; selected: string | null }>()
defineEmits<{ select: [plugin: Plugin]; refresh: [] }>()
</script>

<template>
  <section class="gallery">
    <div class="head">
      <h2>Plugins</h2>
      <button class="refresh" :disabled="loading" @click="$emit('refresh')">
        {{ loading ? '…' : '↻' }}
      </button>
    </div>

    <p v-if="!loading && plugins.length === 0" class="empty">
      No plugins yet. Build one on the left.
    </p>

    <ul>
      <li
        v-for="p in plugins"
        :key="p.repo"
        :class="{ active: p.repo === selected }"
        @click="$emit('select', p)"
      >
        <span class="emoji">{{ p.emoji }}</span>
        <span class="meta">
          <b>{{ p.name }}</b>
          <small>{{ p.description }}</small>
        </span>
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
  cursor: pointer;
}
li.active {
  border-color: #1f6feb;
  background: #eef4ff;
}
.emoji {
  font-size: 1.4rem;
}
.meta {
  display: flex;
  flex-direction: column;
}
small {
  color: #666;
}
</style>
