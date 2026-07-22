# builder-shell — Design Doc

**Date:** 2026-07-22
**Status:** Approved design, ready for implementation planning

## Summary

builder-shell is a **self-extending, backendless web app**. You sign in with
GitHub, chat with Claude, and ask it to build mini-apps ("plugins"). Each plugin
becomes a **new GitHub repository** served by GitHub Pages, which the app
discovers and loads directly from GitHub. There is no server to deploy or
maintain: the app is static files on GitHub Pages, and all privileged calls go
straight from the browser to two third-party APIs (GitHub REST and the Anthropic
API).

## Guiding constraint: no backend

"No backend" is achievable only because **every secret lives in the user's own
browser**, provided by the user:

- A GitHub **fine-grained Personal Access Token (PAT)**, pasted once, stored in
  `localStorage`.
- An **Anthropic API key**, pasted once, stored in `localStorage`.

This makes builder-shell a **personal / single-user developer tool**, not a
public multi-tenant product — there is no server to hide shared credentials
behind, and the app cannot pay for other users' Claude usage. This is an
accepted, explicit trade-off.

## Non-goals (YAGNI)

- No OAuth "Sign in with GitHub" popup (would require a token-exchange endpoint =
  a backend). PAT paste is the login.
- No Claude access *inside* plugins. Claude is used only to **generate** plugins;
  generated plugins are static pages with no AI at runtime.
- No private plugin repos. Plugins are **public** (required for free GitHub Pages
  and direct loading on personal accounts).
- No central plugin database. GitHub itself is the registry.
- No self-rewriting of the shell app. The shell is stable; it only spawns and
  loads plugins.

## Architecture

```
┌─────────────────────────── Browser (the Shell SPA) ───────────────────────────┐
│                                                                                │
│  ┌───────────┐   ┌────────────────┐   ┌──────────────────────────────────┐    │
│  │ Chat panel│   │ Plugin gallery │   │ Plugin host (<iframe sandbox>)   │    │
│  └─────┬─────┘   └───────┬────────┘   └──────────────┬───────────────────┘    │
│        │                 │                           │ postMessage           │
│  ┌─────▼─────────────────▼───────────────────────────▼───────────────────┐    │
│  │  Core services:  AuthStore · AnthropicClient · GitHubClient · Registry │    │
│  └─────┬──────────────────────────────────┬──────────────────────────────┘    │
│        │ x-api-key (localStorage)          │ PAT (localStorage)                │
└────────┼──────────────────────────────────┼───────────────────────────────────┘
         ▼                                   ▼
   api.anthropic.com                    api.github.com  ──►  *.github.io (plugin pages)
```

- **Stack:** Vue 3 + Vite + TypeScript. The shell is itself a static SPA deployed
  to its own GitHub Pages repo — so even the shell is backendless.
- **Plugin isolation:** each plugin runs in an `<iframe>` pointed at its GitHub
  Pages URL, sandboxed so it cannot read the shell's tokens.

## Core services (isolated modules)

Each service has one purpose, a clear interface, and is unit-testable in
isolation against mocked `fetch` / `localStorage`.

### AuthStore

- Persists `githubPat` and `anthropicApiKey` in `localStorage`.
- Settings screen to paste/clear each credential.
- Validates the PAT via `GET /user`; exposes the resolved GitHub `login`
  (username) and avatar. This is "the login."
- Exposes reactive `isReady` (both credentials present & PAT valid). The rest of
  the app is gated behind `isReady`.
- **Depends on:** `localStorage`, `GitHubClient` (for `GET /user`).

### AnthropicClient

- Wraps `POST https://api.anthropic.com/v1/messages`.
- Required headers: `x-api-key: <key>`, `anthropic-version: 2023-06-01`, and
  `anthropic-dangerous-direct-browser-access: true` (enables cross-origin browser
  calls).
- Streams responses (SSE) so the chat renders incrementally.
- Model selector: `claude-opus-4-8` (default), `claude-sonnet-5`,
  `claude-haiku-4-5`.
- Handles `stop_reason: "refusal"` and `max_tokens` stop reasons gracefully.
- **Depends on:** `AuthStore` (api key), `fetch`.

### GitHubClient

Thin wrapper over the GitHub REST API using the PAT (`Authorization: Bearer
<pat>`, `Accept: application/vnd.github+json`). GitHub's REST API sends CORS
headers, so the browser can call it directly. Methods:

- `getUser()` → `GET /user`
- `createRepo(name, description)` → `POST /user/repos` (`auto_init: true`,
  `private: false`)
