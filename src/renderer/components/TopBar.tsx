import { useEffect, useRef, useState } from 'react'
import './TopBar.css'

const logoUrl = new URL('../../../logo.png', import.meta.url).href

const resolutionPresets = [
  { width: 960, height: 540, label: 'Compact' },
  { width: 1280, height: 720, label: 'HD' },
  { width: 1366, height: 768, label: 'Laptop' },
  { width: 1600, height: 900, label: 'Recommended', recommended: true },
  { width: 1920, height: 1080, label: 'Full HD' },
  { width: 2560, height: 1440, label: 'QHD' }
]

export default function TopBar() {
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [windowSize, setWindowSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const syncWindowSize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setResolutionOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setResolutionOpen(false)
    }
    window.addEventListener('resize', syncWindowSize)
    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('resize', syncWindowSize)
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const applyResolution = async (width: number, height: number) => {
    const bounds = await window.electronAPI.setWindowSize(width, height)
    if (bounds) setWindowSize({ width: bounds.width, height: bounds.height })
    setResolutionOpen(false)
  }

  const fitWorkArea = async () => {
    const bounds = await window.electronAPI.fitWindowToWorkArea()
    if (bounds) setWindowSize({ width: bounds.width, height: bounds.height })
    setResolutionOpen(false)
  }

  return (
    <header className="topbar-shell drag-region">
      <div className="topbar-brand no-drag">
        <span className="topbar-mark"><img src={logoUrl} alt="" /></span>
        <span className="topbar-brand__copy"><strong>Hàng Xóm của Rùa</strong><small>GAME LAUNCHER</small></span>
      </div>

      <div className="topbar-actions no-drag">
        <div ref={pickerRef} className="resolution-picker">
          <button type="button" className="resolution-picker__trigger" aria-haspopup="menu" aria-expanded={resolutionOpen} onClick={() => setResolutionOpen((open) => !open)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1.75" y="2.25" width="12.5" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5.5 13.75h5M8 10.75v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            <span>{windowSize.width} × {windowSize.height}</span>
            <svg className="resolution-picker__chevron" width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {resolutionOpen && (
            <div className="resolution-picker__menu" role="menu" aria-label="Chọn độ phân giải cửa sổ">
              <div className="resolution-picker__menu-head"><span>Độ phân giải cửa sổ</span><small>Kéo cạnh cửa sổ để chỉnh tự do</small></div>
              <button type="button" className="resolution-picker__fit" role="menuitem" onClick={() => void fitWorkArea()}>
                <span className="resolution-picker__option-icon"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5.25 2H2v3.25M10.75 2H14v3.25M14 10.75V14h-3.25M5.25 14H2v-3.25" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                <span><strong>Vừa màn hình</strong><small>Tối đa vùng làm việc</small></span>
              </button>
              <div className="resolution-picker__divider" />
              {resolutionPresets.map((preset) => {
                const active = Math.abs(windowSize.width - preset.width) <= 2 && Math.abs(windowSize.height - preset.height) <= 2
                return <button key={`${preset.width}x${preset.height}`} type="button" className="resolution-picker__option" data-active={active} role="menuitemradio" aria-checked={active} onClick={() => void applyResolution(preset.width, preset.height)}>
                  <span><strong>{preset.width} × {preset.height}</strong><small>{preset.label}</small></span>
                  {preset.recommended && <em>Đề xuất</em>}
                  {active && <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.25 8.25 3 3 6.5-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>
              })}
            </div>
          )}
        </div>

        <span className="topbar-actions__divider" aria-hidden="true" />
        <button type="button" onClick={() => window.electronAPI.minimize()} className="window-control-btn" aria-label="Thu nhỏ">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <button type="button" onClick={() => window.electronAPI.toggleMaximize()} className="window-control-btn" aria-label="Phóng to hoặc khôi phục">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.35" /></svg>
        </button>
        <button type="button" onClick={() => window.electronAPI.close()} className="window-control-btn window-control-btn--close" aria-label="Đóng">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>
    </header>
  )
}
