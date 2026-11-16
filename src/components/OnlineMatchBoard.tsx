import { useState } from 'react'
import type { OnlineAction } from '../../server/src/matchActions'
import { getCard } from '../game/engine'
import type { OnlineMatchView, OnlineFollowerView } from '../online/matchClient'
import './OnlineMatchBoard.css'

function followerLabel(f: OnlineFollowerView): string {
  return `${getCard(f.cardId)?.name ?? f.cardId}（${f.attack}/${f.health}）`
}
export function OnlineMatchBoard({ match, pending, onAction }: {
  match: OnlineMatchView
  pending: boolean
  onAction: (action: OnlineAction) => void
}) {
  const [targetId, setTargetId] = useState('')
  const [attackerId, setAttackerId] = useState('')
  const [selectedHand, setSelectedHand] = useState(-1)
  const [abilityFollower, setAbilityFollower] = useState('')
  const [abilityKind, setAbilityKind] = useState<'skill' | 'burst'>('skill')
  const self = match.players[match.seat]
  const enemy = match.players[1 - match.seat]
  const myTurn = match.phase === 'main' && match.currentPlayerId === self.id
  const targetOptions = [
    ...enemy.field.map(f => ({ id: f.instanceId, name: `敵：${followerLabel(f)}` })),
    ...self.field.map(f => ({ id: f.instanceId, name: `味方：${followerLabel(f)}` })),
    { id: 'self', name: 'プレイするフォロワー自身（対応カードのみ）' },
    ...(self.hand ?? []).map((id,i) => ({ id: `hand:${i}`, name: `自分の手札：${getCard(id)?.name ?? id}` })),
  ]
  const chosenAttacker = self.field.find(f => f.instanceId === attackerId)
  const canSend = myTurn && !pending
  return <div className="online-match-board">
    <header>
      <h3>オンライン対戦 · ターン{match.turn}</h3>
      <p>{myTurn ? 'あなたのターン' : '相手のターン'} · 更新番号 {match.revision}</p>
    </header>
    <div className="online-match-players">
      <section>
        <h4>あなた · {self.name}</h4>
        <p>リーダーHP {self.leaderHealth}/{self.leaderMaxHealth} · PP {self.pp}/{self.maxPp} · EN {self.energy}</p>
        <p>手札 {self.handCount}枚 · 山札 {self.deckCount}枚</p>
        <div className="online-match-field">{self.field.length
          ? self.field.map(f => <span key={f.instanceId}>{followerLabel(f)}</span>)
          : <span>フォロワーなし</span>}</div>
      </section>
      <section>
        <h4>相手 · {enemy.name}</h4>
        <p>リーダーHP {enemy.leaderHealth}/{enemy.leaderMaxHealth} · PP {enemy.pp}/{enemy.maxPp} · EN {enemy.energy}</p>
        <p>手札 {enemy.handCount}枚（非公開） · 山札 {enemy.deckCount}枚</p>
        <div className="online-match-field">{enemy.field.length
          ? enemy.field.map(f => <span key={f.instanceId}>{followerLabel(f)}</span>)
          : <span>フォロワーなし</span>}</div>
      </section>
    </div>
    {match.winnerId && <p className="online-match-message">
      {match.winnerId === self.id ? '勝利！' : '敗北'}
    </p>}
    <div className="online-match-actions">
      <section>
        <h4>手札からプレイ</h4>
        <div className="online-match-hand">
          {(self.hand ?? []).map((id, i) =>
            <button key={i} type="button" className={selectedHand === i ? 'selected' : ''}
              onClick={() => setSelectedHand(i)}>
              <span>{getCard(id)?.name ?? id}</span>
              <small>コスト {getCard(id)?.cost ?? '?'}</small>
            </button>)}
        </div>
        <button type="button" disabled={!canSend || selectedHand < 0}
          onClick={() => onAction({ type:'play', handIndex:selectedHand, ...(targetId ? { targetId } : {}) })}>
          選んだカードをプレイ
        </button>
      </section>
      <section>
        <h4>対象・攻撃・元素能力</h4>
        <label>対象（必要な操作のみ指定）
          <select value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">指定なし</option>
            {targetOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label>攻撃フォロワー
          <select value={attackerId} onChange={e => setAttackerId(e.target.value)}>
            <option value="">選択してください</option>
            {self.field.map(f => <option key={f.instanceId} value={f.instanceId}>{followerLabel(f)}</option>)}
          </select>
        </label>
        <div className="online-match-buttons">
          <button type="button" disabled={!canSend || !chosenAttacker}
            onClick={() => onAction({ type:'attackLeader', attackerId })}>リーダーを攻撃</button>
          <button type="button" disabled={!canSend || !chosenAttacker || !enemy.field.some(f=>f.instanceId===targetId)}
            onClick={() => onAction({ type:'attackFollower', attackerId, targetId })}>選択した敵フォロワーを攻撃</button>
        </div>
        <label>元素能力を使用するフォロワー
          <select value={abilityFollower} onChange={e => setAbilityFollower(e.target.value)}>
            <option value="">選択してください</option>
            {self.field.map(f => <option key={f.instanceId} value={f.instanceId}>{followerLabel(f)}</option>)}
          </select>
        </label>
        <label>能力の種類
          <select value={abilityKind} onChange={e => setAbilityKind(e.target.value === 'burst' ? 'burst' : 'skill')}>
            <option value="skill">元素スキル</option>
            <option value="burst">元素爆発</option>
          </select>
        </label>
        <button type="button" disabled={!canSend || !abilityFollower}
          onClick={() => onAction({ type:'ability', followerId:abilityFollower, kind:abilityKind,
            ...(targetId ? { targetId } : {}) })}>元素能力を発動</button>
      </section>
    </div>
    <button type="button" className="online-match-end-turn" disabled={!canSend}
      onClick={() => onAction({ type:'endTurn' })}>ターン終了</button>
    <p className="online-match-note">試験用の操作画面です。特殊な複数対象指定などは、今後の対戦UI統合で対応します。
      不正な対象・PP不足などはサーバー側で拒否されます。カード効果は既存のゲームエンジンで処理されます。</p>
  </div>
}
