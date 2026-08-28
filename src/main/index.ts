import { app, BrowserWindow, dialog, ipcMain, nativeImage, net, protocol, screen } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { pathToFileURL } from 'url'
import Store from 'electron-store'
import { IPC, type AppData, type CompactState, type Game, type GameMetadataRefresh, type GameRuntimeUpdate, type WindowBounds } from '../shared/types'

protocol.registerSchemesAsPrivileged([{ scheme: 'app-media', privileges: { standard: true, secure: true, corsEnabled: true, bypassCSP: true, supportFetchAPI: true, stream: true } }])

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

const mainMinWidth = 960
const mainMinHeight = 540
const defaultWindowBounds: WindowBounds = { x: 80, y: 80, width: 1600, height: 900 }
const store = new Store<AppData>({ defaults: { schemaVersion: 3, games: [], selectedGameId: null, isSidebarCollapsed: false, windowBounds: defaultWindowBounds } })
let mainWindow: BrowserWindow | null = null
let compactWindow: BrowserWindow | null = null
let lastWindowBounds: WindowBounds | null = null
let windowTransitioning = false
const mediaAssetDir = path.join(app.getPath('userData'), 'media')
const mediaExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.mp4', '.webm', '.mov', '.m4v', '.ogv'])
const runningGames = new Map<string, { startedAt: string }>()

const compactWidth = 472
const compactHeight = 72

function copyBounds(bounds: Electron.Rectangle): WindowBounds {
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
}

function clampWindowBounds(bounds: WindowBounds): WindowBounds {
  const display = screen.getAllDisplays().find((item) => {
    const area = item.workArea
    return bounds.x >= area.x && bounds.x < area.x + area.width && bounds.y >= area.y && bounds.y < area.y + area.height
  }) ?? screen.getPrimaryDisplay()
  const area = display.workArea
  const minWidth = Math.min(mainMinWidth, area.width)
  const minHeight = Math.min(mainMinHeight, area.height)
  const width = Math.max(minWidth, Math.min(bounds.width, area.width))
  const height = Math.max(minHeight, Math.min(bounds.height, area.height))
  return {
    width,
    height,
    x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))
  }
}

function rememberedBounds(): WindowBounds {
  const stored = store.get('windowBounds', defaultWindowBounds)
  return clampWindowBounds({
    x: Number.isFinite(stored?.x) ? stored.x : defaultWindowBounds.x,
    y: Number.isFinite(stored?.y) ? stored.y : defaultWindowBounds.y,
    width: Number.isFinite(stored?.width) ? stored.width : defaultWindowBounds.width,
    height: Number.isFinite(stored?.height) ? stored.height : defaultWindowBounds.height
  })
}

function rememberMainWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMaximized()) return
  lastWindowBounds = copyBounds(mainWindow.getBounds())
  store.set('windowBounds', lastWindowBounds)
}

function rememberCompactWindowPosition() {
  if (!compactWindow || compactWindow.isDestroyed()) return
  const bounds = compactWindow.getBounds()
  const mainBounds = lastWindowBounds ?? rememberedBounds()
  lastWindowBounds = { x: bounds.x, y: bounds.y, width: mainBounds.width, height: mainBounds.height }
  store.set('windowBounds', lastWindowBounds)
}

function compactInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function isVideoPath(mediaPath: string) {
  return ['.mp4', '.webm', '.mov', '.m4v', '.ogv'].includes(path.extname(mediaPath).toLowerCase())
}