- `putFile(repo, path, contentBase64, message)` → `PUT /repos/{owner}/{repo}/contents/{path}`
- `addTopic(repo, "claude-plugin")` → `PUT /repos/{owner}/{repo}/topics`
- `enablePages(repo)` → `POST /repos/{owner}/{repo}/pages` (source: default
  branch, root)
- `getPagesStatus(repo)` → `GET /repos/{owner}/{repo}/pages` (poll `status` until
  `built`)
- `searchPluginRepos(login)` → `GET /search/repositories?q=user:{login}+topic:claude-plugin`
- `getFile(repo, path)` → `GET /repos/{owner}/{repo}/contents/{path}` (for
  `plugin.json`)
- **Depends on:** `AuthStore` (PAT), `fetch`.

### Registry

- Calls `searchPluginRepos(login)`, then `getFile(repo, "plugin.json")` for each,
  parses & validates the manifest, and exposes a reactive `plugins` list to the
  gallery.
- Skips repos with a missing/invalid `plugin.json` (logs a warning; never
  crashes the gallery).
- Computes each plugin's live URL: `https://{login}.github.io/{repo}/{entry}`.
- **Depends on:** `GitHubClient`, `AuthStore` (login).

## Required PAT scopes

The user must create a **fine-grained PAT** granting, on their own account:

- **Administration: Read and write** (create repos + enable Pages)
- **Contents: Read and write** (commit files, read `plugin.json`)
- **Pages: Read and write** (enable/inspect Pages builds)

The settings screen documents these explicitly with a link to GitHub's token
creation page.

## The "build a plugin" flow

1. User describes a mini-app in the chat panel.
2. `AnthropicClient` prompts Claude to return, as structured output:
   - a single **self-contained `index.html`** (all CSS/JS inline, no build step,
     no external requests — ideal for iframe hosting), and
   - a **`plugin.json`** manifest.
3. Shell shows a preview + confirm step ("Create repo `<name>`?").
4. On confirm, `GitHubClient`:
   1. `createRepo(name)` (public, auto-init)
   2. `putFile(index.html)`, `putFile(plugin.json)`
   3. `addTopic("claude-plugin")`
   4. `enablePages()`
5. Shell polls `getPagesStatus` until `built` (with a timeout + retry), then
   `Registry` refreshes and the plugin appears in the gallery.
6. Clicking a plugin mounts its Pages URL in the iframe host.

### `plugin.json` schema

```json
{
  "name": "Pomodoro Timer",
  "description": "A minimal focus timer",
  "emoji": "🍅",
  "entry": "index.html"
}
```

`name`, `entry` required; `description`, `emoji` optional (with defaults).

## Plugin isolation & communication

- iframe attribute: `sandbox="allow-scripts"` — **no** `allow-same-origin`, so
  the plugin runs in an opaque origin and cannot reach the shell's `localStorage`
  or tokens.
- Minimal `postMessage` contract (static plugins only — no Claude access):
  - **Plugin → shell:** `{type: "ready"}`, `{type: "resize", height: number}`
  - **Shell → plugin:** `{type: "theme", value: "light" | "dark"}`
- The shell validates `event.origin` against the expected `{login}.github.io`
  before acting on any message.

## Error handling

- **Credentials:** missing/invalid PAT or API key → the app renders only the
  gated settings screen until `AuthStore.isReady`.
- **GitHub:** rate-limit (`403` + `X-RateLimit-Remaining: 0`) and Pages-build
  failures are surfaced inline with a retry action; repo-name collisions prompt
  for a new name.
- **Anthropic:** `refusal` and `max_tokens` stop reasons shown as friendly
  messages; network errors retryable.
- **Registry:** a bad `plugin.json` skips that one plugin, never the whole list.

## Testing

- **Vitest unit tests** for:
  - `Registry` manifest parsing (valid, missing fields, malformed JSON).
  - The `postMessage` contract (origin validation, resize/theme handling).
  - `GitHubClient` and `AnthropicClient` against mocked `fetch` (happy path +
    error codes).
  - `AuthStore` gating logic against mocked `localStorage`.
- **No** live-GitHub E2E in CI (would require real credentials and mutate real
  repos). A manual smoke-test checklist covers the end-to-end create→load flow.

## Open risks / notes

- Browser-held secrets are inherent to "no backend"; documented as a personal-tool
  trade-off. A future variant could add one tiny OAuth serverless function if a
  polished multi-user login is ever wanted.
- GitHub Pages first-build latency can be tens of seconds; the create flow must
  communicate "building…" clearly rather than appear hung.
- Fine-grained PAT propagation for a *newly created* repo can lag briefly;
  `putFile`/`enablePages` may need a short retry after `createRepo`.
