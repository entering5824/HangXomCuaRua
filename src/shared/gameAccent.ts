import type { GameTheme } from './types'

export function getGameAccentColor(name: string) {
  const normalized = name.toLowerCase()
  if (normalized.includes('genshin')) return '#46d9e8'
  if (normalized.includes('zenless') || normalized.includes('zzz')) return '#f2c14e'
  if (normalized.includes('honkai') || normalized.includes('star rail') || normalized.includes('hsr')) return '#a78bfa'
  return '#a78bfa'
}

export function getGameTheme(name: string, accent = getGameAccentColor(name)): GameTheme {
  const normalized = name.toLowerCase()
  if (normalized.includes('genshin')) return { accent, accentSoft: '#9cf4fa', overlayStrength: .82 }
  if (normalized.includes('zenless') || normalized.includes('zzz')) return { accent, accentSoft: '#ffe39a', overlayStrength: .94 }
  if (normalized.includes('honkai') || normalized.includes('star rail') || normalized.includes('hsr')) return { accent, accentSoft: '#d6c9ff', overlayStrength: .78 }
  if (normalized.includes('wuthering')) return { accent, accentSoft: '#a8eee4', overlayStrength: .86 }
  return { accent, accentSoft: '#d6c9ff', overlayStrength: .84 }
}
