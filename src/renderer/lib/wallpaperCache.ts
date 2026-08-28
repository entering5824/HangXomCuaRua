function toAppMediaUrl(path: string): string {
  return `app-media://local/media?path=${encodeURIComponent(path)}`
}

export function toFileUrl(path: string): string {
  if (/^(data:|https?:|blob:|app-media:)/i.test(path)) return path
  if (/^file:/i.test(path)) {
    try {
      const filePath = decodeURIComponent(new URL(path).pathname).replace(/^\/([A-Za-z]:)/, '$1')
      return toAppMediaUrl(filePath)
    } catch {
      return path
    }
  }
  if (/^(\.?\.?\/)/.test(path)) return path
  return toAppMediaUrl(path)
}
