const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.ogv'])

function cleanPath(path: string): string {
  return path.split('?')[0].split('#')[0].toLowerCase()
}

export function isVideoAsset(path?: string | null): boolean {
  if (!path) return false
  if (path.startsWith('data:video/')) return true
  const match = cleanPath(path).match(/\.[a-z0-9]+$/)
  return Boolean(match && VIDEO_EXTENSIONS.has(match[0]))
}
