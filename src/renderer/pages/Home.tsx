import Carousel from '../components/Carousel'
import type { PointerEvent } from 'react'
import './Home.css'

export default function Home({ onPointerMove, onPointerLeave, carouselPaths, carouselIndex, onCarouselSelect, onCarouselPause }: { onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerLeave: () => void; carouselPaths: string[]; carouselIndex: number; onCarouselSelect: (index: number) => void; onCarouselPause: (paused: boolean) => void }) {
  return <div className="home-page"><Carousel onParallaxMove={onPointerMove} onParallaxLeave={onPointerLeave} carouselPaths={carouselPaths} carouselIndex={carouselIndex} onCarouselSelect={onCarouselSelect} onCarouselPause={onCarouselPause} /></div>
}
