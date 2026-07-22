import { reactive } from 'vue'
import type { Plugin } from '../types/plugin'

const KEY = 'builder-shell.loadedPlugins'

function load(): Plugin[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Plugin[]
  } catch {
    return []
  }
}

const state = reactive<{ plugins: Plugin[] }>({ plugins: load() })

function persist(): void {
  localStorage.setItem(KEY, JSON.stringify(state.plugins))
}

function isLoaded(repo: string): boolean {
  return state.plugins.some((p) => p.repo === repo)
}

function loadPlugin(plugin: Plugin): void {
  const existing = state.plugins.findIndex((p) => p.repo === plugin.repo)
  if (existing >= 0) state.plugins.splice(existing, 1, plugin)
  else state.plugins.push(plugin)
  persist()
}

function unload(repo: string): void {
  const i = state.plugins.findIndex((p) => p.repo === repo)
  if (i >= 0) {
    state.plugins.splice(i, 1)
    persist()
  }
}

export const loaded = { state, isLoaded, loadPlugin, unload }