function compactState(): CompactState {
  const data = loadData()
  const bounds = lastWindowBounds ?? rememberedBounds()
  return {
    games: data.games.map((game) => {
      const runtime = runningGames.get(game.id)
      const iconPath = game.thumbnailPath || game.carouselThumbnailPaths?.[0] || (game.logoPath && !isVideoPath(game.logoPath)
        ? game.logoPath
        : game.coverPath && !isVideoPath(game.coverPath) ? game.coverPath : undefined)
      const artworkPath = [game.coverPath, game.wallpaperPath, ...(game.carouselPaths ?? [])]
        .find((mediaPath): mediaPath is string => typeof mediaPath === 'string' && mediaPath.length > 0 && !isVideoPath(mediaPath))
      return {
        id: game.id,
        name: game.name,
        iconPath,
        artworkPath,
        accentColor: game.gameTheme?.accent || game.accentColor,
        initials: compactInitials(game.name),
        isRunning: Boolean(runtime),
        startedAt: runtime?.startedAt
      }
    }),
    selectedGameId: data.selectedGameId,
    runningGameIds: [...runningGames.keys()],
    bounds
  }
}

function normalizeGame(game: Partial<Game>): Game {
  return {
    id: String(game.id || ''),
    name: String(game.name || 'Untitled game'),
    exePath: String(game.exePath || ''),
    wallpaperPath: String(game.wallpaperPath || ''),
    carouselPaths: Array.isArray(game.carouselPaths) ? game.carouselPaths.map((path) => String(path)).filter(Boolean) : undefined,
    carouselSourcePaths: Array.isArray(game.carouselSourcePaths) ? game.carouselSourcePaths.map((path) => String(path)).filter(Boolean) : undefined,
    carouselThumbnailPaths: Array.isArray(game.carouselThumbnailPaths) ? game.carouselThumbnailPaths.map((path) => String(path)).filter(Boolean) : undefined,
    carouselSourceModifiedAt: typeof game.carouselSourceModifiedAt === 'string' ? game.carouselSourceModifiedAt : undefined,
    logoPath: game.logoPath ? String(game.logoPath) : undefined,
    thumbnailPath: game.thumbnailPath ? String(game.thumbnailPath) : undefined,
    accentColor: game.accentColor ? String(game.accentColor) : undefined,
    coverPath: game.coverPath ? String(game.coverPath) : undefined,
    coverPositionX: Number.isFinite(game.coverPositionX) ? Number(game.coverPositionX) : undefined,
    coverPositionY: Number.isFinite(game.coverPositionY) ? Number(game.coverPositionY) : undefined,
    wallpaperPosition: game.wallpaperPosition && typeof game.wallpaperPosition === 'object'
      ? {
          x: Number.isFinite(game.wallpaperPosition.x) ? Number(game.wallpaperPosition.x) : 50,
          y: Number.isFinite(game.wallpaperPosition.y) ? Number(game.wallpaperPosition.y) : 50
        }
      : undefined,
    gameTheme: game.gameTheme && typeof game.gameTheme === 'object' ? game.gameTheme : undefined,
    lastPlayedAt: typeof game.lastPlayedAt === 'string' ? game.lastPlayedAt : undefined,
    totalPlayTimeSeconds: Number.isFinite(game.totalPlayTimeSeconds) ? Math.max(0, Number(game.totalPlayTimeSeconds)) : 0,
    installSizeBytes: Number.isFinite(game.installSizeBytes) ? Math.max(0, Number(game.installSizeBytes)) : undefined,
    installSizeCheckedAt: typeof game.installSizeCheckedAt === 'string' ? game.installSizeCheckedAt : undefined,
    patchVersion: typeof game.patchVersion === 'string' ? game.patchVersion : undefined
  }
}

function loadData(): AppData {
  const games = store.get('games', []).map(normalizeGame).filter((game) => game.id)
  return { schemaVersion: 3, games, selectedGameId: store.get('selectedGameId', null), isSidebarCollapsed: store.get('isSidebarCollapsed', false), windowBounds: store.get('windowBounds', defaultWindowBounds), runningGameIds: [...runningGames.keys()] }
}

async function directorySize(root: string): Promise<number> {
  let total = 0
  let entries: fs.Dirent[]
  try { entries = await fs.promises.readdir(root, { withFileTypes: true }) } catch { return 0 }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) total += await directorySize(entryPath)
    else if (entry.isFile()) {
      try { total += (await fs.promises.stat(entryPath)).size } catch { /* Ignore files removed during scan. */ }
    }
  }
  return total
}

