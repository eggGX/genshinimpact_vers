import { useState } from 'react'
import { getAllCards } from '../data/cardRegistry'
import { productionCards } from '../data/productionCards'
import { ELEMENT_ORDER, RARITY_ORDER, validateProductionCards } from '../data/cardValidation'
import { filterCards } from '../data/cardFilters'
import type { ElementType, Rarity } from '../game/types'
import './CardLibrary.css'

const ELEMENT_LABELS: Record<ElementType, string> = {
  none: '無元素', pyro: '炎', hydro: '水', cryo: '氷',
  electro: '雷', anemo: '風', geo: '岩', dendro: '草',
}
const RARITY_LABELS: Record<Rarity, string> = {
  bronze: 'ブロンズ', silver: 'シルバー', gold: 'ゴールド', legendary: 'レジェンド',
}

export function CardLibrary({ onBack }: { onBack: () => void }) {
  const [element, setElement] = useState<ElementType | 'all'>('all')
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const [origin, setOrigin] = useState<'all' | 'test' | 'production'>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const report = validateProductionCards(productionCards)
  const originIds = new Set(productionCards.map(card => card.id))
  const visible = filterCards(getAllCards(), { element, rarity, origin, search }, originIds)
  const selected = visible.find(card => card.id === selectedId)

  return (
    <main className="library-page">
      <header className="library-header">
        <div>
          <h1>カード一覧</h1>
          <p>正式カードの登録状況とテストカードを確認できます。</p>
        </div>
        <button type="button" onClick={onBack}>対戦画面へ戻る</button>
      </header>

      <section className="library-status" aria-label="正式カード登録状況">
        <div>
          <strong>正式カード：{report.total} / {report.plannedTotal}枚</strong>
          <p>{report.ready ? '全カード登録済み' : '登録準備中（未完成）'}</p>
        </div>
        <div>
          <strong>登録データのエラー：{report.errors.length}件</strong>
          <p>テスト用カードは115枚の集計に含みません。</p>
        </div>
      </section>

      <section className="library-progress" aria-label="元素別の登録予定">
        <h2>元素別・レアリティ別の登録枠</h2>
        <div className="library-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">元素</th>
                {RARITY_ORDER.map(value => <th scope="col" key={value}>{RARITY_LABELS[value]}</th>)}
                <th scope="col">合計</th>
              </tr>
            </thead>
            <tbody>
              {ELEMENT_ORDER.map(value => {
                const slots = report.slots.filter(slot => slot.element === value)
                return (
                  <tr key={value}>
                    <th scope="row">{ELEMENT_LABELS[value]}</th>
                    {slots.map(slot => (
                      <td key={slot.rarity}>{slot.registered} / {slot.planned}</td>
                    ))}
                    <td>
                      {slots.reduce((n, slot) => n + slot.registered, 0)} /{' '}
                      {slots.reduce((n, slot) => n + slot.planned, 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {report.errors.length > 0 && (
          <div className="library-errors" role="alert">
            <strong>登録データの問題</strong>
            <ul>{report.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>
          </div>
        )}
      </section>

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
              setOrigin(e.target.value as 'all' | 'test' | 'production')
              setSelectedId(null)
            }}>
              <option value="all">すべて</option>
              <option value="test">テスト用</option>
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
        <div className="library-card-grid">
          {visible.map(card => (
            <button type="button" key={card.id}
              className={selectedId === card.id ? 'library-entry selected' : 'library-entry'}
              onClick={() => setSelectedId(card.id === selectedId ? null : card.id)}>
              <span>コスト {card.cost} ／ {ELEMENT_LABELS[card.element]}</span>
              <strong>{card.name}</strong>
              <span>{RARITY_LABELS[card.rarity]}</span>
              {card.type === 'follower' && <span>{card.attack} / {card.health}</span>}
              <small>{card.token ? 'トークン（デッキ不可）' : originIds.has(card.id) ? '正式' : 'テスト用'}</small>
              {card.implementationStatus === 'data_only' && <small>能力未実装・対戦使用不可</small>}
            </button>
          ))}
          {visible.length === 0 && <p>該当するカードはありません。</p>}
        </div>
        {selected && (
          <article className="library-details">
            <h3>{selected.name}</h3>
            <p>{selected.description || '説明は未登録です。'}</p>
            <p>ID：{selected.id} ／ タイプ：{selected.type}</p>
            {selected.region && <p>地域：{selected.region.join('／')}</p>}
            {selected.traits && <p>タイプ：{selected.traits.join('／')}</p>}
            {selected.implementationStatus === 'data_only' && (
              <p>このカードはデータ登録済みですが、効果はまだ実装されておらず対戦では使用できません。</p>
            )}
            {selected.token && <p>トークンカード：通常のデッキには含まれません。</p>}
            {selected.elementalSkill && <p>元素スキル：{selected.elementalSkill.name}{selected.elementalSkill.ppCost !== undefined ? `（PP${selected.elementalSkill.ppCost}）` : ''}</p>}
            {selected.elementalBurst && <p>元素爆発：{selected.elementalBurst.name}（EN{selected.elementalBurst.energyCost ?? 0}）</p>}
          </article>
        )}
      </section>
    </main>
  )
}
