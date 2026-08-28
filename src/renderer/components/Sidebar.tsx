import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useStore } from '../../store/useStore'
import { getGameTheme } from '../../shared/gameAccent'
import { toFileUrl } from '../lib/wallpaperCache'
import { isVideoAsset } from '../lib/media'
import Icon from './Icon'
import './Sidebar.css'

export default function Sidebar() {
  const games = useStore((state) => state.games)
  const selectedGameId = useStore((state) => state.selectedGameId)
  const isCollapsed = useStore((state) => state.isSidebarCollapsed)
  const runningGameIds = useStore((state) => state.runningGameIds)
  const selectGame = useStore((state) => state.selectGame)
  const setSidebarCollapsed = useStore((state) => state.setSidebarCollapsed)
  const setAddModalOpen = useStore((state) => state.setAddModalOpen)
  const listRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  useLayoutEffect(() => {
    const list = listRef.current
    const active = selectedGameId ? itemRefs.current[selectedGameId] : null
    if (!list || !active) return
    list.style.setProperty('--active-highlight-y', `${active.offsetTop}px`)
    list.style.setProperty('--active-highlight-height', `${active.offsetHeight}px`)
  }, [games, selectedGameId, isCollapsed])

  return (
    <aside className="game-sidebar" data-collapsed={isCollapsed} aria-label="Thư viện game">
      <div className="game-sidebar__header">
        <span className="game-sidebar__header-label">GAME LIBRARY</span>
        <button
          type="button"
          className="game-sidebar__toggle"
          aria-label={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          aria-expanded={!isCollapsed}
          onClick={() => void setSidebarCollapsed(!isCollapsed)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d={isCollapsed ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <nav ref={listRef} className="game-sidebar__list">
        <span className="game-sidebar__active-highlight" aria-hidden="true" />
        {games.map((game) => (
          <button
            key={game.id}
            type="button"
            className="game-sidebar__item"
            data-active={game.id === selectedGameId}
            data-running={runningGameIds.includes(game.id)}
            style={{ '--game-accent': (game.gameTheme ?? getGameTheme(game.name, game.accentColor)).accent } as CSSProperties}
            ref={(element) => { itemRefs.current[game.id] = element }}
            aria-label={game.name}
            data-tooltip={game.name}
            onClick={() => void selectGame(game.id)}
          >
            <span className="game-sidebar__icon" aria-hidden="true">
              {(game.thumbnailPath || game.logoPath || (game.coverPath && !isVideoAsset(game.coverPath)))
                ? <img className={game.logoPath ? 'is-logo' : undefined} src={toFileUrl(game.thumbnailPath || game.logoPath || game.coverPath || '')} alt="" draggable={false} />
                : initials(game.name)}
            </span>
            <span className="game-sidebar__name">{game.name}</span>
            {runningGameIds.includes(game.id) && <span className="game-sidebar__running" aria-label="Đang chạy" title="Đang chạy" />}
          </button>
        ))}
      </nav>
      <button type="button" className="game-sidebar__add" title="Thêm game" onClick={() => setAddModalOpen(true)}>
        <Icon name="plus" size={17} />
        <span className="game-sidebar__add-label">Thêm game</span>
      </button>
    </aside>
  )
}
