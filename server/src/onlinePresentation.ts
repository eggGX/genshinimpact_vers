import { getCard } from '../../src/data/cardRegistry.ts'
import { beginPresentation, captureFrame, compactPresentationFrames, withoutPresentation } from '../../src/game/presentation.ts'
import type { GameState } from '../../src/game/types.ts'
import { applyOnlineAction, type OnlineAction } from './matchActions.ts'

export interface RecordedOnlineFrame {
  label: string
  state: GameState
}
export interface RecordedOnlineEvent {
  revision: number
  actorId: string
  title: string
  frames: RecordedOnlineFrame[]
}

function actionTitle(state: GameState, action: OnlineAction): string {
  const actor = state.players.find(p => p.id === state.currentPlayerId)
  const prefix = actor?.name ?? 'プレイヤー'
  switch (action.type) {
    case 'play':
      return `${prefix}：${getCard(actor?.hand[action.handIndex] ?? '')?.name ?? 'カード'}をプレイ`
    case 'ability': {
      const follower = actor?.field.find(f => f.instanceId === action.followerId)
      return `${prefix}：${getCard(follower?.cardId ?? '')?.name ?? 'キャラクター'}の元素${action.kind === 'skill' ? 'スキル' : '爆発'}`
    }
    case 'attackFollower': {
      const attacker = actor?.field.find(f => f.instanceId === action.attackerId)
      const opponent = state.players.find(p => p.id !== state.currentPlayerId)
      const target = opponent?.field.find(f => f.instanceId === action.targetId)
      return `${prefix}：${getCard(attacker?.cardId ?? '')?.name ?? 'フォロワー'}が${getCard(target?.cardId ?? '')?.name ?? '敵'}を攻撃`
    }
    case 'attackLeader': {
      const attacker = actor?.field.find(f => f.instanceId === action.attackerId)
      return `${prefix}：${getCard(attacker?.cardId ?? '')?.name ?? 'フォロワー'}がリーダーを攻撃`
    }
    case 'endTurn': return `${prefix}：ターン終了`
  }
}

/** Record the engine's actual resolution, not reconstructed or guessed damage. */
export function recordOnlineAction(state: GameState, action: OnlineAction, revision: number):
  { next: GameState; event: RecordedOnlineEvent } {
  const title = actionTitle(state, action)
  const initial = beginPresentation(state)
  const traced = applyOnlineAction(initial, action)
  if (traced === initial) throw new Error('実行できない操作です')
  const next = withoutPresentation(traced)
  const captured = captureFrame(traced, title)
  const compact = compactPresentationFrames(state, captured.presentationFrames ?? [])
  // Firestore match documents are size limited. Preserve start/end, plus up
  // to 12 representative resolution frames, and only 5 recent events.
  const selected = compact.length <= 12 ? compact :
    Array.from({length:12},(_,i)=>compact[Math.round(i * (compact.length - 1)/11)])
  return {
    next,
    event: {
      revision,
      actorId: state.currentPlayerId,
      title,
      frames: [
        { label: `${title}：効果を解決中`, state: withoutPresentation(state) },
        ...selected.map(frame => ({label:frame.label,state:frame.state})),
      ],
    },
  }
}
