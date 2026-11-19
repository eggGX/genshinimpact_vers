import { useEffect } from 'react'
import type { Card, CardEffect, EffectTarget } from '../game/types'
import { getCardArtwork } from '../data/cardArtwork'
import { getCardAbilityText, splitCardAbilityLines } from '../data/cardAbilityText'
import { CardArtwork } from './CardArtwork'
import { ElementIcon } from './ElementIcon'
import './CardDetail.css'

const rarityNames = {
  bronze: 'ブロンズ', silver: 'シルバー', gold: 'ゴールド', legendary: 'レジェンド',
} as const

const typeNames = {
  follower: 'フォロワー', spell: 'スペル', amulet: 'アミュレット',
} as const

const triggerNames: Record<CardEffect['trigger'], string> = {
  on_play: 'ファンファーレ', on_destroy: 'ラストワード',
  turn_start: 'ターン開始時', turn_end: 'ターン終了時',
  skill: '元素スキル', burst: '元素爆発',
}

const targetNames: Record<EffectTarget, string> = {
  own_leader: '自分のリーダー',
  enemy_leader: '相手のリーダー',
  selected_enemy_follower: '指定した相手フォロワー',
  self_follower: 'このフォロワー',
}

function describeCardEffect(effect: CardEffect): string {
  switch (effect.type) {
    case 'damage':
      return `${targetNames[effect.target]}に${effect.element ? '元素' : '非元素'}${effect.value}ダメージ`
    case 'heal':
      return `${targetNames[effect.target]}を${effect.value}回復`
    case 'grant_shield':
      return `${targetNames[effect.target]}に${effect.shieldType === 'normal' ? '通常' : '結晶'}シールド${effect.value}`
    case 'modify_stats':
      return `${targetNames[effect.target]}を攻撃力${effect.attackChange >= 0 ? '+' : ''}${effect.attackChange} / 体力${effect.healthChange >= 0 ? '+' : ''}${effect.healthChange}`
  }
}

interface Props {
  card: Card
  onClose: () => void
  onPrevious?: () => void
  onNext?: () => void
  position: number
  total: number
}

