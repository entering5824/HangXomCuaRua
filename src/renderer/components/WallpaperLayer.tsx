import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { toFileUrl } from '../lib/wallpaperCache'
import { isVideoAsset } from '../lib/media'
import './WallpaperLayer.css'

interface MediaLayer {
  id: string
  src: string
  objectPosition: string
}

export default function WallpaperLayer({ gameId, wallpaperPath, wallpaperPosition, isIdle = false, isActive = true, onImageBrightnessChange, onImageAccentChange }: { gameId: string | null; wallpaperPath: string | null; wallpaperPosition?: { x: number; y: number }; isIdle?: boolean; isActive?: boolean; onImageBrightnessChange?: (brightness: number | null) => void; onImageAccentChange?: (accent: string | null) => void }) {
  const currentRef = useRef<MediaLayer | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState<MediaLayer | null>(null)
  const [previous, setPrevious] = useState<MediaLayer | null>(null)

  useEffect(() => {
    if (!gameId || !wallpaperPath) {
      const previousLayer = currentRef.current
      currentRef.current = null
      setCurrent(null)
      setPrevious(previousLayer)
      const cleanup = window.setTimeout(() => setPrevious(null), 620)
      return () => window.clearTimeout(cleanup)
    }
    const next: MediaLayer = {
      id: gameId,
      src: toFileUrl(wallpaperPath),
      objectPosition: `${wallpaperPosition?.x ?? 50}% ${wallpaperPosition?.y ?? 50}%`
    }
    const previousLayer = currentRef.current
    if (previousLayer?.id === next.id && previousLayer.src === next.src && previousLayer.objectPosition === next.objectPosition) return
    currentRef.current = next
    setPrevious(previousLayer)
    setCurrent(next)
    const cleanup = window.setTimeout(() => setPrevious(null), 620)
    return () => window.clearTimeout(cleanup)
  }, [gameId, wallpaperPath, wallpaperPosition?.x, wallpaperPosition?.y])

  useEffect(() => {
    const videos = layerRef.current?.querySelectorAll('video') ?? []
    for (const video of videos) {
      if (isActive) void video.play().catch(() => undefined)
      else video.pause()
    }
  }, [current?.src, previous?.src, isActive])

  const measureMediaVisual = (media: CanvasImageSource) => {
    if (!onImageBrightnessChange && !onImageAccentChange) return
    try {
      const size = 32
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        onImageBrightnessChange?.(null)
        onImageAccentChange?.(null)
        return
      }
      context.drawImage(media, 0, 0, size, size)
      const pixels = context.getImageData(0, 0, size, size).data
      let luminance = 0
      let pixelCount = 0
      const hueBuckets = Array.from({ length: 18 }, () => ({ r: 0, g: 0, b: 0, weight: 0 }))

      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3] / 255
        if (alpha < .5) continue
        const r = pixels[index]
        const g = pixels[index + 1]
        const b = pixels[index + 2]
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const chroma = max - min
        const lightness = (max + min) / 510
        const saturation = max === 0 ? 0 : chroma / max
        luminance += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
        pixelCount += 1

        if (saturation < .24 || lightness < .16 || lightness > .88 || chroma < 24) continue
        let hue = 0
        if (chroma !== 0) {
          if (max === r) hue = ((g - b) / chroma) % 6
          else if (max === g) hue = ((b - r) / chroma) + 2
          else hue = ((r - g) / chroma) + 4
          hue = (hue * 60 + 360) % 360
        }
        const bucket = hueBuckets[Math.min(hueBuckets.length - 1, Math.floor(hue / 20))]
        const weight = alpha * (.45 + saturation) * (.55 + chroma / 255) * (1 - Math.min(.6, Math.abs(lightness - .55)))
        bucket.r += r * weight
        bucket.g += g * weight
        bucket.b += b * weight
        bucket.weight += weight
      }

      onImageBrightnessChange?.(pixelCount ? luminance / pixelCount : null)
      const accentBucket = hueBuckets.reduce((best, bucket) => bucket.weight > best.weight ? bucket : best, hueBuckets[0])
      if (accentBucket.weight > 0) {
        const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0')
        onImageAccentChange?.(`#${toHex(accentBucket.r / accentBucket.weight)}${toHex(accentBucket.g / accentBucket.weight)}${toHex(accentBucket.b / accentBucket.weight)}`)
      } else {
        onImageAccentChange?.(null)
      }
      canvas.width = 1
      canvas.height = 1
    } catch {
      onImageBrightnessChange?.(null)
      onImageAccentChange?.(null)
    }
  }

  const measureImageVisual = (event: SyntheticEvent<HTMLImageElement>) => measureMediaVisual(event.currentTarget)
  const measureVideoVisual = (event: SyntheticEvent<HTMLVideoElement>) => {
    window.requestAnimationFrame(() => measureMediaVisual(event.currentTarget))
  }

  const renderMedia = (layer: MediaLayer, role: 'current' | 'previous') => {
    const className = `wallpaper-layer__img wallpaper-layer__img--${role}`
    return isVideoAsset(layer.src)
      ? <video key={`${role}-${layer.id}`} className={className} src={layer.src} muted loop autoPlay={isActive} playsInline draggable={false} onLoadedData={role === 'current' ? measureVideoVisual : undefined} style={{ objectPosition: layer.objectPosition }} />
      : <img key={`${role}-${layer.id}`} className={className} src={layer.src} alt="" draggable={false} onLoad={role === 'current' ? measureImageVisual : undefined} onDragStart={(event) => event.preventDefault()} style={{ objectPosition: layer.objectPosition }} />
  }

  return <div className={`wallpaper-layer${isIdle ? ' is-idle' : ''}`}>
    <div ref={layerRef} className="wallpaper-layer__media">
      {!current && !previous && <div className="wallpaper-layer--empty" />}
      {previous && renderMedia(previous, 'previous')}
      {current && renderMedia(current, 'current')}
    </div>
  </div>
}
