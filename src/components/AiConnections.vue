<script setup lang="ts">
import { reactive } from 'vue'
import { ai } from '../services/ai'
import { PROVIDERS } from '../services/providers'

// Draft key inputs, keyed by provider id (not persisted until "Connect").
const drafts = reactive<Record<string, string>>({})

function connect(id: string) {
  const key = (drafts[id] ?? '').trim()
  if (key === '') return
  ai.connect(id, key)
  drafts[id] = ''
}
</script>

<template>
  <section class="ai">
    <h2>AI providers</h2>
    <p v-if="!ai.hasAgents.value" class="hint">
      Connect at least one provider to start building.
    </p>

    <div v-for="p in PROVIDERS" :key="p.id" class="provider">
      <div class="row">
        <span class="name">{{ p.label }}</span>
        <span v-if="ai.isConnected(p.id)" class="badge">connected</span>
      </div>

      <div v-if="ai.isConnected(p.id)" class="row">
        <button class="secondary" @click="ai.disconnect(p.id)">Disconnect</button>
      </div>
      <div v-else class="row">
        <input
          v-model="drafts[p.id]"
          type="password"
          autocomplete="off"
          :placeholder="p.keyPlaceholder"
          @keyup.enter="connect(p.id)"
        />
        <button @click="connect(p.id)">Connect</button>
      </div>
      <a class="doc" :href="p.docsUrl" target="_blank" rel="noreferrer">Get a key →</a>
    </div>
  </section>
</template>

<style scoped>
.ai {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.hint {
  color: #888;
  margin: 0;
}
.provider {
  border: 1px solid #e2e2e2;
  border-radius: 10px;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.name {
  font-weight: 600;
}
.badge {
  margin-left: auto;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #2e7d32;
  background: #e8f5e9;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
}
input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font: inherit;
}
button {
  padding: 0.5rem 0.8rem;
  border: 0;
  border-radius: 8px;
  background: #1f6feb;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
button.secondary {
  background: #fff;
  color: #333;
  border: 1px solid #ccc;
}
.doc {
  font-size: 0.8rem;
}
</style>
