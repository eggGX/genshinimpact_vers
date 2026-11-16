/**
 * Both players mulligan independently. This reducer mutates no input state;
 * the Firestore transaction stores readiness and game state atomically.
 */
import { randomInt } from 'node:crypto'
import type { GameState, Player } from '../../src/game/types.ts'

export type MulliganFlags = [boolean, boolean]

function shuffled(cards: string[]): string[] {
  const result = [...cards]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function applyIndependentMulligan(
  state: GameState, flags: MulliganFlags, seat: 0 | 1, indices: readonly number[],
): { state: GameState; mulliganReady: MulliganFlags } {
  if (state.phase !== 'mulligan') throw new Error('マリガンは終了しています')
  if (flags[seat]) throw new Error('マリガンはすでに確定しています')
  if (indices.length > 4 || new Set(indices).size !== indices.length ||
      !indices.every(i => Number.isInteger(i) && i >= 0 && i < state.players[seat].hand.length)) {
    throw new Error('マリガンの指定が不正です')
  }

  const player = state.players[seat]
  const chosen = new Set(indices)
  const returned = player.hand.filter((_, i) => chosen.has(i))
  const kept = player.hand.filter((_, i) => !chosen.has(i))
  const deck = shuffled([...player.deck, ...returned])
  const updated: Player = {
    ...player,
    hand: [...kept, ...deck.slice(0, returned.length)],
    deck: deck.slice(returned.length),
  }
  const players: [Player, Player] = [...state.players] as [Player, Player]
  players[seat] = updated
  const mulliganReady: MulliganFlags = [...flags] as MulliganFlags
  mulliganReady[seat] = true
  const bothReady = mulliganReady.every(Boolean)
  if (bothReady) {
    players[0] = { ...players[0], pp: 1, maxPp: 1 }
  }
  return {
    state: {
      ...state,
      players,
      currentPlayerId: 'player1',
      turn: 1,
      phase: bothReady ? 'main' : 'mulligan',
    },
    mulliganReady,
  }
}
