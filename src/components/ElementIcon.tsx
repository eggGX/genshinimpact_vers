import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { ElementType } from '../game/types'
import { getElementVisual } from '../data/elementIcons'
import './ElementIcon.css'

interface Props {
  element: ElementType
  size?: 'xs' | 'sm' | 'md' | 'lg'
  withLabel?: boolean
  className?: string
}

/** Common elemental UI asset. Missing/unregistered images have an accessible fallback. */
export function ElementIcon({ element, size = 'sm', withLabel = false, className = '' }: Props) {
  const visual = getElementVisual(element)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const showImage = Boolean(visual.image && failedImage !== visual.image)
  const showSprite = !showImage && visual.spriteIndex !== undefined
  return <span
    className={['element-icon', `element-icon--${size}`, `element-icon--${element}`, className]
      .filter(Boolean).join(' ')}
    style={{ '--element-color': visual.color } as CSSProperties}
    title={visual.label}
    aria-label={visual.label}
  >
    <span className="element-icon-emblem" aria-hidden="true">
      {showImage
        ? <img src={visual.image} alt="" draggable={false}
            onError={() => setFailedImage(visual.image ?? null)} />
        : showSprite
          ? <span className="element-icon-sprite"
              style={{ backgroundPositionY: `${(visual.spriteIndex ?? 0) * 100 / 6}%` }} />
          : <span className="element-icon-symbol">{visual.symbol}</span>}
    </span>
    {withLabel && <span className="element-icon-label">{visual.label}</span>}
  </span>
}
