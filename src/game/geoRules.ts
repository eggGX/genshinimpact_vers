import type { GameState, Player } from './types'
import { getCard } from '../data/cardRegistry'
import { addLeaderShield, healLeader, damageLeader } from './leaderShield'
import { grantShield } from './elemental'

let nextLiyueHarborId = 1

function update(state: GameState, ownerId: string, modify: (p: Player) => Player): GameState {
  const index = state.players.findIndex(p => p.id === ownerId)
  if (index < 0) return state
  const players = [...state.players] as [Player, Player]
  players[index] = modify(players[index])
  return { ...state, players }
}

/** C087 Liyue Harbor: a three-turn countdown tutor amulet. */
export function geoAmuletPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C087' || state.winnerId !== null) return state
  return update(state, ownerId, p => ({ ...p,
    amulets: [...(p.amulets ?? []), {
      instanceId: `liyue-harbor-${nextLiyueHarborId++}`,
      cardId: 'C087', turnsRemaining: 3,
    }],
  }))
}

/** Resolve in placement order; cards with Liyue as one of several regions qualify. */
export function geoAmuletsTurnEnd(state: GameState, ownerId: string): GameState {
  if (state.winnerId !== null) return state
  const ids = (state.players.find(p => p.id === ownerId)?.amulets ?? [])
    .filter(a => a.cardId === 'C087').map(a => a.instanceId)
  let result = state
  for (const id of ids) {
    result = update(result, ownerId, p => {
      const matches = p.deck.map((cardId, index) => ({ cardId, index }))
        .filter(({ cardId }) => getCard(cardId)?.region?.includes('璃月'))
      const chosen = matches[Math.floor(Math.random() * matches.length)]
      return { ...p,
        deck: chosen ? p.deck.filter((_, i) => i !== chosen.index) : p.deck,
        hand: chosen && p.hand.length < 9 ? [...p.hand, chosen.cardId] : p.hand,
        amulets: (p.amulets ?? []).map(a => a.instanceId === id
          ? { ...a, turnsRemaining: a.turnsRemaining - 1 } : a)
          .filter(a => a.turnsRemaining > 0),
      }
    })
  }
  return result
}

/** C096 Gorou: play buff includes Gorou and all existing Geo followers. */
export function geoPlay(state: GameState, ownerId: string, cardId: string): GameState {
  if (cardId !== 'C096' || state.winnerId !== null) return state
  return update(state, ownerId, p => ({
    ...p, field: p.field.map(f => getCard(f.cardId)?.element === 'geo' && f.health > 0
      ? { ...f, health: f.health + 1, maxHealth: f.maxHealth + 1 } : f),
  }))
}

/** C094 Noelle shields herself and her leader; C096 buffs every friendly Geo follower. */
export function geoSkill(state: GameState, ownerId: string, sourceId: string, cardId: string): GameState {
  if (state.winnerId !== null) return state
  if (cardId === 'C094') return update(state, ownerId, p => ({
    ...addLeaderShield(p, 3),
    field: p.field.map(f => f.instanceId === sourceId ? grantShield(f, 'normal', 3) : f),
  }))
  if (cardId === 'C096') return update(state, ownerId, p => ({
    ...p, field: p.field.map(f => getCard(f.cardId)?.element === 'geo' && f.health > 0
      ? { ...f, attack: f.attack + 1, health: f.health + 1, maxHealth: f.maxHealth + 1 } : f),
  }))
  return state
}

/** Attack declaration: baby vishap gains crystallize shield, geo hound deals 1, Noelle heals 2. */
export function geoAttack(state: GameState, ownerId: string, attackerId: string): GameState {
  if (state.winnerId !== null) return state
  const owner = state.players.find(p => p.id === ownerId)
  const attacker = owner?.field.find(f => f.instanceId === attackerId && f.health > 0)
  if (!owner || !attacker) return state
  if (attacker.cardId === 'C089') return update(state, ownerId, p => addLeaderShield(p, 1, 'crystallize'))
  if (attacker.cardId === 'C094') return update(state, ownerId, p => healLeader(p, 2))
  if (attacker.cardId === 'C092') {
    const opponent = state.players.find(p => p.id !== ownerId)
    if (!opponent) return state
    const damaged = damageLeader(opponent, 1)
    return { ...update(state, opponent.id, () => damaged),
      winnerId: damaged.leaderHealth === 0 ? ownerId : state.winnerId }
  }
  return state
}

/** C093 vishap: engagement by either side grants the vishap owner crystallize shield 2. */
export function geoEngage(
  state: GameState, attackingOwnerId: string, attackerId: string, defenderId: string
): GameState {
  if (state.winnerId !== null) return state
  const own = state.players.find(p => p.id === attackingOwnerId)
  const foe = state.players.find(p => p.id !== attackingOwnerId)
  if (!own || !foe) return state
  const attacker = own.field.find(f => f.instanceId === attackerId)
  const defender = foe.field.find(f => f.instanceId === defenderId)
  if (attacker?.cardId === 'C093') return update(state, own.id, p => addLeaderShield(p, 2, 'crystallize'))
  if (defender?.cardId === 'C093') return update(state, foe.id, p => addLeaderShield(p, 2, 'crystallize'))
  return state
}
