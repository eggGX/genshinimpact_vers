import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = source('src/App.tsx')
const lobby = source('src/components/FriendRoomLobby.tsx')
const presentation = source('server/src/onlinePresentation.ts')

test('draw animation compares committed actions rather than intermediate playback frames', () => {
  assert.match(app, /const next = game\.players\.map\(player=>/)
  assert.match(app, /\},\[localGame,online\?\.match\.revision,online\?\.match\.seat\]\)/)
  assert.match(app, /midX:window\.innerWidth/)
})

test('online mulligan result shows as soon as the local seat is ready', () => {
  assert.match(app, /online\.match\.mulliganReady\[online\.match\.seat\]/)
  assert.match(app, /online\?\.match\.phase === 'mulligan' && !mulliganReveal/)
})

test('online updates avoid re-rendering identical revisions and overlapping polls', () => {
  assert.match(lobby, /if \(inFlight\) return/)
  assert.match(lobby, /previous\.revision >= latest\.revision/)
})

test('online payload includes at most four sampled effect frames', () => {
  assert.match(presentation, /compact\.length <= 4/)
})

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})
after(async () => { await vite.close() })
const engine = await vite.ssrLoadModule('/src/game/engine.ts')
const { applyIndependentMulligan } = await vite.ssrLoadModule('/server/src/mulligan.ts')

test('Sumeru Wisdom draws one Dendro card and then a normal card', () => {
  let state = engine.createInitialGameState()
  state = engine.confirmMulligan(state, [])
  state = engine.confirmMulligan(state, [])
  const player = state.players[0]
  player.pp = 10
  player.maxPp = 10
  player.hand = ['C102']
  player.deck = ['C001', 'C101', 'C009']
  const next = engine.playCard(state, player.id, 0)
  assert.deepEqual(next.players[0].hand, ['C101', 'C001'])
  assert.deepEqual(next.players[0].deck, ['C009'])
})

test('first online mulligan leaves the other seat waiting while this seat is ready', () => {
  const state = engine.createInitialGameState()
  const result = applyIndependentMulligan(state, [false, false], 0, [])
  assert.deepEqual(result.mulliganReady, [true, false])
  assert.equal(result.state.phase, 'mulligan')
})
