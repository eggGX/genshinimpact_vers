
import type {
  CardEffect,
  EffectTrigger,
  GameState,
  Player,
} from './types'

/**
 * 共通カード効果を実行する
 *
 * ownerId: 効果を発動したプレイヤー
 * trigger: 発動タイミング
 */
export function resolveEffects(
  state: GameState,
  ownerId: string,
  effects: CardEffect[],
  trigger: EffectTrigger
): GameState {
  let result = state

  for (const effect of effects) {
    if (result.winnerId !== null) break
    if (effect.trigger !== trigger) continue

    result = applyEffect(result, ownerId, effect)
  }

  return result
}

/**
 * 単一効果の処理
 */
function applyEffect(
  state: GameState,
  ownerId: string,
  effect: CardEffect
): GameState {
  const ownerIndex = state.players.findIndex(
    player => player.id === ownerId
  )

  if (ownerIndex === -1) return state

  const targetIndex =
    effect.target === 'own_leader'
      ? ownerIndex
      : ownerIndex === 0
        ? 1
        : 0

  const targetPlayer = state.players[targetIndex]
  const value = Math.max(0, Math.floor(effect.value))

  let nextHealth = targetPlayer.leaderHealth

  switch (effect.type) {
    case 'damage':
      nextHealth = Math.max(
        0,
        targetPlayer.leaderHealth - value
      )
      break

    case 'heal':
      nextHealth = Math.min(
        targetPlayer.leaderMaxHealth,
        targetPlayer.leaderHealth + value
      )
      break
  }

  const nextPlayers = [...state.players] as [
    Player,
    Player,
  ]

  nextPlayers[targetIndex] = {
    ...targetPlayer,
    leaderHealth: nextHealth,
  }

  let winnerId = state.winnerId

  // リーダーが0になった場合の勝敗処理
  if (nextHealth <= 0 && effect.type === 'damage') {
    winnerId = nextPlayers[
      targetIndex === 0 ? 1 : 0
    ].id
  }

  return {
    ...state,
    players: nextPlayers,
    winnerId,
  }
}