const installSizeCacheTtlMs = 24 * 60 * 60 * 1000

function normalizedName(value: string) {
  return value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '')
}

async function refreshGameMetadata(games: Game[]): Promise<GameMetadataRefresh[]> {
  const now = Date.now()
  const refreshed: GameMetadataRefresh[] = await Promise.all(games.map(async (game) => {
    const checkedAt = game.installSizeCheckedAt ? Date.parse(game.installSizeCheckedAt) : NaN
    if (!game.exePath || (Number.isFinite(checkedAt) && now - checkedAt < installSizeCacheTtlMs)) {
      return { gameId: game.id, installSizeBytes: undefined, installSizeCheckedAt: game.installSizeCheckedAt }
    }
    return {
      gameId: game.id,
      installSizeBytes: await directorySize(path.dirname(game.exePath)),
      installSizeCheckedAt: new Date(now).toISOString()
    }
  }))
  try {
    const response = await fetch('http://localhost:8788/api/planner-data')
    if (!response.ok) return refreshed
    const payload = await response.json() as { success?: boolean; data?: { games?: Array<{ name?: string; id?: string }>; versions?: Array<{ gameId?: string; version?: string; startDate?: string; endDate?: string }> } }
    const zenGames = payload.data?.games ?? []
    const versions = payload.data?.versions ?? []
    const today = new Date().toISOString().slice(0, 10)
    for (const item of refreshed) {
      const game = games.find((candidate) => candidate.id === item.gameId)
      const zenGame = zenGames.find((candidate) => normalizedName(candidate.name || '') === normalizedName(game?.name || ''))
      if (!zenGame?.id) continue
      const candidates = versions.filter((version) => version.gameId === zenGame.id && version.version)
      const active = candidates.find((version) => (version.startDate || '') <= today && (version.endDate || '') >= today)
      const latest = [...candidates].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))[0]
      item.patchVersion = (active || latest)?.version
    }
  } catch { /* Keep cached patch versions when Zenlentering is unavailable. */ }
  return refreshed
}

function saveRuntimeUpdate(update: GameRuntimeUpdate) {
  const games = store.get('games', []).map((game) => game.id === update.gameId ? normalizeGame({ ...game, lastPlayedAt: update.lastPlayedAt, totalPlayTimeSeconds: update.totalPlayTimeSeconds }) : normalizeGame(game))
  store.set('games', games)
}

interface MediaCopyResult { path: string; thumbnailPath?: string }

async function cloneMediaToAppStorage(mediaPath: string): Promise<MediaCopyResult> {
  if (!mediaPath || /^(data:|https?:|file:|blob:)/i.test(mediaPath)) return { path: mediaPath }
  const source = path.resolve(mediaPath)
  if (!fs.existsSync(source)) throw new Error('Không tìm thấy tệp media')
  const assetDir = path.resolve(mediaAssetDir)
  if (source.startsWith(`${assetDir}${path.sep}`)) return { path: source }
  await fs.promises.mkdir(assetDir, { recursive: true })
  const extension = path.extname(source).toLowerCase()
  const name = path.basename(source, extension).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60) || 'media'
  const stamp = `${Date.now()}-${name}`
  if (isVideoPath(source)) {
    const target = path.join(assetDir, `${stamp}${extension || '.mp4'}`)
    await fs.promises.copyFile(source, target)
    return { path: target }
  }
  const image = nativeImage.createFromPath(source)
  if (image.isEmpty()) throw new Error('Không thể đọc tệp hình ảnh')
  const size = image.getSize()
  const scale = Math.min(1, 1920 / size.width, 1080 / size.height)
  const optimized = scale < 1 ? image.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)), quality: 'good' }) : image
  const target = path.join(assetDir, `${stamp}${extension === '.png' ? '.png' : '.jpg'}`)
  await fs.promises.writeFile(target, extension === '.png' ? optimized.toPNG() : optimized.toJPEG(85))
  const thumbnailPath = path.join(assetDir, `${stamp}-thumb.png`)
  await fs.promises.writeFile(thumbnailPath, image.resize({ width: 128, quality: 'good' }).toPNG())
  return { path: target, thumbnailPath }
}

