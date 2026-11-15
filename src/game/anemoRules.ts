import type { Follower, GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { damageLeader } from './leaderShield'
import { summonFollowers } from './neutralRules'

let nextMondstadtCityId = 1

function editOwner(state: GameState, ownerId: string, fn: (p: Player) => Player): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const players = [...state.players] as [Player, Player]
  players[index] = fn(players[index])
  return { ...state, players }
}

/** C072: Mondstadt City, with a three-turn countdown and shared board slots. */
export function resolveAnemoAmuletPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C072' || state.winnerId !== null) return state
  return editOwner(state, ownerId, p => ({
    ...p,
    amulets: [...(p.amulets ?? []), {
      instanceId: `mondstadt-city-${nextMondstadtCityId++}`,
      cardId: 'C072',
      turnsRemaining: 3,
    }],
  }))
}

/** C072: tutor one random Mondstadt-region card per own turn, then countdown. */
export function resolveAnemoAmuletsTurnEnd(state: GameState, ownerId: string): GameState {
  if (state.winnerId !== null) return state
  const owner = state.players.find(p => p.id === ownerId)
  if (!owner) return state
  const amuletIds = (owner.amulets ?? [])
    .filter(a => a.cardId === 'C072').map(a => a.instanceId)
  let result = state
  for (const id of amuletIds) {
    const current = result.players.find(p => p.id === ownerId)
    if (!current?.amulets?.some(a => a.instanceId === id)) continue
    result = editOwner(result, ownerId, p => {
      const matches = p.deck
        .map((cardId, index) => ({ cardId, index }))
        .filter(({ cardId }) => getCard(cardId)?.region?.includes('モンド'))
      const pick = matches[Math.floor(Math.random() * matches.length)]
      return {
        ...p,
        deck: pick ? p.deck.filter((_, i) => i !== pick.index) : p.deck,
        hand: pick && p.hand.length < 9 ? [...p.hand, pick.cardId] : p.hand,
        amulets: (p.amulets ?? []).map(a => a.instanceId === id
          ? { ...a, turnsRemaining: a.turnsRemaining - 1 } : a)
          .filter(a => a.turnsRemaining > 0),
      }
    })
  }
  return result
}

/** C074: the wind Specter's last word deals two to the enemy leader. */
export function resolveAnemoDestroy(state: GameState, ownerId: string, source: Follower): GameState {
  if (state.winnerId !== null || source.cardId !== 'C074') return state
  const opponent = state.players.find(p => p.id !== ownerId)
  if (!opponent) return state
  const damaged = damageLeader(opponent, 2)
  return {
    ...editOwner(state, opponent.id, () => damaged),
    winnerId: damaged.leaderHealth === 0 ? ownerId : state.winnerId,
  }
}

/** C077: on attack declaration, summon one normal Hilichurl. */
export function resolveAnemoAttack(state: GameState, ownerId: string, sourceId: string): GameState {
  if (state.winnerId !== null) return state
  const source = state.players.find(p => p.id === ownerId)?.field.find(f => f.instanceId === sourceId)
  if (source?.cardId !== 'C077') return state
  return summonFollowers(state, ownerId, 'C001', 1)
}

/** C082 Lynette: tutor a random wind-element spell at play, without drawing from an empty deck. */
export function resolveAnemoPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C082' || state.winnerId !== null) return state
  return editOwner(state, ownerId, p => {
    const matches = p.deck.map((id, index) => ({ id, index }))
      .filter(({ id }) => {
        const card = getCard(id)
        return card?.type === 'spell' && card.element === 'anemo'
      })
    const chosen = matches[Math.floor(Math.random() * matches.length)]
    return chosen ? {
      ...p,
      deck: p.deck.filter((_, index) => index !== chosen.index),
      hand: p.hand.length < 9 ? [...p.hand, chosen.id] : p.hand,
    } : p
  })
}

/** C080 self attack +1; C082 self heal +1, after their normal anemo skill damage. */
export function resolveAnemoSkill(state: GameState, ownerId: string, sourceId: string, cardId: string): GameState {
  if (state.winnerId !== null || !['C080', 'C082'].includes(cardId)) return state
  return editOwner(state, ownerId, p => ({
    ...p,
    field: p.field.map(f => f.instanceId === sourceId
      ? cardId === 'C080'
        ? { ...f, attack: f.attack + 1 }
        : { ...f, health: Math.min(f.maxHealth, f.health + 1) }
      : f),
  }))
}
