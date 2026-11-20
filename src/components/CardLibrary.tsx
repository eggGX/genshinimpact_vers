import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CardArtwork } from './CardArtwork'
import { CardDetail } from './CardDetail'
import { ElementIcon } from './ElementIcon'
import { getAllCards } from '../data/cardRegistry'
import { productionCards } from '../data/productionCards'
import { ELEMENT_ORDER, RARITY_ORDER } from '../data/cardValidation'
import { filterCards } from '../data/cardFilters'
import type { Card, ElementType, Rarity } from '../game/types'
import './CardLibrary.css'

const ELEMENT_LABELS: Record<ElementType, string> = {
  none: '無元素', pyro: '炎', hydro: '水', cryo: '氷',
  electro: '雷', anemo: '風', geo: '岩', dendro: '草',
}
const RARITY_LABELS: Record<Rarity, string> = {
  bronze: 'ブロンズ', silver: 'シルバー', gold: 'ゴールド', legendary: 'レジェンド',
}

const ALL_CARDS = getAllCards()
const ORIGIN_IDS = new Set(productionCards.map(card => card.id))
const INITIAL_CARDS = 32
const MORE_CARDS = 24

// Keep card contents stable when only the selected card or filter controls change.
const LibraryEntry = memo(function LibraryEntry({
  card, selected, onSelect,
}: { card: Card; selected: boolean; onSelect: (id: string) => void }) {
  return <button type="button"
    className={selected ? 'library-entry selected' : 'library-entry'}
    onClick={() => onSelect(card.id)}>
    <span className="library-card-element">コスト {card.cost} <ElementIcon element={card.element} size="xs" withLabel /></span>
    <strong>{card.name}</strong>
    <span>{RARITY_LABELS[card.rarity]}</span>
    <CardArtwork cardId={card.id} name={card.name} className="card-artwork--library" />
    {card.type === 'follower' && <span>{card.attack} / {card.health}</span>}
    <small>{card.token ? 'トークン（デッキ不可）' : '正式'}</small>
    {card.implementationStatus === 'data_only' && <small>能力未実装・対戦使用不可</small>}
  </button>
})

// Incremental mounting avoids decoding and laying out the full 139-card catalogue
// up front. The sentinel adds a batch *before* it reaches the visible viewport.
function LibraryGrid({
  cards, selectedId, onSelect,
}: { cards: Card[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [count, setCount] = useState(INITIAL_CARDS)
  const sentinel = useRef<HTMLDivElement>(null)
  const hasMore = count < cards.length

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasMore || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setCount(previous => Math.min(previous + MORE_CARDS, cards.length))
      }
    }, { rootMargin: '600px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [cards, count, hasMore])

  return <>
    <div className="library-card-grid">
      {cards.slice(0, count).map(card => (
        <LibraryEntry key={card.id} card={card}
          selected={selectedId === card.id} onSelect={onSelect} />
      ))}
      {cards.length === 0 && <p>該当するカードはありません。</p>}
    </div>
    {hasMore && <div ref={sentinel} className="library-load-more">
      <button type="button"
        onClick={() => setCount(previous => Math.min(previous + MORE_CARDS, cards.length))}>
        さらに表示（{Math.min(count, cards.length)} / {cards.length}枚）
      </button>
    </div>}
  </>
}

export function CardLibrary({ onBack }: { onBack: () => void }) {
  const [element, setElement] = useState<ElementType | 'all'>('all')
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const [origin, setOrigin] = useState<'all' | 'token' | 'production'>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visible = useMemo(() => filterCards(ALL_CARDS, { element, rarity, origin, search }, ORIGIN_IDS), [element, rarity, origin, search])
  const selectedIndex = visible.findIndex(card => card.id === selectedId)
  const selected = selectedIndex >= 0 ? visible[selectedIndex] : undefined
  const selectNeighbor = (offset: -1 | 1) => {
    const neighbor = visible[selectedIndex + offset]
    if (neighbor) setSelectedId(neighbor.id)
  }

  return (
    <main className="library-page">
      <header className="library-header">
        <div>
          <h1>カード一覧</h1>
          <p>正式カード115枚とトークン24種を確認できます。</p>
        </div>
        <button type="button" onClick={onBack}>対戦画面へ戻る</button>
      </header>

      <section className="library-cards" aria-label="カード検索">
        <h2>カード検索</h2>
        <div className="library-filters">
          <label>
            元素
            <select value={element} onChange={e => {
              setElement(e.target.value as ElementType | 'all')
              setSelectedId(null)
            }}>
              <option value="all">すべて</option>
              {ELEMENT_ORDER.map(value =>
                <option value={value} key={value}>{ELEMENT_LABELS[value]}</option>)}
            </select>
          </label>
          <div className="library-element-chips" aria-label="元素で絞り込み">
            <button type="button" aria-pressed={element === 'all'}
              className={element === 'all' ? 'active' : ''}
              onClick={() => { setElement('all'); setSelectedId(null) }}>すべて</button>
            {ELEMENT_ORDER.map(value => <button type="button" key={value}
              className={element === value ? 'active' : ''}
              aria-pressed={element === value}
              onClick={() => { setElement(value); setSelectedId(null) }}>
              <ElementIcon element={value} size="xs" withLabel />
            </button>)}
          </div>
          <label>
            レアリティ
            <select value={rarity} onChange={e => {
              setRarity(e.target.value as Rarity | 'all')
              setSelectedId(null)
            }}>
              <option value="all">すべて</option>
              {RARITY_ORDER.map(value =>
                <option value={value} key={value}>{RARITY_LABELS[value]}</option>)}
            </select>
          </label>
          <label>
            登録区分
            <select value={origin} onChange={e => {
              setOrigin(e.target.value as 'all' | 'token' | 'production')
              setSelectedId(null)
            }}>
              <option value="all">すべて</option>
              <option value="token">トークン</option>
              <option value="production">正式カード</option>
            </select>
          </label>
          <label>
            名前・ID
            <input value={search} onChange={e => {
              setSearch(e.target.value)
              setSelectedId(null)
            }} placeholder="カードを検索" />
          </label>
        </div>
        <p aria-live="polite">表示：{visible.length}枚</p>
        <LibraryGrid key={`${element}|${rarity}|${origin}|${search}`}
          cards={visible} selectedId={selectedId} onSelect={setSelectedId} />

      </section>
      {selected && <div className="card-detail-overlay" role="dialog" aria-modal="true"
          aria-label={`${selected.name}のカード詳細`}>
        <CardDetail card={selected} position={selectedIndex + 1} total={visible.length}
          onClose={() => setSelectedId(null)}
          onPrevious={selectedIndex > 0 ? () => selectNeighbor(-1) : undefined}
          onNext={selectedIndex < visible.length - 1 ? () => selectNeighbor(1) : undefined} />
      </div>}
    </main>
  )
}