function compareMediaNames(left: string, right: string) {
  return path.basename(left).localeCompare(path.basename(right), undefined, { numeric: true, sensitivity: 'base' })
}

function gameCarouselDirectory(game: Game) {
  const folderName = game.name.trim()
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim() || game.id
  return path.join(app.getAppPath(), 'carousel', folderName)
}

async function syncGameCarousel(game: Game, force = false): Promise<Game> {
  if (!game.exePath) return game
  const carouselDirectory = gameCarouselDirectory(game)
  await fs.promises.mkdir(carouselDirectory, { recursive: true })
  const directoryModifiedAt = (await fs.promises.stat(carouselDirectory)).mtime.toISOString()
  const storedPathsAreAvailable = (game.carouselPaths ?? []).every((mediaPath) => /^(data:|https?:|file:|blob:)/i.test(mediaPath) || fs.existsSync(mediaPath))
  if (!force && game.carouselSourceModifiedAt === directoryModifiedAt && storedPathsAreAvailable) return game
  const entries = await fs.promises.readdir(carouselDirectory, { withFileTypes: true })
  const sourcePaths = entries
    .filter((entry) => entry.isFile() && mediaExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(carouselDirectory, entry.name))
    .sort(compareMediaNames)
  const previousSources = game.carouselSourcePaths ?? []
  const previousStored = game.carouselPaths ?? []
  const previousThumbnails = game.carouselThumbnailPaths ?? []
  const storedBySource = new Map(previousSources.map((source, index) => [path.normalize(source).toLowerCase(), previousStored[index]]))
  const thumbnailBySource = new Map(previousSources.map((source, index) => [path.normalize(source).toLowerCase(), previousThumbnails[index]]))
  const copiedMedia = await Promise.all(sourcePaths.map(async (sourcePath) => {
    const storedPath = storedBySource.get(path.normalize(sourcePath).toLowerCase())
    const storedThumbnail = thumbnailBySource.get(path.normalize(sourcePath).toLowerCase())
    if (storedPath && fs.existsSync(storedPath)) return { path: storedPath, thumbnailPath: storedThumbnail && fs.existsSync(storedThumbnail) ? storedThumbnail : undefined }
    return cloneMediaToAppStorage(sourcePath)
  }))
  const carouselPaths = copiedMedia.map((media) => media.path)
  const carouselThumbnailPaths = copiedMedia.map((media) => media.thumbnailPath || '')
  return normalizeGame({
    ...game,
    wallpaperPath: carouselPaths[0] ?? '',
    carouselPaths,
    carouselSourcePaths: sourcePaths,
    carouselThumbnailPaths,
    carouselSourceModifiedAt: directoryModifiedAt
  })
}

async function syncGamesCarousels(games: Game[]) {
  return Promise.all(games.map((game) => syncGameCarousel(game).catch(() => game)))
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  const bounds = clampWindowBounds(lastWindowBounds ?? rememberedBounds())
  mainWindow = new BrowserWindow({
    ...bounds, minWidth: mainMinWidth, minHeight: mainMinHeight, resizable: true, maximizable: true, fullscreenable: false, frame: false, transparent: true, show: false,
    webPreferences: { preload: path.join(__dirname, '../preload/index.js'), nodeIntegration: false, contextIsolation: true }
  })
  const currentWindow = mainWindow
  currentWindow.on('move', rememberMainWindowBounds)
  currentWindow.on('resize', rememberMainWindowBounds)
  currentWindow.on('closed', () => {
    if (mainWindow === currentWindow) mainWindow = null
  })
  currentWindow.once('ready-to-show', () => currentWindow.show())
  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) void currentWindow.loadURL(devServerUrl)
  else void currentWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  return currentWindow
}

