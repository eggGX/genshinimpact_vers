import type { AmuletState, Card, ElementType, Follower } from '../game/types'
import { CardArtwork } from './CardArtwork'
import { getCardAbilityText } from '../data/cardAbilityText'
import { ElementIcon } from './ElementIcon'
import './BattleCardTooltip.css'

const ELEMENTS: Record<ElementType, string> = {
  none: '物理', pyro: '炎', hydro: '水', cryo: '氷',
  electro: '雷', anemo: '風', geo: '岩', dendro: '草',
}
const KEYWORDS: Record<string, string> = {
  guard: '守護', rush: '突進', rush_only: '突進（リーダー攻撃不可）',
  storm: '疾走', stealth: '潜伏', aura: 'オーラ', intimidate: '威圧',
  double_attack: '2回攻撃', cannot_attack: '攻撃不可',
  frozen: '凍結', superconduct: '超電導（次の物理被ダメージ+2）',
  raincutter_on_attack: '古華剣・裁雨留虹（攻撃時：対象に水元素1ダメージ）',
  next_damage_plus_2: '次の被ダメージ+2',
  ignore_guard: '守護を無視', plunge_attack: '落下攻撃',
  attack_heal_2: '攻撃時：自リーダーを2回復',
}
function keywordLabel(keyword: string): string {
  if (KEYWORDS[keyword]) return KEYWORDS[keyword]
  if (keyword.startsWith('normal_attack_')) {
    const element = keyword.slice('normal_attack_'.length) as ElementType
    return `通常攻撃：${ELEMENTS[element] ?? element}元素`
  }
  if (keyword.startsWith('burning:')) return `燃焼：残り${keyword.slice(8)}ターン`
  if (keyword.startsWith('quicken:')) return `原激化：残り${keyword.slice(8)}回`
  return keyword.replaceAll('_', ' ')
}

export function BattleCardTooltip({
  card, follower, amulet, ownerLabel,
}: { card: Card; follower?: Follower; amulet?: AmuletState; ownerLabel: string }) {
  const element = (['anemo', 'electro', 'cryo', 'hydro', 'pyro', 'geo'] as const)
    .find(e => follower?.keywords.includes(`normal_attack_${e}`))
    ?? card.normalAttackElement ?? 'none'
  const status = follower?.keywords.map(keywordLabel) ?? []
  const abilityText = getCardAbilityText(card)
  const attackUsed = follower?.attacksThisTurn ?? (follower?.hasAttacked ? 1 : 0)
  const attackMax = follower?.keywords.includes('double_attack') ? 2 : 1
  return <aside className="battle-card-tooltip" role="status"
    aria-label={`${card.name}のカード能力と現在の状態`}>
    <div className="battle-tooltip-head">
      <div className="battle-tooltip-art">
        <CardArtwork cardId={card.id} name={card.name} />
      </div>
      <div className="battle-tooltip-title">
        <span className="battle-tooltip-overline">{ownerLabel} · COST {card.cost}</span>
        <strong>{card.name}</strong>
        <div className="battle-tooltip-element">
          <ElementIcon element={card.element} size="sm" withLabel />
          <span>{card.type === 'follower' ? 'フォロワー' : card.type === 'spell' ? 'スペル' : 'アミュレット'}</span>
        </div>
      </div>
    </div>
    <section className="battle-tooltip-section">
      <h3>カード効果</h3>
      <p className="battle-tooltip-description">{abilityText.basic || '基本効果なし'}</p>
    </section>
    {(card.elementalSkill || card.elementalBurst) && <section className="battle-tooltip-section battle-tooltip-abilities">
      <h3>元素能力</h3>
      {card.elementalSkill && <div className="battle-tooltip-ability">
        <div className="battle-tooltip-ability-heading"><strong>元素スキル：{card.elementalSkill.name}</strong><span>{card.id === 'C083' ? 'コスト：手札1枚' : (card.elementalSkill.ppCost ?? 0) === 0 ? 'コスト：なし' : `PP ${card.elementalSkill.ppCost}`}</span></div>
        {abilityText.skill && <p>{abilityText.skill}</p>}
      </div>}
      {card.elementalBurst && <div className="battle-tooltip-ability">
        <div className="battle-tooltip-ability-heading"><strong>元素爆発：{card.elementalBurst.name}</strong><span>EN {card.elementalBurst.energyCost ?? 0}</span></div>
        {abilityText.burst && <p>{abilityText.burst}</p>}
      </div>}
    </section>}
    <section className="battle-tooltip-section">
      <h3>現在の状態</h3>
      {follower ? <>
        <div className="battle-tooltip-stats">
          <span>攻撃力 <strong>{follower.attack}</strong><small> / 基本 {card.attack ?? 0}</small></span>
          <span>体力 <strong>{follower.health}</strong><small> / 最大 {follower.maxHealth}</small></span>
        </div>
        <div className="battle-tooltip-row"><span>通常攻撃</span><strong>{ELEMENTS[element]}{element !== 'none' ? '元素' : ''}</strong></div>
        <div className="battle-tooltip-row"><span>元素付着</span>
          <div className="battle-tooltip-aura">{follower.aura.length
            ? follower.aura.map((a, i) => <ElementIcon key={i} element={a.element} size="sm" withLabel />)
            : <span>なし</span>}</div>
        </div>
        <div className="battle-tooltip-row"><span>シールド</span>
          <strong>通常 {follower.shield.normal} / 結晶 {follower.shield.crystallize}</strong></div>
        <div className="battle-tooltip-row"><span>攻撃状況</span>
          <strong>{follower.canAttack && attackUsed < attackMax && !follower.keywords.includes('frozen') ? '攻撃可能' : '攻撃不可'}（{attackUsed}/{attackMax}回）</strong></div>
        {card.elementalSkill && <div className="battle-tooltip-row"><span>スキル</span>
          <strong>{follower.skillUsed ? '使用済み' : '未使用'}{(follower.skillUsesThisTurn ?? 0) > 0 ? `（今ターン${follower.skillUsesThisTurn}回）` : ''}</strong></div>}
        {card.elementalBurst && <div className="battle-tooltip-row"><span>爆発</span>
          <strong>{follower.burstUsed ? '使用済み' : '未使用'}</strong></div>}
        {status.length > 0 && <div className="battle-tooltip-effects">
          <span>付与効果・状態</span><ul>{status.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>}
      </> : amulet ? <>
        <div className="battle-tooltip-row"><span>残りカウント</span><strong>{amulet.turnsRemaining}ターン</strong></div>
        {amulet.recordedElement && <div className="battle-tooltip-row"><span>記録元素</span>
          <ElementIcon element={amulet.recordedElement} size="sm" withLabel /></div>}
      </> : <p className="battle-tooltip-muted">手札のカード（未プレイ）</p>}
    </section>
  </aside>
}
