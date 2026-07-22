import { reactive } from 'vue'
import type { Plugin } from '../types/plugin'

const KEY = 'builder-shell.loadedPlugins'

/** A loaded plugin plus a cache-busting key used to force iframe reloads. */
export interface LoadedPlugin extends Plugin {
  reloadKey: number
}

function load(): LoadedPlugin[] {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? '[]') as LoadedPlugin[]
    return arr.map((p) => ({ ...p, reloadKey: p.reloadKey ?? Date.now() }))
  } catch {
    return []
  }
}

const state = reactive<{ plugins: LoadedPlugin[] }>({ plugins: load() })

function persist(): void {
  localStorage.setItem(KEY, JSON.stringify(state.plugins))
}

function isLoaded(repo: string): boolean {
  return state.plugins.some((p) => p.repo === repo)
}

/** Load (or replace) a plugin. A fresh reloadKey busts caches on update. */
function loadPlugin(plugin: Plugin): void {
  const entry: LoadedPlugin = { ...plugin, reloadKey: Date.now() }
  const i = state.plugins.findIndex((p) => p.repo === plugin.repo)
  if (i >= 0) state.plugins.splice(i, 1, entry)
  else state.plugins.push(entry)
  persist()
}

/** Force a hard reload of one loaded plugin's iframe. */
function reload(repo: string): void {
  const p = state.plugins.find((p) => p.repo === repo)
  if (p) {
    p.reloadKey = Date.now()
    persist()
  }
}

function unload(repo: string): void {
  const i = state.plugins.findIndex((p) => p.repo === repo)
  if (i >= 0) {
    state.plugins.splice(i, 1)
    persist()
  }
}

export const loaded = { state, isLoaded, loadPlugin, reload, unload }