function createCompactWindow() {
  if (compactWindow && !compactWindow.isDestroyed()) return compactWindow
  const bounds = lastWindowBounds ?? rememberedBounds()
  compactWindow = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: compactWidth, height: compactHeight,
    minWidth: compactWidth, maxWidth: compactWidth, minHeight: compactHeight, maxHeight: compactHeight,
    resizable: false, maximizable: false, minimizable: false, fullscreenable: false, frame: false, transparent: true, show: false,
    skipTaskbar: false,
    webPreferences: { preload: path.join(__dirname, '../preload-compact/compact.js'), nodeIntegration: false, contextIsolation: true }
  })
  const currentWindow = compactWindow
  currentWindow.on('move', rememberCompactWindowPosition)
  currentWindow.on('closed', () => {
    if (compactWindow === currentWindow) compactWindow = null
    if (!windowTransitioning && runningGames.size > 0 && !mainWindow) createMainWindow()
  })
  currentWindow.once('ready-to-show', () => currentWindow.show())
  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) void currentWindow.loadURL(new URL('compact.html', devServerUrl).toString())
  else void currentWindow.loadFile(path.join(__dirname, '../../dist/compact.html'))
  return currentWindow
}

function closeCompactWindow() {
  if (!compactWindow || compactWindow.isDestroyed()) return
  compactWindow.close()
  compactWindow = null
}

function restoreMainWindow(selectedGameId?: string) {
  windowTransitioning = true
  if (selectedGameId !== undefined) store.set('selectedGameId', selectedGameId)
  rememberCompactWindowPosition()
  closeCompactWindow()
  createMainWindow()
  windowTransitioning = false
}

app.whenReady().then(() => {
  protocol.handle('app-media', async (request) => {
    const url = new URL(request.url)
    const mediaPath = url.searchParams.get('path') || decodeURIComponent(url.pathname.slice(1))
    const resolvedPath = path.resolve(mediaPath)
    const extension = path.extname(resolvedPath).toLowerCase()
    if (!mediaExtensions.has(extension) || !fs.existsSync(resolvedPath)) return new Response(null, { status: 404 })
    return net.fetch(pathToFileURL(resolvedPath).toString())
  })
  createMainWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow() })
})
app.on('window-all-closed', () => { if (!windowTransitioning && process.platform !== 'darwin') app.quit() })

