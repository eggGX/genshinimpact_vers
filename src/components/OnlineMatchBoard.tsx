import { useState } from 'react'
import { getCard, needsPlayTarget, needsFriendlyPlayTarget, needsAbilityTarget, needsFriendlyAbilityTarget } from '../game/engine'
import { CardArtwork } from './CardArtwork'
import { ElementIcon } from './ElementIcon'
import { BattleCardTooltip } from './BattleCardTooltip'
import type { OnlineAction } from '../../server/src/matchActions'
import type { OnlineMatchView, OnlineFollowerView } from '../online/matchClient'
import './OnlineMatchBoard.css'

type Choice =
  | { kind: 'play'; index: number; friendly: boolean; firstId?: string }
  | { kind: 'ability'; followerId: string; ability: 'skill' | 'burst'; friendly: boolean; firstId?: string }
  | { kind: 'attack'; followerId: string }
  | null

export function OnlineMatchBoard({ match, pending, onAction }: {
  match: OnlineMatchView
  pending: boolean
  onAction: (action: OnlineAction) => void
}) {
  const [choice, setChoice] = useState<Choice>(null)
  const [inspected, setInspected] = useState<string | null>(null)
  const self = match.players[match.seat]
  const enemy = match.players[1 - match.seat]
  const canAct = match.phase === 'main' && match.currentPlayerId === self.id && !pending && !match.winnerId
  const send = (action: OnlineAction) => { if (canAct) { setChoice(null); onAction(action) } }
  const chooseHand = (index: number) => {
    if (!canAct) return
    const card = getCard(self.hand?.[index] ?? '')
    if (!card) return
    if (choice?.kind === 'ability' && getCard(self.field.find(f => f.instanceId === choice.followerId)?.cardId ?? '')?.id === 'C083') {
      send({ type: 'ability', followerId: choice.followerId, kind: choice.ability, targetId: `hand:${index}` })
      return
    }
    // For fanfares that can buff the summoned follower, select "self" separately.
    const friendly = needsFriendlyPlayTarget(card)
    const enemyTarget = needsPlayTarget(card)
    if (friendly || enemyTarget) { setChoice({kind:'play',index,friendly}); return }
    send({type:'play',handIndex:index})
  }
  const chooseAbility = (follower: OnlineFollowerView, ability: 'skill' | 'burst') => {
    if (!canAct) return
    const card = getCard(follower.cardId)
    if (!card) return
    if (card.id === 'C083' && ability === 'skill') {
      setChoice({kind:'ability',followerId:follower.instanceId,ability,friendly:false})
      return
    }
    if (needsFriendlyAbilityTarget(card,ability) || needsAbilityTarget(card,ability)) {
      setChoice({kind:'ability',followerId:follower.instanceId,ability,
        friendly:needsFriendlyAbilityTarget(card,ability)})
      return
    }
    send({type:'ability',followerId:follower.instanceId,kind:ability})
  }
  const chooseTarget = (id: string, friendly: boolean) => {
    if (!canAct || !choice) return
    if (choice.kind === 'attack') {
      if (!friendly) send({type:'attackFollower',attackerId:choice.followerId,targetId:id})
      return
    }
    if (choice.friendly !== friendly) return
    if (choice.kind === 'play') {
      send({type:'play',handIndex:choice.index,targetId:id})
      return
    }
    const abilityCard = getCard(self.field.find(f=>f.instanceId===choice.followerId)?.cardId ?? '')
    if (abilityCard?.id === 'C049' && choice.ability === 'skill' && enemy.field.length > 1 && !friendly) {
      if (!choice.firstId) { setChoice({...choice,firstId:id}); return }
      if (id === choice.firstId) return
      send({type:'ability',followerId:choice.followerId,kind:choice.ability,targetId:`${choice.firstId}|${id}`})
      return
    }
    send({type:'ability',followerId:choice.followerId,kind:choice.ability,targetId:id})
  }
  const activeDescription = !canAct ? '相手の操作を待っています'
    : choice?.kind === 'attack' ? '攻撃先の敵フォロワー、または相手リーダーを選択'
    : choice?.kind === 'play' ? 'カードの効果対象を選択（自身に付与できるカードは「自身」を選択）'
    : choice?.kind === 'ability' ? '元素能力の対象を選択'
    : '手札をクリックしてプレイ／味方フォロワーを選択して攻撃や能力を使用'
  const renderField = (own: boolean) => {
    const player = own ? self : enemy
    return <div className="card-slot online-card-slot">
      {player.field.map(f => {
        const card = getCard(f.cardId)
        return <div className="follower-wrapper" key={f.instanceId}>
          <button type="button" className={[
            'field-card',`card-element--${card?.element ?? 'none'}`,
            `card-rarity--${card?.rarity ?? 'bronze'}`,
            own && choice?.kind === 'attack' && choice.followerId === f.instanceId ? 'selected-card' : '',
            choice && ((own && choice.kind !== 'attack' && choice.friendly) ||
              (!own && (choice.kind === 'attack' || !choice.friendly))) ? 'attack-target' : '',
          ].filter(Boolean).join(' ')} 
            onClick={() => {
              if (!canAct) return
              if (choice && ((own && choice.kind !== 'attack' && choice.friendly) ||
                    (!own && (choice.kind === 'attack' || !choice.friendly)))) {
                chooseTarget(f.instanceId,own)
              } else if (own) { setChoice({kind:'attack',followerId:f.instanceId}) }
            }}
            onMouseEnter={() => setInspected(f.cardId)} onMouseLeave={() => setInspected(null)}
            onFocus={() => setInspected(f.cardId)} onBlur={() => setInspected(null)}>
            <CardArtwork cardId={f.cardId} name={card?.name ?? f.cardId}/>
            <strong>{card?.name ?? f.cardId}</strong>
            <ElementIcon element={card?.element ?? 'none'} size="xs"/>
            <span className="online-follower-aura" aria-label={`付着：${(f.aura ?? []).map(a=>a.element).join('、') || 'なし'}`}>
              {(f.aura ?? []).map((a,i)=><ElementIcon key={i} element={a.element} size="xs"/>)}
            </span>
            <span className="online-stats">{f.attack} / {f.health}</span>
            {(f.shield?.normal || f.shield?.crystallize) ? <small className="online-shield">
              盾 {f.shield.normal}+{f.shield.crystallize}
            </small> : null}
          </button>
          {own && <div className="online-follower-actions">
            {card?.elementalSkill && <button type="button"
              disabled={!canAct || (f.skillUsesThisTurn ?? (f.skillUsed ? 1 : 0)) >=
                (f.cardId === 'C084' ? 2 : ['C023','C069'].includes(f.cardId) ? 3 : 1)}
              onClick={() => chooseAbility(f,'skill')}>スキル</button>}
            {card?.elementalBurst && <button type="button" disabled={!canAct || f.burstUsed}
              onClick={() => chooseAbility(f,'burst')}>爆発</button>}
          </div>}
        </div>
      })}
      {(player.amulets ?? []).map(a => <span key={a.instanceId} className="online-amulet">
        {getCard(a.cardId)?.name ?? a.cardId} · {a.turnsRemaining}T
      </span>)}
      {player.field.length === 0 && (player.amulets?.length ?? 0) === 0 && <span className="online-empty">カード配置エリア</span>}
    </div>
  }
  return <div className="online-battle game--battle">
    <div className="online-battle-header"><strong>ELEMENTAL DUEL</strong>
      <span>ROUND {match.turn} · {canAct ? 'あなたのターン' : '相手のターン'}</span>
    </div>
    <section className="player opponent online-player">
      <div className="player-side-label">OPPONENT <strong>{enemy.name}</strong></div>
      <button type="button" className="leader leader-button"
        disabled={!canAct || choice?.kind !== 'attack'}
        onClick={() => { if (choice?.kind === 'attack') send({type:'attackLeader',attackerId:choice.followerId}) }}>
        <span className="leader-avatar"><img alt="" src={`${import.meta.env.BASE_URL}images/travelers/${match.seat === 0 ? 'lumine-icon.webp' : 'aether-icon.webp'}`}/></span>
        <span className="leader-caption">{enemy.name}</span>
        <span className="leader-health">♥ <strong>{enemy.leaderHealth}</strong> / {enemy.leaderMaxHealth}</span>
      </button>
      <div className="online-resource">PP {enemy.pp}/{enemy.maxPp}　EN {enemy.energy}/5</div>
      <div className="online-leader-aura" aria-label="相手リーダーの元素付着">
        {(enemy.leaderAura ?? []).map((a,i)=><ElementIcon key={i} element={a.element} size="sm"/>)}
        {(enemy.leaderAura?.length ?? 0) === 0 && <small>付着なし</small>}
        {enemy.leaderShield && <small>盾 {enemy.leaderShield.normal}+{enemy.leaderShield.crystallize}</small>}
      </div>
      <div className="online-resource">山札 {enemy.deckCount}枚 · 手札 {enemy.handCount}枚（非公開）</div>
    </section>
    <section className="field online-field">
      <p className="zone-label">ENEMY FIELD</p>{renderField(false)}
      <div className="field-divider"><span className="field-divider-emblem">✦</span><span className="field-divider-text">ELEMENTAL BATTLE</span></div>
      <p className="zone-label">YOUR FIELD</p>{renderField(true)}
    </section>
    <section className="player self online-player">
      <div className="player-side-label">YOU <strong>{self.name}</strong></div>
      <div className="leader">
        <span className="leader-avatar"><img alt="" src={`${import.meta.env.BASE_URL}images/travelers/${match.seat === 0 ? 'aether-icon.webp' : 'lumine-icon.webp'}`}/></span>
        <span className="leader-caption">{self.name}</span>
        <span className="leader-health">♥ <strong>{self.leaderHealth}</strong> / {self.leaderMaxHealth}</span>
      </div>
      <div className="online-resource">PP {self.pp}/{self.maxPp}　EN {self.energy}/5　山札 {self.deckCount}枚</div>
      <div className="online-leader-aura" aria-label="自分のリーダーの元素付着">
        {(self.leaderAura ?? []).map((a,i)=><ElementIcon key={i} element={a.element} size="sm"/>)}
        {(self.leaderAura?.length ?? 0) === 0 && <small>付着なし</small>}
        {self.leaderShield && <small>盾 {self.leaderShield.normal}+{self.leaderShield.crystallize}</small>}
      </div>
      <button type="button" className="end-turn" disabled={!canAct} onClick={() => send({type:'endTurn'})}>ターン終了</button>
    </section>
    <div className="battle-message" role="status">{activeDescription}
      {choice && <button type="button" onClick={()=>setChoice(null)}>選択を解除</button>}
      {choice?.kind === 'play' && ['C021','C044'].includes(self.hand?.[choice.index] ?? '') &&
        <button type="button" onClick={()=>send({type:'play',handIndex:choice.index,targetId:'self'})}>自身に効果を付与</button>}
    </div>
    <footer className="hand online-hand">
      <div className="hand-label">YOUR HAND <strong>{self.handCount} / 9</strong></div>
      <div className="hand-cards">{(self.hand ?? []).map((id,i) => {
        const card = getCard(id)
        return <button type="button" key={i} disabled={!canAct}
          className={['hand-card',`card-element--${card?.element ?? 'none'}`,
            `card-rarity--${card?.rarity ?? 'bronze'}`,
            choice?.kind === 'play' && choice.index === i ? 'selected-card' : ''].join(' ')}
          onClick={()=>chooseHand(i)} onMouseEnter={()=>setInspected(id)} onMouseLeave={()=>setInspected(null)}
          onFocus={()=>setInspected(id)} onBlur={()=>setInspected(null)}>
          <span className="card-cost">{card?.cost ?? '?'}</span>
          <CardArtwork cardId={id} name={card?.name ?? id}/>
          <strong>{card?.name ?? id}</strong>
          <ElementIcon element={card?.element ?? 'none'} size="xs"/>
          <span className="hand-card-stats">{card?.type === 'follower'
            ? `${card.attack} / ${card.health}` : card?.type === 'spell' ? 'スペル' : 'アミュレット'}</span>
        </button>
      })}</div>
    </footer>
    {match.winnerId && <div className="winner-banner">{match.winnerId === self.id ? '勝利！' : '敗北'}</div>}
    {inspected && getCard(inspected) && <BattleCardTooltip card={getCard(inspected)!} ownerLabel="カード詳細"/>}
  </div>
}
