import { useState } from 'react'
import type { CrestState, ElementType } from '../game/types'
import { getCard } from '../data/cardRegistry'
import { getCardArtwork } from '../data/cardArtwork'
import { ElementIcon } from './ElementIcon'
import './CrestIcons.css'

type Props = { crests?: CrestState[]; ownerName: string; placement?: 'above' | 'below' }

const customTitles: Record<string, string> = {
  C034: '歌声の環',
}

const crestSymbols: Record<string, string> = {
  C010: '✦',
  C034: '♫',
  C045: '❄',
  C099: '✧',
}

function CrestEmblem({ id, element }: { id: string; element: ElementType }) {
  const artwork = getCardArtwork(id)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  return <span className="crest-emblem" aria-hidden="true">
    {artwork && failedImage !== artwork
      ? <img src={artwork} alt="" draggable={false} onError={() => setFailedImage(artwork)} />
      : <span className="crest-emblem-fallback">
          <ElementIcon element={element} size="sm" />
          <span className="crest-emblem-symbol">{crestSymbols[id] ?? '✦'}</span>
        </span>}
  </span>
}

/** Show only the section describing the crest, rather than the card's entire ability text. */
function getCrestEffect(description?: string): string {
  if (!description) return 'クレストの効果説明がありません。'
  const marker = '【クレスト】'
  const index = description.indexOf(marker)
  return index < 0 ? 'クレストの効果説明がありません。' : description.slice(index).trim().replace(/\\n/g, '\n')
}

/** All crests are public game state; the same compact tray appears on both sides. */
export function CrestIcons({ crests = [], ownerName, placement = 'below' }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  if (!crests.length) return null

  const entries = crests.map((crest, index) => {
    const card = getCard(crest.id)
    const name = customTitles[crest.id] ?? card?.name ?? crest.id
    return { crest, index, card, name, key: `${crest.id}-${index}` }
  })
  const active = entries.find(entry => entry.key === (hovered ?? selected))

  return <div className={`crest-tray crest-tray--${placement}`} aria-label={`${ownerName}のクレスト`}>
    <span className="crest-tray-label">CREST</span>
    <div className="crest-tray-icons">
      {entries.map(({ crest, card, name, key }) => {
        const tooltip = `${name}：残り${crest.turnsRemaining}ターン`
        return <button
          type="button"
          className={`crest-button${active?.key === key ? ' crest-button--selected' : ''}`}
          key={key}
          title={tooltip}
          onMouseEnter={() => setHovered(key)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(key)}
          onBlur={() => setHovered(null)}
          aria-label={`${ownerName}のクレスト：${tooltip}。詳細を表示`}
          aria-expanded={active?.key === key}
          onClick={() => setSelected(current => current === key ? null : key)}
        >
          <CrestEmblem id={crest.id} element={card?.element ?? 'none'} />
          <span className="crest-turn-count" aria-hidden="true">{crest.turnsRemaining}</span>
        </button>
      })}
    </div>
    {active && <div className="crest-detail" role="status">
      <span className="crest-detail-name">{active.name}</span>
      <span className="crest-detail-turns">残り{active.crest.turnsRemaining}ターン</span>
      <p>{getCrestEffect(active.card?.description)}</p>
      {active.crest.id === 'C010' && <div className="crest-used-elements">
        発動済み：{active.crest.usedElements.length
          ? active.crest.usedElements.map((element, i) =>
              <ElementIcon element={element} size="xs" key={i} />)
          : 'なし'}
      </div>}
    </div>}
  </div>
}
