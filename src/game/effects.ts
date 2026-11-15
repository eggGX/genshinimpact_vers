
import type {
  CardEffect,
  EffectTrigger,
  GameState,
  Player,
} from './types'

export function resolveEffects(
  state: GameState,
  ownerId: string,
  effects: CardEffect[],
  trigger: EffectTrigger,
  targetId?: string
): GameState {
  let result = state

  for (const effect of effects) {
    if (result.winnerId !== null) break
    if (effect.trigger !== trigger) continue

    result = applyEffect(
      result,
      ownerId,
      effect,
      targetId
    )
  }

  return result
}

function applyEffect(
  state: GameState,
  ownerId: string,
  effect: CardEffect,
  targetId?: string
): GameState {
  const ownerIndex = state.players.findIndex(
    player => player.id === ownerId
  )

  if (ownerIndex === -1) return state

  const enemyIndex = ownerIndex === 0 ? 1 : 0

  const value = Number.isFinite(effect.value)
    ? Math.max(0, Math.floor(effect.value))
    : 0

  const nextPlayers = [...state.players] as [
    Player,
    Player,
  ]

  if (effect.target === 'selected_enemy_follower') {
    if (!targetId) return state

    const enemy = nextPlayers[enemyIndex]

    if (!enemy.field.some(
      follower => follower.instanceId === targetId
    )) {
      return state
    }

    nextPlayers[enemyIndex] = {
      ...enemy,
      field: enemy.field.map(follower => {
        if (follower.instanceId !== targetId) {
          return follower
        }

        const health =
          effect.type === 'damage'
            ? follower.health - value
            : Math.min(
                follower.maxHealth,
                follower.health + value
              )

        return { ...follower, health }
      }),
    }

    return {
      ...state,
      players: nextPlayers,
    }
  }

  const targetIndex =
    effect.target === 'own_leader'
      ? ownerIndex
      : enemyIndex

  const targetPlayer = nextPlayers[targetIndex]

  const nextHealth =
    effect.type === 'damage'
      ? Math.max(
          0,
          targetPlayer.leaderHealth - value
        )
      : Math.min(
          targetPlayer.leaderMaxHealth,
          targetPlayer.leaderHealth + value
        )

  nextPlayers[targetIndex] = {
    ...targetPlayer,
    leaderHealth: nextHealth,
  }

  return {
    ...state,
    players: nextPlayers,
    winnerId:
      nextHealth <= 0 && effect.type === 'damage'
        ? nextPlayers[
            targetIndex === 0 ? 1 : 0
          ].id
        : state.winnerId,
  }
}
