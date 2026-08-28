import type { SVGProps } from 'react'

export type IconName = 'clock' | 'timer' | 'play' | 'more' | 'plus' | 'close' | 'storage' | 'hash' | 'logo' | 'executable' | 'carousel'

const paths: Record<IconName, string> = {
  clock: 'M8 3.5a4.5 4.5 0 1 0 4.5 4.5A4.5 4.5 0 0 0 8 3.5Zm0 2v2.8l1.9 1.2',
  timer: 'M6 2.8h4M8 2.8v1.1M8 8l1.8-1.2M12.2 5.3l.9-.9M8 12.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z',
  play: 'm6.4 4.6 5.1 3.4-5.1 3.4V4.6Z',
  more: 'M4 8h.01M8 8h.01M12 8h.01',
  plus: 'M8 3.5v9M3.5 8h9',
  close: 'm4 4 8 8M12 4l-8 8',
  storage: 'M3.5 5.2h9v5.6h-9zM5 3.5h6M5.2 8h.01M8 8h.01M10.8 8h.01',
  hash: 'M5.5 3.5 4.2 12.5M10.2 3.5 8.9 12.5M3.2 6.2h9.6M2.7 9.8h9.6',
  logo: 'M8 2.8 12 5v6l-4 2.2L4 11V5l4-2.2ZM5.3 6.1 8 7.6l2.7-1.5M8 7.6v4.2',
  executable: 'M4 3.5h8v9H4zM6 6h4M6 8h4M6 10h2',
  carousel: 'M3.5 4.2h9v7.6h-9zM5.5 9l1.7-1.8 1.4 1.3 1-1.1 1.2 1.6'
}

export default function Icon({ name, size = 16, ...props }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
    <path d={paths[name]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
