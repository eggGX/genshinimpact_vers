
import type {
  CardEffect,
  EffectTrigger,
  Follower,
  GameState,
  Player,
} from './types'
import { grantShield, resolveElementalDamage, resolveReactionConsequence } from './elemental'

/**
 * 効果を順番に実行する。
 * targetId: 選択した敵フォロワー
 * sourceId: 効果の発動元フォロワー
 */
export function resolveEffects(
  state: GameState,
  ownerId: string,
  effects: CardEffect[],
  trigger: EffectTrigger,
  targetId?: string,
  sourceId?: string
): GameState {
  let result = state

  for (const effect of effects) {
    if (result.winnerId !== null) break
    if (effect.trigger !== trigger) continue

    result = applyEffect(
      result,
      ownerId,
      effect,
      targetId,
      sourceId
    )
  }

  return result
}

/**
 * ステータス変更処理
 */
function modifyFollower(
  follower: Follower,
  effect: Extract<CardEffect, { type: 'modify_stats' }>
): Follower {
  const attackDelta = Number.isFinite(effect.attackChange)
    ? Math.trunc(effect.attackChange)
    : 0

  const healthDelta = Number.isFinite(effect.healthChange)
    ? Math.trunc(effect.healthChange)
    : 0

  const maxHealth = Math.max(
    0,
    follower.maxHealth + healthDelta
  )

  // 体力の増減を現在体力にも反映する。
  const health = Math.min(
    maxHealth,
    follower.health + healthDelta
  )

  return {
    ...follower,
    attack: Math.max(0, follower.attack + attackDelta),
    maxHealth,
    health,
  }
}

function applyEffect(
  state: GameState,
  ownerId: string,
  effect: CardEffect,
  targetId?: string,
  sourceId?: string
): GameState {
  const ownerIndex = state.players.findIndex(
    p => p.id === ownerId
  )

  if (ownerIndex < 0) return state

  const enemyIndex = 1 - ownerIndex

  const players = [...state.players] as [Player, Player]

  // フォロワーを対象とする効果
  if (
    effect.target === 'self_follower' ||
    effect.target === 'selected_enemy_follower'
  ) {
    const targetIndex =
      effect.target === 'self_follower'
        ? ownerIndex
        : enemyIndex

    const instanceId =
      effect.target === 'self_follower'
        ? sourceId
        : targetId

    if (!instanceId) return state

    const targetPlayer = players[targetIndex]

    if (
      !targetPlayer.field.some(
        f => f.instanceId === instanceId
      )
    ) {
      return state
    }

    let reaction: ReturnType<typeof resolveElementalDamage>['reaction'] = null
    let reactedElement: ReturnType<typeof resolveElementalDamage>['reactedElement']

    players[targetIndex] = {
      ...targetPlayer,
      field: targetPlayer.field.map(follower => {
        if (follower.instanceId !== instanceId) {
          return follower
        }

        if (effect.type === 'modify_stats') {
          return modifyFollower(follower, effect)
        }

        if (effect.type === 'grant_shield') {
          return grantShield(follower, effect.shieldType, effect.value)
        }

        const value = Number.isFinite(effect.value)
          ? Math.max(0, Math.floor(effect.value))
          : 0

        if (effect.type === 'damage') {
          const outcome = resolveElementalDamage(
            follower,
            value,
            effect.element
          )
          reaction = outcome.reaction
          reactedElement = outcome.reactedElement
          return outcome.follower
        }

        return {
          ...follower,
          health: Math.min(
            follower.maxHealth,
            follower.health + value
          ),
        }
      }),
    }

    return resolveReactionConsequence(
      { ...state, players },
      targetIndex,
      instanceId,
      reaction,
      reactedElement,
      ownerIndex
    )
  }

  // リーダー対象の効果
  if (effect.type === 'modify_stats' || effect.type === 'grant_shield') {
    return state
  }

  const targetIndex =
    effect.target === 'own_leader'
      ? ownerIndex
      : enemyIndex

  const targetPlayer = players[targetIndex]

  const value = Number.isFinite(effect.value)
    ? Math.max(0, Math.floor(effect.value))
    : 0

  const health =
    effect.type === 'damage'
      ? Math.max(0, targetPlayer.leaderHealth - value)
      : Math.min(
          targetPlayer.leaderMaxHealth,
          targetPlayer.leaderHealth + value
        )

  players[targetIndex] = {
    ...targetPlayer,
    leaderHealth: health,
  }

  return {
    ...state,
    players,
    winnerId:
      effect.type === 'damage' && health <= 0
        ? players[1 - targetIndex].id
        : state.winnerId,
  }
}
