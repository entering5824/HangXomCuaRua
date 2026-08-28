import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useStore } from '../../store/useStore'
import { toFileUrl } from '../lib/wallpaperCache'
import { isVideoAsset } from '../lib/media'
import Icon from './Icon'
import './AddGameModal.css'

function MediaThumb({ path, label, className = 'media-picker__thumb', style, autoPlay = false }: { path: string; label: string; className?: string; style?: CSSProperties; autoPlay?: boolean }) {
  if (!path) return <div className="media-picker__empty">Chưa chọn</div>
  const src = toFileUrl(path)
  return isVideoAsset(path)
    ? <video className={className} src={src} muted loop autoPlay={autoPlay} preload={autoPlay ? 'metadata' : 'none'} playsInline draggable={false} aria-label={label} style={style} onDragStart={(event) => event.preventDefault()} />
    : <img className={className} src={src} alt={label} draggable={false} style={style} onDragStart={(event) => event.preventDefault()} />
}

export default function AddGameModal() {
  const isOpen = useStore((state) => state.isAddModalOpen)
  const editingGameId = useStore((state) => state.editingGameId)
  const games = useStore((state) => state.games)
  const addGame = useStore((state) => state.addGame)
  const updateGame = useStore((state) => state.updateGame)
  const syncGameCarousel = useStore((state) => state.syncGameCarousel)
  const close = useStore((state) => state.closeGameModal)
  const game = games.find((item) => item.id === editingGameId)
  const [name, setName] = useState('')
  const [exePath, setExePath] = useState('')
  const [carouselPaths, setCarouselPaths] = useState<string[]>([])
  const [selectedCarouselIndex, setSelectedCarouselIndex] = useState(0)
  const [logoPath, setLogoPath] = useState('')
  const [wallpaperPosition, setWallpaperPosition] = useState({ x: 50, y: 50 })
  const [isDraggingWallpaper, setIsDraggingWallpaper] = useState(false)
  const [showWallpaperHint, setShowWallpaperHint] = useState(false)
  const wallpaperDragRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number } | null>(null)
  const reorderIndexRef = useRef<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setName(game?.name ?? '')
    setExePath(game?.exePath ?? '')
    const paths = game?.carouselPaths?.length ? game.carouselPaths : [game?.wallpaperPath, game?.coverPath].filter((path): path is string => Boolean(path))
    setCarouselPaths(paths)
    setSelectedCarouselIndex(0)
    setLogoPath(game?.logoPath ?? '')
    setWallpaperPosition(game?.wallpaperPosition ?? { x: 50, y: 50 })
    setShowWallpaperHint(Boolean(game?.carouselPaths?.length || game?.wallpaperPath || game?.coverPath))
    setError('')
  }, [game, isOpen])

  useEffect(() => {
    if (!isOpen || !showWallpaperHint) return
    const timer = window.setTimeout(() => setShowWallpaperHint(false), 3000)
    return () => window.clearTimeout(timer)
  }, [isOpen, showWallpaperHint])

  if (!isOpen) return null
  const pick = async (kind: 'exe' | 'logo') => {
    const path = kind === 'exe' ? await window.electronAPI.pickExe() : await window.electronAPI.pickWallpaper()
    if (!path) return
    if (kind === 'exe') setExePath(path)
    else setLogoPath(path)
  }
  const save = async () => {
    if (!name.trim() || !exePath.trim()) return setError('Tên game và tệp .exe là bắt buộc.')
    if (!carouselPaths.length) return setError('Hãy thêm ít nhất một ảnh cho carousel.')
    const clonedCarousel = await Promise.all(carouselPaths.map((path) => window.electronAPI.cloneImage(path)))
    const logo = logoPath ? await window.electronAPI.cloneImage(logoPath) : { success: true, path: '' }
    if (clonedCarousel.some((result) => !result.success) || !logo.success) return setError('Không thể sao chép ảnh đã chọn.')
    const savedCarouselPaths = clonedCarousel.map((result) => result.path)
    const savedCarouselThumbnailPaths = clonedCarousel.map((result) => result.thumbnailPath || '')
    const wallpaperPath = savedCarouselPaths[selectedCarouselIndex] || savedCarouselPaths[0]
    const data = { name: name.trim(), exePath, wallpaperPath, carouselPaths: savedCarouselPaths, carouselThumbnailPaths: savedCarouselThumbnailPaths, logoPath: logo.path || undefined, thumbnailPath: logo.thumbnailPath || savedCarouselThumbnailPaths[0] || undefined, coverPath: savedCarouselPaths[1] || undefined, wallpaperPosition, totalPlayTimeSeconds: game?.totalPlayTimeSeconds ?? 0, lastPlayedAt: game?.lastPlayedAt, installSizeBytes: game?.installSizeBytes, installSizeCheckedAt: game?.installSizeCheckedAt, patchVersion: game?.patchVersion }
    if (game) await updateGame(game.id, data)
    else await addGame(data)
    close()
  }
  const handleWallpaperPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setShowWallpaperHint(false)
    wallpaperDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: wallpaperPosition.x,
      startY: wallpaperPosition.y
    }
    setIsDraggingWallpaper(true)
  }
  const selectedCarouselPath = carouselPaths[selectedCarouselIndex] || carouselPaths[0] || ''
  const addCarouselImage = async () => {
    const path = await window.electronAPI.pickWallpaper()
    if (!path) return
    setCarouselPaths((paths) => [...paths, path])
    setSelectedCarouselIndex(carouselPaths.length)
    setShowWallpaperHint(true)
  }
  const replaceCarouselImage = async (index: number) => {
    const path = await window.electronAPI.pickWallpaper()
    if (!path) return
    setCarouselPaths((paths) => paths.map((item, itemIndex) => itemIndex === index ? path : item))
  }
  const removeCarouselImage = (index: number) => {
    if (carouselPaths.length <= 1) return setError('Carousel cần ít nhất một ảnh.')
    setCarouselPaths((paths) => paths.filter((_, itemIndex) => itemIndex !== index))
    setSelectedCarouselIndex((current) => current > index ? current - 1 : Math.min(current, carouselPaths.length - 2))
  }
  const refreshCarouselFromFolder = async () => {
    if (!game) return
    try {
      const syncedGame = await syncGameCarousel(game.id)
      if (!syncedGame) return
      setCarouselPaths(syncedGame.carouselPaths ?? [])
      setSelectedCarouselIndex(0)
      setError('')
    } catch {
      setError('Không thể đọc thư mục carousel cạnh file game.')
    }
  }
  const handleSlideDragStart = (index: number) => { reorderIndexRef.current = index }
  const handleSlideDrop = (index: number) => {
    const source = reorderIndexRef.current
    reorderIndexRef.current = null
    if (source === null || source === index) return
    setCarouselPaths((paths) => {
      const next = [...paths]
      const [moved] = next.splice(source, 1)
      next.splice(index, 0, moved)
      return next
    })
    setSelectedCarouselIndex(index)
  }

  const handleWallpaperPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = wallpaperDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    const xDelta = ((event.clientX - drag.startClientX) / event.currentTarget.clientWidth) * 100
    const yDelta = ((event.clientY - drag.startClientY) / event.currentTarget.clientHeight) * 100
    setWallpaperPosition({
      x: Math.round(Math.max(0, Math.min(100, drag.startX - xDelta))),
      y: Math.round(Math.max(0, Math.min(100, drag.startY - yDelta)))
    })
  }

  const handleWallpaperPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (wallpaperDragRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    wallpaperDragRef.current = null
    setIsDraggingWallpaper(false)
  }
  return <div className="add-game-modal-root" role="dialog" aria-modal="true" aria-labelledby="game-modal-title">
    <button type="button" className="add-game-modal-backdrop" aria-label="Đóng" onClick={close} />
    <div className="add-game-modal-panel">
      <header className="add-game-modal-header">
        <div><h2 id="game-modal-title">{game ? 'Sửa game' : 'Thêm game'}</h2><p>{game ? 'Cập nhật thông tin hiển thị và đường dẫn khởi chạy.' : 'Thêm game mới vào thư viện launcher.'}</p></div>
        <button type="button" className="add-game-modal-close" aria-label="Đóng" onClick={close}><Icon name="close" size={17} /></button>
      </header>
      <div className="add-game-form-grid">
        <div className="add-game-form-fields">
          <p className="add-game-section-label">THÔNG TIN GAME</p>
          <label><span className="add-game-field-label"><Icon name="logo" size={14} />Tên game</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên game" autoFocus /></label>
          <div className="media-picker-field"><span className="add-game-field-label"><Icon name="logo" size={14} />Logo game</span><div className="path-picker"><input value={logoPath} readOnly placeholder="Không bắt buộc" /><button type="button" onClick={() => void pick('logo')}>Chọn</button></div></div>
          <div className="media-picker-field"><span className="add-game-field-label"><Icon name="executable" size={14} />Executable</span><div className="path-picker"><input value={exePath} readOnly placeholder="Chưa chọn file .exe" title={exePath} /><button type="button" onClick={() => void pick('exe')}>Chọn</button></div></div>
          <div className="media-picker-field"><div className="carousel-editor__heading"><span className="add-game-field-label"><Icon name="carousel" size={14} />Carousel</span>{game && <button type="button" className="carousel-editor__refresh" onClick={() => void refreshCarouselFromFolder()}>Làm mới từ thư mục carousel</button>}</div><div className="carousel-editor">{carouselPaths.map((path, index) => <div key={`${path}-${index}`} className={`carousel-editor__card${index === selectedCarouselIndex ? ' is-selected' : ''}`} draggable onDragStart={() => handleSlideDragStart(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => handleSlideDrop(index)} onClick={() => { setSelectedCarouselIndex(index); setError('') }}><MediaThumb path={path} label={`Slide ${index + 1}`} className="carousel-editor__image" /><span className="carousel-editor__label">Slide {index + 1}</span><div className="carousel-editor__actions"><button type="button" onClick={(event) => { event.stopPropagation(); void replaceCarouselImage(index) }}>Thay</button><button type="button" onClick={(event) => { event.stopPropagation(); removeCarouselImage(index) }}>Xóa</button></div>{index === selectedCarouselIndex && <span className="carousel-editor__primary">Wallpaper chính</span>}</div>)}<button type="button" className="carousel-editor__add" onClick={() => void addCarouselImage()}><Icon name="plus" size={22} /><small>Thêm ảnh</small></button></div></div>
        </div>
      <div className="add-game-preview-column"><p className="add-game-section-label">PREVIEW WALLPAPER</p><div className={`wallpaper-position-preview${isDraggingWallpaper ? ' is-dragging' : ''}`} onPointerDown={handleWallpaperPointerDown} onPointerMove={handleWallpaperPointerMove} onPointerUp={handleWallpaperPointerUp} onPointerCancel={handleWallpaperPointerUp} onDragStart={(event) => event.preventDefault()} aria-label="Kéo để căn vị trí wallpaper"><MediaThumb path={selectedCarouselPath} label="Wallpaper game" className="wallpaper-position-preview__media" autoPlay style={{ objectPosition: `${wallpaperPosition.x}% ${wallpaperPosition.y}%` }} />{selectedCarouselPath && showWallpaperHint && <span className="wallpaper-position-preview__hint">Kéo ảnh để căn vị trí</span>}</div></div>
      </div>
      {error && <p className="add-game-error" role="alert">{error}</p>}
      <footer className="add-game-modal-footer"><span>* Các thay đổi chỉ áp dụng sau khi lưu.</span><div className="add-game-actions"><button type="button" onClick={close}>Hủy</button><button type="button" className="add-game-save" onClick={() => void save()}>Lưu thay đổi</button></div></footer>
    </div>
  </div>
}
