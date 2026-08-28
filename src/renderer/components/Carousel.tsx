import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useStore } from '../../store/useStore'
import { formatInstallSize, formatLastPlayed, formatPlayTime } from '../lib/gameMetadata'
import Icon from './Icon'
import './Carousel.css'

const logoUrl = new URL('../../../logo.png', import.meta.url).href

export default function Carousel({ onParallaxMove, onParallaxLeave, carouselPaths, carouselIndex, onCarouselSelect, onCarouselPause }: { onParallaxMove: (event: PointerEvent<HTMLElement>) => void; onParallaxLeave: () => void; carouselPaths: string[]; carouselIndex: number; onCarouselSelect: (index: number) => void; onCarouselPause: (paused: boolean) => void }) {
  const games = useStore((state) => state.games)
  const selectedGameId = useStore((state) => state.selectedGameId)
  const setAddModalOpen = useStore((state) => state.setAddModalOpen)
  const openEditGame = useStore((state) => state.openEditGame)
  const removeGame = useStore((state) => state.removeGame)
  const playGame = useStore((state) => state.playGame)
  const runningGameIds = useStore((state) => state.runningGameIds)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPlayShining, setIsPlayShining] = useState(true)
  const [hasPlayHovered, setHasPlayHovered] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchError, setLaunchError] = useState('')
  const deleteDialogRef = useRef<HTMLDivElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const game = games.find((item) => item.id === selectedGameId)

  useEffect(() => {
    if (!deleteOpen) return
    cancelDeleteRef.current?.focus()
    const dialog = deleteDialogRef.current
    if (!dialog) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setDeleteOpen(false)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener('keydown', handleKeyDown)
    return () => dialog.removeEventListener('keydown', handleKeyDown)
  }, [deleteOpen])

  useEffect(() => {
    if (!isPlayShining) return
    const timeout = window.setTimeout(() => setIsPlayShining(false), 900)
    return () => window.clearTimeout(timeout)
  }, [isPlayShining])

  if (!game) return <div className="hero-empty"><img className="hero-empty__logo" src={logoUrl} alt="" /><p>Chưa có game nào</p><button type="button" onClick={() => setAddModalOpen(true)}><Icon name="plus" size={17} /> Thêm game</button></div>

  const isRunning = runningGameIds.includes(game.id)
  const launchState = isLaunching ? 'launching' : isRunning ? 'running' : 'idle'

  const updateSpotlight = (event: PointerEvent<HTMLElement>) => {
    const hero = event.currentTarget
    const bounds = hero.getBoundingClientRect()
    hero.style.setProperty('--mouse-x', `${event.clientX - bounds.left}px`)
    hero.style.setProperty('--mouse-y', `${event.clientY - bounds.top}px`)
  }
  const resetSpotlight = (event: PointerEvent<HTMLElement>) => {
    const hero = event.currentTarget
    hero.style.setProperty('--mouse-x', '50%')
    hero.style.setProperty('--mouse-y', '42%')
  }
  const updatePlayMagnet = (event: PointerEvent<HTMLButtonElement>) => {
    const button = event.currentTarget
    const bounds = button.getBoundingClientRect()
    const x = Math.max(-3, Math.min(3, ((event.clientX - (bounds.left + bounds.width / 2)) / bounds.width) * 6))
    const y = Math.max(-3, Math.min(3, ((event.clientY - (bounds.top + bounds.height / 2)) / bounds.height) * 6))
    button.style.setProperty('--magnet-x', `${x}px`)
    button.style.setProperty('--magnet-y', `${y}px`)
  }
  const resetPlayMagnet = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.style.setProperty('--magnet-x', '0px')
    event.currentTarget.style.setProperty('--magnet-y', '0px')
  }
  const triggerFirstHoverShine = () => {
    if (hasPlayHovered) return
    setHasPlayHovered(true)
    setIsPlayShining(true)
  }
  const launch = async () => {
    if (isLaunching) return
    setLaunchError('')
    setIsLaunching(true)
    await new Promise((resolve) => window.setTimeout(resolve, 280))
    let result: { success: boolean; error?: string }
    try {
      result = await playGame(game.id)
    } catch {
      result = { success: false, error: 'Không thể mở game' }
    }
    if (!result.success) {
      setIsLaunching(false)
      setLaunchError(result.error || 'Không thể mở game')
      window.setTimeout(() => setLaunchError(''), 3500)
      return
    }
    window.setTimeout(() => setIsLaunching(false), 180)
  }

  return <section key={game.id} className={`game-hero${isLaunching ? ' game-hero--launching' : ''}`} aria-label={`Game ${game.name}`} onPointerMove={(event) => { updateSpotlight(event); onParallaxMove(event) }} onPointerLeave={(event) => { resetSpotlight(event); onParallaxLeave() }}>
    <div className="game-hero__accent" aria-hidden="true" />
    <div className="game-hero__spotlight" aria-hidden="true" />
    <div className="game-hero__grain" aria-hidden="true" />
    <div className="game-hero__content">
      <h1 className="game-hero__title">{game.name}</h1>
      <div className="game-hero__metadata" aria-label="Thông tin game">
        <span title="Lần chơi gần nhất"><Icon name="clock" size={15} />{formatLastPlayed(game.lastPlayedAt)}</span>
        <span title="Tổng thời gian chơi"><Icon name="timer" size={15} />{formatPlayTime(game.totalPlayTimeSeconds)}</span>
        <span title="Dung lượng cài đặt"><Icon name="storage" size={15} />{formatInstallSize(game.installSizeBytes)}</span>
        <span title="Phiên bản patch"><Icon name="hash" size={15} />{game.patchVersion || '—'}</span>
      </div>
      <div className="game-hero__actions game-hero__actions--reveal">
        <button type="button" className={`game-hero__play${isPlayShining ? ' is-shining' : ''}`} data-launch-state={launchState} onClick={() => void launch()} onPointerEnter={triggerFirstHoverShine} onPointerMove={updatePlayMagnet} onPointerLeave={resetPlayMagnet} disabled={isLaunching || isRunning} aria-busy={isLaunching}>
          {launchState === 'launching' && <><span className="game-hero__spinner" aria-hidden="true" /><span className="game-hero__launch-label">KHỞI ĐỘNG</span></>}
          {launchState === 'running' && <><span className="game-hero__running-dot" aria-hidden="true" /><span className="game-hero__launch-label">ĐANG CHẠY</span></>}
          {launchState === 'idle' && <><Icon name="play" size={15} /> PLAY</>}
        </button>
        <div className="game-hero__menu-wrap">
          <button type="button" className="game-hero__more" aria-label="Tùy chọn game" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><Icon name="more" size={18} /></button>
          {menuOpen && <div className="game-hero__menu">
            <button type="button" onClick={() => { setMenuOpen(false); openEditGame(game.id) }}>Sửa</button>
            <button type="button" onClick={() => { setMenuOpen(false); setDeleteOpen(true) }}>Xóa</button>
          </div>}
        </div>
      </div>
    </div>
    {carouselPaths.length > 1 && <div className="game-hero__carousel" aria-label="Wallpaper carousel" onPointerEnter={() => onCarouselPause(true)} onPointerLeave={() => onCarouselPause(false)}>
      <span className="game-hero__carousel-count">{String(carouselIndex + 1).padStart(2, '0')}</span>
      <div className="game-hero__carousel-segments">
        {carouselPaths.map((path, index) => <button key={path} type="button" className={`game-hero__carousel-segment${index === carouselIndex ? ' is-active' : ''}`} aria-label={`Hiển thị ảnh ${index + 1}`} aria-pressed={index === carouselIndex} onClick={() => onCarouselSelect(index)}><span /></button>)}
      </div>
    </div>}
    {launchError && <div className="game-hero__toast" role="status">{launchError}</div>}
    {deleteOpen && <div className="crud-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-game-title">
      <div ref={deleteDialogRef} tabIndex={-1}><h2 id="delete-game-title">Xóa {game.name}?</h2><p>Game này sẽ bị xóa khỏi launcher.</p><div className="crud-confirm__actions"><button ref={cancelDeleteRef} type="button" onClick={() => setDeleteOpen(false)}>Hủy</button><button type="button" className="crud-confirm__destructive" onClick={() => { void removeGame(game.id); setDeleteOpen(false) }}>Xóa</button></div></div>
    </div>}
  </section>
}
