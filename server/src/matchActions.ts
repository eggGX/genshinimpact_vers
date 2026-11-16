/**
 * Authoritative online commands. Never accept a client-computed GameState.
 * The caller's identity and active turn must be verified before this reducer.
 */
import {
  playCard, activateAbility, attackFollower, attackLeader, endTurn,
  type AbilityKind,
} from '../../src/game/engine.ts'
import type { GameState } from '../../src/game/types.ts'

export type OnlineAction =
  | { type: 'play'; handIndex: number; targetId?: string }
  | { type: 'ability'; followerId: string; kind: AbilityKind; targetId?: string }
  | { type: 'attackFollower'; attackerId: string; targetId: string }
  | { type: 'attackLeader'; attackerId: string }
  | { type: 'endTurn' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 120
}
function optionalTarget(value: unknown): value is string | undefined {
  return value === undefined || isId(value)
}
function exactKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(obj).every(key => keys.includes(key))
}

/** A strict allow-list prevents arbitrary object injection in action payloads. */
export function validateOnlineAction(value: unknown): OnlineAction {
  if (!isRecord(value) || typeof value.type !== 'string') throw new Error('不正な操作です')
  switch (value.type) {
    case 'play':
      if (!exactKeys(value, ['type', 'handIndex', 'targetId']) ||
          !Number.isInteger(value.handIndex) || (value.handIndex as number) < 0 ||
          (value.handIndex as number) > 8 || !optionalTarget(value.targetId)) break
      return value as OnlineAction
    case 'ability':
      if (!exactKeys(value, ['type', 'followerId', 'kind', 'targetId']) ||
          !isId(value.followerId) ||
          (value.kind !== 'skill' && value.kind !== 'burst') ||
          !optionalTarget(value.targetId)) break
      return value as OnlineAction
    case 'attackFollower':
      if (!exactKeys(value, ['type', 'attackerId', 'targetId']) ||
          !isId(value.attackerId) || !isId(value.targetId)) break
      return value as OnlineAction
    case 'attackLeader':
      if (!exactKeys(value, ['type', 'attackerId']) || !isId(value.attackerId)) break
      return value as OnlineAction
    case 'endTurn':
      if (!exactKeys(value, ['type'])) break
      return value as OnlineAction
  }
  throw new Error('操作の形式が不正です')
}

export function applyOnlineAction(state: GameState, payload: unknown): GameState {
  const action = validateOnlineAction(payload)
  const ownerId = state.currentPlayerId
  switch (action.type) {
    case 'play':
      return playCard(state, ownerId, action.handIndex, action.targetId)
    case 'ability':
      return activateAbility(state, action.followerId, action.kind, action.targetId)
    case 'attackFollower':
      return attackFollower(state, action.attackerId, action.targetId)
    case 'attackLeader':
      return attackLeader(state, action.attackerId)
    case 'endTurn':
      return endTurn(state)
  }
}
