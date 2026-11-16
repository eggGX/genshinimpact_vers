import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})
after(async () => { await vite.close() })
const engine = await vite.ssrLoadModule('/src/game/engine.ts')
const { recordOnlineAction } = await vite.ssrLoadModule('/server/src/onlinePresentation.ts')

function started() {
  let state = engine.createInitialGameState()
  state = engine.confirmMulligan(state, [])
  state = engine.confirmMulligan(state, [])
  state.players[0].pp = 10
  state.players[0].maxPp = 10
  state.players[0].hand = ['C001']
  return state
}

test('online card play records accurate server-authoritative frames and name', () => {
  const state = started()
  const { next, event } = recordOnlineAction(state, {type:'play',handIndex:0}, 3)
  assert.equal(event.revision, 3)
  assert.equal(event.actorId, 'player1')
  assert.match(event.title, /空.*ヒルチャール/)
  assert.equal(event.frames[0].state.players[0].field.length, 0)
  assert.ok(next.players[0].field.some(f => f.cardId === 'C001'))
  assert.ok(event.frames.at(-1).state.players[0].field.some(f => f.cardId === 'C001'))
  assert.ok(event.frames.every(f => f.state.presentationFrames === undefined))
  assert.deepEqual(state.players[0].hand, ['C001'])
})

test('end turn is recorded with a new-turn snapshot', () => {
  const state = started()
  const { next, event } = recordOnlineAction(state, {type:'endTurn'}, 4)
  assert.match(event.title, /空.*ターン終了/)
  assert.equal(next.currentPlayerId, 'player2')
  assert.equal(event.frames[0].state.currentPlayerId,'player1')
  assert.equal(event.frames.at(-1).state.currentPlayerId,'player2')
})

test('invalid online actions do not create fake animation entries', () => {
  const state = started()
  assert.throws(() => recordOnlineAction(state, {type:'play',handIndex:8}, 5), /実行できない/)
})
