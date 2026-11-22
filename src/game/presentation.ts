import type { GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'

export interface PresentationFrame {
  label: string
  state: Omit<GameState, 'presentationFrames'>
}

/** A trace is opt-in. The engine remains synchronous, deterministic for any fixed RNG. */
export function beginPresentation(state: GameState): GameState {
  return { ...state, presentationFrames: [] }
}

export function withoutPresentation(state: GameState): GameState {
  if (!state.presentationFrames) return state
  const { presentationFrames: _frames, ...clean } = state
  void _frames
  return clean
}

/** Store immutable snapshots *after* each individual resolution, not just the final board. */
export function captureFrame(state: GameState, label: string): GameState {
  if (!state.presentationFrames) return state
  const snapshot = withoutPresentation(state)
  const players = structuredClone(snapshot.players) as [Player, Player]
  return {
    ...state,
    presentationFrames: [...state.presentationFrames, { label, state: { ...snapshot, players } }],
  }
}

function label(id: string): string {
  return getCard(id)?.name ?? id
}

function life(player: Player): string {
  return `${player.name} HP${player.leaderHealth}`
}

/** UI text is derived from the actual successive engine states; no guessed random targets. */
export function describePresentationChange(
  previous: Omit<GameState, 'presentationFrames'>,
  next: Omit<GameState, 'presentationFrames'>,
): string[] {
  const changes: string[] = []
  for (let i = 0; i < 2; i++) {
    const before = previous.players[i]
    const after = next.players[i]
    const beforeFollowers = new Map(before.field.map(f => [f.instanceId, f]))
    const afterFollowers = new Map(after.field.map(f => [f.instanceId, f]))
    for (const [id, follower] of beforeFollowers) {
      const now = afterFollowers.get(id)
      if (!now) {
        changes.push(`${label(follower.cardId)} が破壊された`)
      } else if (follower.health !== now.health) {
        const delta = now.health - follower.health
        changes.push(`${label(follower.cardId)} ${delta < 0 ? 'ダメージ' : '回復'} ${Math.abs(delta)}（HP ${follower.health}→${now.health}）`)
      } else if (follower.attack !== now.attack) {
        changes.push(`${label(follower.cardId)} 攻撃力 ${follower.attack}→${now.attack}`)
      } else if (follower.aura.map(a => a.element).join() !== now.aura.map(a => a.element).join()) {
        changes.push(`${label(follower.cardId)} 元素付着変化`)
      } else if (follower.shield.normal !== now.shield.normal ||
                 follower.shield.crystallize !== now.shield.crystallize) {
        changes.push(`${label(follower.cardId)} シールド変化`)
      }
    }
    for (const [id, follower] of afterFollowers) {
      if (!beforeFollowers.has(id)) changes.push(`${label(follower.cardId)} が登場`)
    }
    if (before.hand.length !== after.hand.length) {
      changes.push(`${after.name} 手札 ${before.hand.length}→${after.hand.length}枚`)
    }
    if (before.pp !== after.pp) {
      changes.push(`${after.name} PP ${before.pp}→${after.pp}`)
    }
    if (before.energy !== after.energy) {
      changes.push(`${after.name} EN ${before.energy}→${after.energy}`)
    }
    if ((before.leaderAura ?? []).map(a => a.element).join() !==
        (after.leaderAura ?? []).map(a => a.element).join()) {
      changes.push(`${after.name} の元素付着：${(after.leaderAura ?? []).map(a => a.element).join('・') || '解除'}`)
    }
    if (before.leaderHealth !== after.leaderHealth) {
      changes.push(`${life(before)} → ${after.leaderHealth}`)
    }
    if (before.leaderFrozenNextTurn !== after.leaderFrozenNextTurn) {
      changes.push(`${after.name} リーダー凍結：${after.leaderFrozenNextTurn ? '次ターンの使用可能PP－1' : '解除'}`)
    }
    if ((before.leaderQuickenCharges ?? 0) !== (after.leaderQuickenCharges ?? 0)) {
      changes.push(`${after.name} リーダー原激化：残り${after.leaderQuickenCharges ?? 0}回`)
    }
    if (before.leaderSuperconduct !== after.leaderSuperconduct) {
      changes.push(`${after.name} リーダー超電導：${after.leaderSuperconduct ? '次の物理ダメージ＋1' : '消費'}`)
    }
    if ((before.leaderBurningTurns ?? 0) !== (after.leaderBurningTurns ?? 0)) {
      changes.push(`${after.name} リーダー燃焼：残り${after.leaderBurningTurns ?? 0}ターン`)
    }
    const previousAmulets = new Set((before.amulets ?? []).map(a => a.instanceId))
    const nextAmulets = new Set((after.amulets ?? []).map(a => a.instanceId))
    for (const amulet of after.amulets ?? []) {
      if (!previousAmulets.has(amulet.instanceId)) changes.push(`${label(amulet.cardId)} を設置`)
    }
    for (const amulet of before.amulets ?? []) {
      if (!nextAmulets.has(amulet.instanceId)) changes.push(`${label(amulet.cardId)} が消滅`)
    }
  }
  if (previous.currentPlayerId !== next.currentPlayerId) {
    const owner = next.players.find(p => p.id === next.currentPlayerId)
    changes.push(`${owner?.name ?? ''} のターン開始`)
  }
  if (next.winnerId && previous.winnerId !== next.winnerId) {
    changes.push(`${next.players.find(p => p.id === next.winnerId)?.name ?? ''} の勝利`)
  }
  return changes
}

/** Drop frames that have no visual changes, keeping the starting title frame. */
export function compactPresentationFrames(
  initial: GameState,
  frames: readonly PresentationFrame[],
): PresentationFrame[] {
  let previous = withoutPresentation(initial)
  const result: PresentationFrame[] = []
  for (const frame of frames) {
    const changes = describePresentationChange(previous, frame.state)
    // An elemental reaction can be visually meaningful even when its damage
    // was recorded in an earlier frame or it only changes a transient effect.
    // Keep actual reaction cues so the renderer can play them in order.
    if (changes.length > 0 || frame.label.startsWith('元素反応：')) {
      result.push({ ...frame, label: changes.length > 0
        ? `${frame.label}：${changes.join(' ／ ')}` : frame.label })
    }
    previous = frame.state
  }
  return result
}
