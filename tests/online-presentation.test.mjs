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
  assert.equal(event.playedCardId, 'C001')
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
  assert.equal(event.playedCardId, undefined)
  assert.equal(next.currentPlayerId, 'player2')
  assert.equal(event.frames[0].state.currentPlayerId,'player1')
  assert.equal(event.frames.at(-1).state.currentPlayerId,'player2')
})

test('invalid online actions do not create fake animation entries', () => {
  const state = started()
  assert.throws(() => recordOnlineAction(state, {type:'play',handIndex:8}, 5), /実行できない/)
})

test('a targeted card play reveals only the card actually played', () => {
  const state = started()
  state.players[0].hand = ['C001', 'C042']
  state.players[1].field = [{
    instanceId:'enemy-test',cardId:'C001',attack:1,health:4,maxHealth:4,
    skillUsed:false,burstUsed:false,aura:[],shield:{normal:0,crystallize:0},
    canAttack:false,hasAttacked:false,keywords:[],
  }]
  const { event } = recordOnlineAction(state, {type:'play',handIndex:1,targetId:'enemy-test'}, 6)
  assert.equal(event.playedCardId, 'C042')
  assert.notEqual(event.playedCardId, 'C001')
})
