import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useStore } from '../store/useStore'
import { getGameTheme } from '../shared/gameAccent'
import TopBar from './components/TopBar'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import AddGameModal from './components/AddGameModal'
import WallpaperLayer from './components/WallpaperLayer'
import './App.css'

const logoUrl = new URL('../../logo.png', import.meta.url).href

export default function App() {
  const initData = useStore((state) => state.initData)
  const games = useStore((state) => state.games)
  const selectedGameId = useStore((state) => state.selectedGameId)
  const isLoading = useStore((state) => state.isLoading)
  const isAddModalOpen = useStore((state) => state.isAddModalOpen)
  const selectedGame = games.find((game) => game.id === selectedGameId)
  const gameTheme = selectedGame?.gameTheme ?? (selectedGame ? getGameTheme(selectedGame.name, selectedGame.accentColor) : getGameTheme('default'))
  const appRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  const [isWallpaperIdle, setIsWallpaperIdle] = useState(false)
  const [wallpaperBrightness, setWallpaperBrightness] = useState<number | null>(null)
  const [carouselAccent, setCarouselAccent] = useState<string | null>(null)
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => !document.hidden)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [isCarouselPaused, setIsCarouselPaused] = useState(false)
  const carouselPaths = selectedGame
    ? Array.from(new Set((selectedGame.carouselPaths?.length ? selectedGame.carouselPaths : [selectedGame.wallpaperPath, selectedGame.coverPath]).filter((path): path is string => Boolean(path))))
    : []
  const carouselKey = carouselPaths.join('|')
  const carouselLength = carouselPaths.length
  const activeCarouselPath = carouselPaths[carouselIndex] ?? null

  useEffect(() => { void initData() }, [initData])

  useEffect(() => {
    const syncVisibility = () => setIsDocumentVisible(!document.hidden)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => document.removeEventListener('visibilitychange', syncVisibility)
  }, [])

  useEffect(() => { setCarouselIndex(0); setIsCarouselPaused(false) }, [selectedGameId])

  useEffect(() => { setWallpaperBrightness(null) }, [carouselKey])
  useEffect(() => { setCarouselAccent(null) }, [activeCarouselPath, selectedGameId])

  useEffect(() => {
    if (!isDocumentVisible || carouselLength < 2 || isCarouselPaused || isAddModalOpen) return
    const timer = window.setInterval(() => setCarouselIndex((index) => (index + 1) % carouselLength), 7000)
    return () => window.clearInterval(timer)
  }, [carouselKey, carouselLength, isCarouselPaused, isAddModalOpen, isDocumentVisible])

  const animateParallax = useCallback(() => {
    if (document.hidden) return
    if (rafRef.current !== null) return
    const tick = () => {
      rafRef.current = null
      const root = appRef.current
      if (!root) return
      const target = isAddModalOpen ? { x: 0, y: 0 } : pointerRef.current
      const current = currentRef.current
      current.x += (target.x - current.x) * 0.18
      current.y += (target.y - current.y) * 0.18
      root.style.setProperty('--parallax-wallpaper-x', `${current.x * -10}px`)
      root.style.setProperty('--parallax-wallpaper-y', `${current.y * -10}px`)
      if (Math.abs(target.x - current.x) > 0.001 || Math.abs(target.y - current.y) > 0.001) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [isAddModalOpen])

  useEffect(() => {
    if (isDocumentVisible) return
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    setIsWallpaperIdle(true)
  }, [isDocumentVisible])

  useEffect(() => {
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    setIsWallpaperIdle(false)
    if (isAddModalOpen) {
      pointerRef.current = { x: 0, y: 0 }
      animateParallax()
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    }
  }, [isAddModalOpen, animateParallax])

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (isAddModalOpen) return
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    setIsWallpaperIdle(false)
    pointerRef.current = { x: (event.clientX / window.innerWidth) - 0.5, y: (event.clientY / window.innerHeight) - 0.5 }
    animateParallax()
  }

  const handlePointerLeave = () => {
    if (isAddModalOpen) return
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    pointerRef.current = { x: 0, y: 0 }
    animateParallax()
    idleTimerRef.current = window.setTimeout(() => setIsWallpaperIdle(true), 4000)
  }

  if (isLoading) return <div className="launcher-loading"><div className="launcher-loading__mark"><img src={logoUrl} alt="" /><span /></div><strong>Đang tải launcher…</strong></div>

  const baseOverlayStrength = gameTheme.overlayStrength
  const overlayStrength = wallpaperBrightness === null
    ? baseOverlayStrength
    : Math.min(.98, Math.max(.78, baseOverlayStrength + (wallpaperBrightness - .5) * .22))

  return (
    <div ref={appRef} className="app-root" data-power-save={!isDocumentVisible} style={{ '--accent-color': gameTheme.accent, '--accent-soft': gameTheme.accentSoft, '--carousel-accent': carouselAccent ?? gameTheme.accent, '--overlay-strength': overlayStrength } as CSSProperties}>
      <WallpaperLayer gameId={selectedGame?.id ?? null} wallpaperPath={activeCarouselPath} wallpaperPosition={selectedGame?.wallpaperPosition} isIdle={isWallpaperIdle} isActive={isDocumentVisible} onImageBrightnessChange={setWallpaperBrightness} onImageAccentChange={setCarouselAccent} />
      <div className="app-readability-overlay" />
      <div className="app-content">
        <TopBar />
        <div className="app-body">
          <Sidebar />
          <main><Home onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave} carouselPaths={carouselPaths} carouselIndex={carouselIndex} onCarouselSelect={setCarouselIndex} onCarouselPause={setIsCarouselPaused} /></main>
        </div>
      </div>
      <AddGameModal />
    </div>
  )
}
