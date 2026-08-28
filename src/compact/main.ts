import type { CompactGame, CompactState } from '../shared/types'
import './styles.css'

const shell = document.querySelector<HTMLElement>('#compact-shell')
const gamesRoot = document.querySelector<HTMLDivElement>('#compact-games')
const expandButton = document.querySelector<HTMLButtonElement>('#compact-expand')
const activeArt = document.querySelector<HTMLSpanElement>('#compact-art')
const activeName = document.querySelector<HTMLElement>('#compact-name')
const activeRuntime = document.querySelector<HTMLElement>('#compact-runtime')

const icon = (path: string) => `<svg viewBox="0 0 16 16" width="18" height="18" fill="none" aria-hidden="true"><path d="${path}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`
const expandIcon = icon('M5 3.5h7.5V11M11.8 4.2 4.5 11.5M3.5 6.2V12.5h6.3')
const imageUrl = (path: string) => /^(data:|https?:|blob:|app-media:)/i.test(path) ? path : `app-media://local/media?path=${encodeURIComponent(path)}`
let latestState: CompactState | null = null

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function elapsedLabel(startedAt?: string) {
  if (!startedAt) return 'ĐANG CHẠY'
  const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000))
  const hours = Math.floor(elapsed / 3600)
  const minutes = Math.floor((elapsed % 3600) / 60)
  const seconds = elapsed % 60
  const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
  return `ĐANG CHẠY · ${clock}`
}

function activeGame(state: CompactState) {
  return state.games.find((game) => game.id === state.selectedGameId && game.isRunning)
    ?? state.games.find((game) => game.isRunning)
    ?? state.games.find((game) => game.id === state.selectedGameId)
    ?? state.games[0]
}

function renderActive(game?: CompactGame) {
  if (!game) {
    if (activeName) activeName.textContent = 'Launcher'
    if (activeRuntime) activeRuntime.textContent = 'SẴN SÀNG'
    if (activeArt) { activeArt.replaceChildren(); activeArt.textContent = 'HX' }
    shell?.style.removeProperty('--compact-accent')
    return
  }
  if (activeName) activeName.textContent = game.name
  if (activeRuntime) activeRuntime.textContent = game.isRunning ? elapsedLabel(game.startedAt) : 'SẴN SÀNG'
  shell?.style.setProperty('--compact-accent', game.accentColor || '#8ea2ff')
  if (!activeArt) return
  activeArt.replaceChildren()
  const artworkPath = game.artworkPath || game.iconPath
  if (!artworkPath) {
    activeArt.textContent = game.initials || initials(game.name)
    return
  }
  const image = document.createElement('img')
  image.src = imageUrl(artworkPath)
  image.alt = ''
  image.draggable = false
  image.addEventListener('error', () => { activeArt.replaceChildren(); activeArt.textContent = game.initials || initials(game.name) }, { once: true })
  activeArt.append(image)
}

function renderGame(game: CompactGame, selectedGameId: string | null) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `compact-game${game.id === selectedGameId ? ' is-selected' : ''}${game.isRunning ? ' is-running' : ''}`
  button.setAttribute('aria-label', `Mở ${game.name}`)
  button.setAttribute('aria-pressed', String(game.id === selectedGameId))
  button.title = game.isRunning ? `${game.name} · Đang chạy` : game.name
  if (game.accentColor) button.style.setProperty('--game-accent', game.accentColor)
  const iconRoot = document.createElement('span')
  iconRoot.className = 'compact-game__icon'
  if (game.iconPath) {
    const image = document.createElement('img')
    image.src = imageUrl(game.iconPath)
    image.alt = ''
    image.draggable = false
    image.addEventListener('error', () => { image.replaceWith(document.createTextNode(game.initials || initials(game.name))) }, { once: true })
    iconRoot.append(image)
  } else {
    iconRoot.textContent = game.initials || initials(game.name)
  }
  button.append(iconRoot)
  if (game.isRunning) {
    const status = document.createElement('span')
    status.className = 'compact-game__running'
    status.setAttribute('aria-label', 'Đang chạy')
    button.append(status)
  }
  button.addEventListener('click', () => { void window.compactAPI.selectGame(game.id) })
  return button
}

function render(state: CompactState) {
  latestState = state
  const current = activeGame(state)
  renderActive(current)
  if (!gamesRoot) return
  const otherGames = state.games.filter((game) => game.id !== current?.id)
  gamesRoot.replaceChildren(...otherGames.map((game) => renderGame(game, state.selectedGameId)))
  gamesRoot.hidden = otherGames.length === 0
}

expandButton?.append(new DOMParser().parseFromString(expandIcon, 'image/svg+xml').documentElement)
expandButton?.addEventListener('click', () => { void window.compactAPI.expand() })

window.setInterval(() => {
  if (!latestState || !activeRuntime) return
  const current = activeGame(latestState)
  if (current?.isRunning) activeRuntime.textContent = elapsedLabel(current.startedAt)
}, 1000)

void window.compactAPI.getState().then(render)
window.compactAPI.onStateChanged(render)
