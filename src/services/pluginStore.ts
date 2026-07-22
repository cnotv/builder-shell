/**
 * Per-plugin persistent storage, kept in the shell's localStorage under a
 * namespace derived from the plugin's repo. Plugins reach this only through
 * the postMessage bridge in PluginFrame — they can neither choose the
 * namespace nor read the shell's own keys.
 */
const PREFIX = 'builder-shell.pdata.'

function nsKey(repo: string): string {
  return PREFIX + repo
}

function getAll(repo: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(nsKey(repo)) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function setKey(repo: string, key: string, value: string): void {
  const data = getAll(repo)
  data[key] = String(value)
  localStorage.setItem(nsKey(repo), JSON.stringify(data))
}

function removeKey(repo: string, key: string): void {
  const data = getAll(repo)
  delete data[key]
  localStorage.setItem(nsKey(repo), JSON.stringify(data))
}

export const pluginStore = { getAll, setKey, removeKey }