ipcMain.handle(IPC.LOAD_DATA, async () => {
  const data = loadData()
  const games = await syncGamesCarousels(data.games)
  store.set('games', games)
  return { ...data, games }
})
ipcMain.handle(IPC.SAVE_DATA, (_, data: Partial<AppData>) => {
  if (data.games) store.set('games', data.games.map(normalizeGame))
  if (data.selectedGameId !== undefined) store.set('selectedGameId', data.selectedGameId)
  if (data.isSidebarCollapsed !== undefined) store.set('isSidebarCollapsed', data.isSidebarCollapsed)
  return true
})
ipcMain.handle(IPC.PICK_EXE, async () => { const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters: [{ name: 'Tệp thực thi', extensions: ['exe'] }] }); return result.canceled ? null : result.filePaths[0] })
ipcMain.handle(IPC.PICK_WALLPAPER, async () => { const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters: [{ name: 'Media nền', extensions: [...mediaExtensions].map((extension) => extension.slice(1)) }] }); return result.canceled ? null : result.filePaths[0] })
ipcMain.handle(IPC.CLONE_IMAGE, async (_, mediaPath: string) => { try { return { success: true, ...await cloneMediaToAppStorage(mediaPath) } } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Không thể sao chép media' } } })
ipcMain.handle(IPC.REFRESH_GAME_METADATA, (_, games: Game[]) => refreshGameMetadata(games))
ipcMain.handle(IPC.SYNC_GAME_CAROUSEL, async (_, game: Game) => {
  const syncedGame = await syncGameCarousel(normalizeGame(game), true)
  const games = store.get('games', []).map((item) => item.id === syncedGame.id ? syncedGame : normalizeGame(item))
  store.set('games', games)
  return syncedGame
})
ipcMain.handle(IPC.LAUNCH_GAME, (_, gameId: string, exePath: string) => {
  if (!exePath || !fs.existsSync(exePath)) return { success: false, error: 'Không tìm thấy file game' }
  try {
    const startedAt = new Date().toISOString()
    const child = spawn(exePath, [], { cwd: path.dirname(exePath), detached: true, stdio: 'ignore' })
    runningGames.set(gameId, { startedAt })
    rememberMainWindowBounds()
    createCompactWindow()
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
    mainWindow = null
    const game = loadData().games.find((item) => item.id === gameId)
    if (game) saveRuntimeUpdate({ gameId, lastPlayedAt: startedAt, totalPlayTimeSeconds: game.totalPlayTimeSeconds })
    child.once('exit', () => {
      const runtime = runningGames.get(gameId)
      runningGames.delete(gameId)
      const current = loadData().games.find((item) => item.id === gameId)
      const finishedAt = Date.now()
      const startedAtMs = runtime ? Date.parse(runtime.startedAt) : finishedAt
      const totalPlayTimeSeconds = (current?.totalPlayTimeSeconds || 0) + Math.max(0, Math.round((finishedAt - startedAtMs) / 1000))
      const update: GameRuntimeUpdate = { gameId, lastPlayedAt: current?.lastPlayedAt || new Date(startedAtMs).toISOString(), totalPlayTimeSeconds }
      saveRuntimeUpdate(update)
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(IPC.GAME_EXITED, update)
      if (runningGames.size === 0 && compactWindow) restoreMainWindow()
      else compactWindow?.webContents.send(IPC.COMPACT_STATE, compactState())
    })
    child.unref()
    return { success: true, startedAt }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Không thể mở game' }
  }
})
ipcMain.on(IPC.WIN_MINIMIZE, () => mainWindow?.minimize())
ipcMain.on(IPC.WIN_TOGGLE_MAXIMIZE, () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.handle(IPC.WIN_SET_SIZE, (_, width: number, height: number) => {
  if (!mainWindow || mainWindow.isDestroyed()) return null
  if (!Number.isFinite(width) || !Number.isFinite(height)) return copyBounds(mainWindow.getBounds())
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  const current = mainWindow.getBounds()
  const display = screen.getDisplayMatching(current)
  const area = display.workArea
  const targetWidth = Math.max(Math.min(mainMinWidth, area.width), Math.min(Math.round(width), area.width))
  const targetHeight = Math.max(Math.min(mainMinHeight, area.height), Math.min(Math.round(height), area.height))
  const nextBounds = clampWindowBounds({
    width: targetWidth,
    height: targetHeight,
    x: Math.round(current.x + (current.width - targetWidth) / 2),
    y: Math.round(current.y + (current.height - targetHeight) / 2)
  })
  mainWindow.setBounds(nextBounds, true)
  rememberMainWindowBounds()
  return copyBounds(mainWindow.getBounds())
})
ipcMain.handle(IPC.WIN_FIT_WORKAREA, () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  const display = screen.getDisplayMatching(mainWindow.getBounds())
  const area = display.workArea
  const margin = Math.min(24, Math.max(8, Math.round(Math.min(area.width, area.height) * 0.015)))
  const nextBounds: WindowBounds = {
    x: area.x + margin,
    y: area.y + margin,
    width: Math.max(Math.min(mainMinWidth, area.width), area.width - margin * 2),
    height: Math.max(Math.min(mainMinHeight, area.height), area.height - margin * 2)
  }
  mainWindow.setBounds(nextBounds, true)
  rememberMainWindowBounds()
  return copyBounds(mainWindow.getBounds())
})
ipcMain.on(IPC.WIN_CLOSE, () => mainWindow?.close())
ipcMain.handle(IPC.COMPACT_GET_STATE, () => compactState())
ipcMain.handle(IPC.COMPACT_SELECT_GAME, (_, gameId: string) => {
  if (!loadData().games.some((game) => game.id === gameId)) return false
  restoreMainWindow(gameId)
  return true
})
ipcMain.handle(IPC.COMPACT_EXPAND, () => {
  restoreMainWindow()
  return true
})