export function CardDetail({ card, onClose, onPrevious, onNext, position, total }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'ArrowLeft' && onPrevious) {
        event.preventDefault()
        onPrevious()
      }
      if (event.key === 'ArrowRight' && onNext) {
        event.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, onPrevious, onNext])

  const normalAttack = card.normalAttackElement ?? 'none'
  const abilityText = getCardAbilityText(card)
  return <section className="card-detail-view" aria-label={`${card.name}のカード詳細`}>
    <header className="card-detail-header">
      <div className="card-detail-breadcrumb"><span>COLLECTION</span><span className="card-detail-breadcrumb-separator">◇</span><strong>カード詳細</strong></div>
      <button type="button" className="card-detail-close" onClick={onClose}>〈 カード一覧へ戻る</button>
    </header>

    <div className="card-detail-layout">
      <div className="card-detail-art-column">
        <div className={`card-detail-card card-element--${card.element} card-rarity--${card.rarity}`}>
          <span className="card-detail-cost" title="プレイに必要なPP">{card.cost}</span>
          <div className="card-detail-name-banner">{card.name}</div>
          <div className="card-detail-portrait">
            {getCardArtwork(card.id)
              ? <CardArtwork cardId={card.id} name={card.name} className="card-detail-artwork" />
              : <div className="card-detail-placeholder">
                  <ElementIcon element={card.element} size="lg" />
                  <span>イラスト未登録</span>
                </div>}
          </div>
          <div className="card-detail-card-footer">
            <ElementIcon element={card.element} size="md" />
            {card.type === 'follower'
              ? <div className="card-detail-stats">
                  <span className="card-detail-attack" title="攻撃力">{card.attack ?? 0}</span>
                  <span className="card-detail-health" title="体力">{card.health ?? 0}</span>
                </div>
              : <span className="card-detail-type-footer">{typeNames[card.type]}</span>}
          </div>
        </div>
        <div className="card-detail-counter">
          <button type="button" onClick={onPrevious} disabled={!onPrevious}
            aria-label="前のカード">〈</button>
          <span>{position} / {total}</span>
          <button type="button" onClick={onNext} disabled={!onNext}
            aria-label="次のカード">〉</button>
        </div>
      </div>

      <div className="card-detail-info-column">
        <div className="card-detail-heading">
          <div className="card-detail-eyebrow">{card.id} · {rarityNames[card.rarity]}</div>
          <h1>{card.name}</h1>
          <div className="card-detail-category">
            <ElementIcon element={card.element} size="sm" withLabel />
            <span>{typeNames[card.type]}</span>
            <span>{rarityNames[card.rarity]}</span>
          </div>
        </div>

        <section className="card-detail-panel">
          <h2>カード能力</h2>
          <div className="card-detail-description">
            {splitCardAbilityLines(abilityText.basic).map((line, i) => <p key={i}>{line}</p>)}
          </div>
          {card.keywords && card.keywords.length > 0 &&
            <div className="card-detail-keywords">キーワード：{card.keywords.join('・')}</div>}
        </section>

        {(card.elementalSkill || card.elementalBurst) && <section className="card-detail-panel">
          <h2>元素能力</h2>
          {card.elementalSkill && <div className="card-detail-ability">
            <div className="card-detail-ability-title">
              <strong>元素スキル {card.elementalSkill.name}</strong>
              <span>{card.id === 'C083' ? 'コスト：手札1枚' : (card.elementalSkill.ppCost ?? 0) === 0 ? 'コスト：なし' : `PP ${card.elementalSkill.ppCost}`}</span>
            </div>
            {abilityText.skill && <p className="card-detail-ability-description">{abilityText.skill}</p>}
            {!abilityText.skill && card.elementalSkill.effects.length > 0 &&
              <div className="card-detail-ability-effects">
                {card.elementalSkill.effects.map((effect, i) =>
                  <p key={i}>{describeCardEffect(effect)}</p>)}
              </div>}
            <small>スキルを使用すると元素エネルギーを1獲得</small>
          </div>}
          {card.elementalBurst && <div className="card-detail-ability">
            <div className="card-detail-ability-title">
              <strong>元素爆発 {card.elementalBurst.name}</strong>
              <span>EN {card.elementalBurst.energyCost ?? 0}</span>
            </div>
            {abilityText.burst && <p className="card-detail-ability-description">{abilityText.burst}</p>}
            {!abilityText.burst && card.elementalBurst.effects.length > 0 &&
              <div className="card-detail-ability-effects">
                {card.elementalBurst.effects.map((effect, i) =>
                  <p key={i}>{describeCardEffect(effect)}</p>)}
              </div>}
          </div>}
        </section>}

        <section className="card-detail-panel card-detail-properties">
          <h2>カード情報</h2>
          <dl>
            <div><dt>カードID</dt><dd>{card.id}</dd></div>
            <div><dt>コスト</dt><dd>{card.cost} PP</dd></div>
            <div><dt>レアリティ</dt><dd>{rarityNames[card.rarity]}</dd></div>
            <div><dt>種類</dt><dd>{typeNames[card.type]}</dd></div>
            <div><dt>元素</dt><dd><ElementIcon element={card.element} size="xs" withLabel /></dd></div>
            {card.type === 'follower' && <div><dt>通常攻撃</dt><dd><ElementIcon element={normalAttack} size="xs" withLabel /></dd></div>}
            {card.type === 'follower' && <div><dt>攻撃力 / 体力</dt><dd>{card.attack ?? 0} / {card.health ?? 0}</dd></div>}
            <div><dt>地域</dt><dd>{card.region?.join(' ／ ') || '—'}</dd></div>
            <div><dt>タイプ</dt><dd>{card.traits?.join(' ／ ') || '—'}</dd></div>
            {card.elementalCreature && <div><dt>元素生物</dt><dd>常時元素付着</dd></div>}
            <div><dt>登録区分</dt><dd>{card.token ? 'トークン（デッキ採用不可）' : '正式カード'}</dd></div>
          </dl>
        </section>

        {card.effects && card.effects.length > 0 && <section className="card-detail-panel">
          <h2>効果データ</h2>
          <div className="card-detail-effect-list">
            {card.effects.map((effect, i) => <p key={i}>
              <span>{triggerNames[effect.trigger]}</span> {describeCardEffect(effect)}
            </p>)}
          </div>
        </section>}
      </div>
    </div>
  </section>
}
