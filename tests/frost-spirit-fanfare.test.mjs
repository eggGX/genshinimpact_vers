import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom', logLevel: 'error',
})
after(async () => { await vite.close() })
const engine = await vite.ssrLoadModule('/src/game/engine.ts')
const { createSummonedFollower } = await vite.ssrLoadModule('/src/game/neutralRules.ts')

function ready(withAlly = true) {
  const state = engine.createInitialGameState()
  state.phase = 'main'
  state.currentPlayerId = state.players[0].id
  state.players[0].pp = 10
  state.players[0].maxPp = 10
  state.players[0].hand = ['C044']
  state.players[0].field = withAlly ? [createSummonedFollower('C001')] : []
  return state
}

test('Frost Spirit fanfare cannot target itself', () => {
  const state = ready()
  const after = engine.playCard(state, 'player1', 0, 'self')
  assert.equal(after, state)
})

test('Frost Spirit buffs another selected friendly follower by +2 attack', () => {
  const state = ready()
  const ally = state.players[0].field[0]
  const after = engine.playCard(state, 'player1', 0, ally.instanceId)
  assert.equal(after.players[0].field.length, 2)
  assert.equal(after.players[0].field[0].attack, ally.attack + 2)
  assert.equal(after.players[0].field[1].cardId, 'C044')
  assert.equal(after.players[0].field[1].attack, 2)
})

test('Frost Spirit without an ally can still be played without a fanfare buff', () => {
  const state = ready(false)
  const after = engine.playCard(state, 'player1', 0)
  assert.equal(after.players[0].field.length, 1)
  assert.equal(after.players[0].field[0].cardId, 'C044')
  assert.equal(after.players[0].field[0].attack, 2)
})

test('Frost Spirit must select an ally if a valid existing ally is available', () => {
  const state = ready()
  assert.equal(engine.playCard(state, 'player1', 0), state)
})

test('card description excludes itself', () => {
  assert.match(engine.getCard('C044').description, /自分の場の他のフォロワー1枚を選ぶ/)
})
