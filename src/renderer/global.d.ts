declare global {
  interface Window {
    electronAPI: import('../preload/index').ElectronAPI
    compactAPI: import('../preload/compact').CompactAPI
  }
}

export {}
