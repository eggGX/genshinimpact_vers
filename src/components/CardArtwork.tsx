import { useState } from 'react'
import { getCardArtwork } from '../data/cardArtwork'
import './CardArtwork.css'

type Props = {
  cardId: string
  name: string
  className?: string
  priority?: boolean
}

/**
 * Only cards explicitly registered in cardArtwork.ts request an image.
 * If an asset is missing or broken, text-only card UI remains usable.
 */
export function CardArtwork({ cardId, name, className = '', priority = false }: Props) {
  const src = getCardArtwork(cardId)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || failedSrc === src) return null
  return <img
    className={['card-artwork', className].filter(Boolean).join(' ')}
    src={src}
    alt={name + 'のカードイラスト'}
    draggable={false}
    loading={priority ? "eager" : "lazy"}
    decoding={priority ? "sync" : "async"}
    onError={() => setFailedSrc(src)}
  />
}
