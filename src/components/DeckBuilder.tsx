import { useState } from 'react'
import { CardArtwork } from './CardArtwork'
import { BattleCardTooltip } from './BattleCardTooltip'
import { ElementIcon } from './ElementIcon'
import { productionCards } from '../data/productionCards'
import {
  DECK_SIZE, MAX_CARD_COPIES, MAX_DECK_ELEMENTS, SELECTABLE_ELEMENTS,
  getDeckCard, validateDeck, type DeckDefinition, type PlayableElement,
} from '../data/deckRules'
import './DeckBuilder.css'

const names: Record<PlayableElement,string> = {
  pyro:'炎', hydro:'水', cryo:'氷', electro:'雷',
  anemo:'風', geo:'岩', dendro:'草',
}
const cardTypeNames = { follower:'フォロワー', spell:'スペル', amulet:'アミュレット' }

interface Props {
  title: string
  deck: DeckDefinition
  onChange: (deck: DeckDefinition) => void
  onBack: () => void
}

export function DeckBuilder({title,deck,onChange,onBack}:Props) {
  const [search,setSearch] = useState('')
  const [elementFilter,setElementFilter] = useState('all')
  const [hoveredCardId,setHoveredCardId] = useState<string | null>(null)
  const [tooltipPosition,setTooltipPosition] = useState({left:0,top:0})
  const showCardTooltip = (id:string,x:number,y:number) => {
    setHoveredCardId(id)
    const width=380
    setTooltipPosition({
      left: x+width+18 <= window.innerWidth ? x+18 : Math.max(8,x-width-18),
      top: Math.max(8,Math.min(y-90,window.innerHeight-510)),
    })
  }
  const counts = new Map<string,number>()
  for(const id of deck.cards)counts.set(id,(counts.get(id)??0)+1)
  const errors = validateDeck(deck)
  const available = productionCards
    .filter(c => c.implementationStatus === 'playable' && !c.token &&
      (c.element === 'none' || deck.elements.includes(c.element as PlayableElement)))
    .filter(c => elementFilter === 'all' || c.element === elementFilter)
    .filter(c => !search.trim() || (c.name + ' ' + c.id + ' ' + c.description)
      .toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a,b) => a.cost - b.cost || a.id.localeCompare(b.id))

  const toggleElement=(element:PlayableElement) => {
    if(deck.elements.includes(element)) {
      onChange({elements:deck.elements.filter(e=>e!==element),
        cards:deck.cards.filter(id=>getDeckCard(id)?.element!==element)})
      if(elementFilter===element)setElementFilter('all')
      return
    }
    if(deck.elements.length>=MAX_DECK_ELEMENTS)return
    onChange({...deck,elements:[...deck.elements,element]})
  }

  const add=(id:string) => {
    if(deck.cards.length>=DECK_SIZE || (counts.get(id)??0)>=MAX_CARD_COPIES)return
    onChange({...deck,cards:[...deck.cards,id]})
  }
  const remove=(id:string) => {
    const index=deck.cards.lastIndexOf(id)
    if(index<0)return
    onChange({...deck,cards:deck.cards.filter((_,i)=>i!==index)})
  }
  const entries=[...counts.entries()].map(([id,count])=>({card:getDeckCard(id),id,count}))
    .filter(({card})=>Boolean(card))
    .sort((a,b)=>(a.card?.cost??0)-(b.card?.cost??0)||a.id.localeCompare(b.id))

  return <main className="deck-builder">
    <header className="deck-builder-header">
      <div>
        <h1>{title}のデッキ編集</h1>
        <p>40枚・同名3枚まで・最大3元素。無元素はどのデッキにも採用できます。</p>
      </div>
      <button type="button" onClick={onBack}>デッキ選択に戻る</button>
    </header>

    <section className="deck-element-section" aria-label="使用する元素">
      <h2>使用する元素 <small>（{deck.elements.length} / 3種類）</small></h2>
      <div className="deck-element-buttons">
        {SELECTABLE_ELEMENTS.map(element=><button key={element} type="button"
          aria-pressed={deck.elements.includes(element)}
          className={deck.elements.includes(element)?'chosen':''}
          disabled={!deck.elements.includes(element)&&deck.elements.length>=3}
          onClick={()=>toggleElement(element)}>
          <ElementIcon element={element} size="sm" withLabel /> {deck.elements.includes(element)?'✓':''}
        </button>)}
      </div>
      <p className="deck-help">元素を外すと、その元素のカードもデッキから取り除きます。1〜2元素でも構築できます。</p>
    </section>

    <div className="deck-builder-columns">
      <section className="deck-pool" aria-label="カード候補">
        <h2>カードを追加</h2>
        <div className="deck-filter-controls">
          <label>カード検索
            <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="カード名・ID・能力を検索"/>
          </label>
          <label>元素で絞り込み
            <select value={elementFilter} onChange={e=>setElementFilter(e.target.value)}>
              <option value="all">選択した元素＋無元素</option>
              <option value="none">無元素</option>
              {deck.elements.map(e=><option key={e} value={e}>{names[e]}</option>)}
            </select>
          </label>
        </div>
        <p className="deck-pool-guide">カードをクリックして追加 ／ 右クリックで1枚外す ／ マウスを合わせて能力確認</p>
        <div className="deck-card-pool">
          {available.map(card=>{
            const count=counts.get(card.id)??0
            const enabled=deck.cards.length<DECK_SIZE&&count<MAX_CARD_COPIES
            return <button key={card.id} type="button"
              className={['deck-card-tile',`deck-card-tile--${card.rarity}`,count>0?'deck-card-tile--included':''].filter(Boolean).join(' ')}
              disabled={!enabled && count===0}
              aria-label={`${card.name}：採用${count}枚、左クリックで追加、右クリックで削除`}
              onClick={()=>add(card.id)}
              onContextMenu={event=>{event.preventDefault();remove(card.id)}}
              onMouseEnter={event=>showCardTooltip(card.id,event.clientX,event.clientY)}
              onMouseLeave={()=>setHoveredCardId(null)}
              onFocus={event=>{
                const rect=event.currentTarget.getBoundingClientRect()
                showCardTooltip(card.id,rect.right,rect.top+80)
              }}
              onBlur={()=>setHoveredCardId(null)}>
              <span className="deck-tile-cost">{card.cost}</span>
              <span className="deck-tile-count">{count}</span>
              <span className="deck-tile-art">
                <CardArtwork cardId={card.id} name={card.name} className="card-artwork--deck" />
              </span>
              <span className="deck-tile-name">{card.name}</span>
              {card.type==='follower'
                ? <span className="deck-tile-stats"><b>{card.attack}</b><b>{card.health}</b></span>
                : <span className="deck-tile-kind">{cardTypeNames[card.type]}</span>}
            </button>
          })}
          {available.length===0&&<p className="deck-pool-empty">該当するカードはありません。</p>}
        </div>
      </section>

      <section className="deck-selected" aria-label="現在のデッキ">
        <h2>デッキ {deck.cards.length} / {DECK_SIZE}枚</h2>
        <div className="deck-progress" role="progressbar"
          aria-label="デッキ枚数" aria-valuenow={deck.cards.length} aria-valuemin={0}
          aria-valuemax={DECK_SIZE}>
          <span style={{width:`${Math.min(100,deck.cards.length/DECK_SIZE*100)}%`}}/>
        </div>
        {errors.length===0
          ? <p className="deck-valid">構築ルールを満たしています。このデッキで対戦できます。</p>
          : <div className="deck-errors" role="status">
              {errors.slice(0,6).map((error,i)=><p key={i}>{error}</p>)}
            </div>}
        <div className="deck-selected-list">
          {entries.map(({card,id,count})=><div className="deck-selected-row" key={id}>
            <span className="deck-selected-entry">{card && <ElementIcon element={card.element} size="xs" />} {card?.cost}PP {card?.name} ×{count}</span>
            <button type="button" onClick={()=>remove(id)}
              aria-label={card?.name+'を1枚外す'}>－</button>
          </div>)}
          {entries.length===0&&<p>カードを追加してください。</p>}
        </div>
        <button type="button" className="deck-builder-back" onClick={onBack}>デッキ選択に戻る</button>
      </section>
    </div>
    {hoveredCardId && getDeckCard(hoveredCardId) && <div className="deck-hover-tooltip"
      style={{left:tooltipPosition.left,top:tooltipPosition.top}}>
      <BattleCardTooltip card={getDeckCard(hoveredCardId)!} ownerLabel="カード候補" />
    </div>}
  </main>
}
