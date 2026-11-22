import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const cpu = read('src/game/cpuOpponent.ts')
const engine = read('src/game/engine.ts')

test('solo play fixes the human to Sora and the practice opponent to Lumine', () => {
  assert.match(app, /: shownGame\.players\[0\]/)
  assert.match(app, /: shownGame\.players\[1\]/)
  assert.match(app, /この2つのデッキでCPU対戦開始/)
  assert.match(app, /game\.currentPlayerId === 'player1'/)
  assert.match(app, /game\.winnerId === null && !playbackLock\.current/)
})

test('CPU automatically mulligans after human confirms and never controls online', () => {
  assert.match(app, /if \(online \|\| !matchStarted \|\| localGame\.phase !== 'mulligan'/)
  assert.match(app, /localGame\.currentPlayerId !== 'player2'/)
  assert.match(app, /confirmMulligan\(previous,replace\)/)
  assert.match(app, /localGame\.currentPlayerId !== 'player1'\) return/)
})

test('CPU is limited to its own turn and an action budget', () => {
  assert.match(cpu, /state\.currentPlayerId !== CPU_ID/)
  assert.match(cpu, /const MAX_ACTIONS = 28/)
  assert.match(cpu, /actionsTaken >= MAX_ACTIONS/)
  assert.match(cpu, /performCpuAction\(state,action\)/)
  assert.match(cpu, /case 'endTurn': return endTurn\(state\)/)
  assert.match(app, /completedTurnAnnouncement\.current !== turnKey/)
  assert.match(app, /playback \|\| playbackLock\.current \|\| turnAnnouncement \|\| mulliganReveal/)
})

test('CPU uses normal engine validation, legal targeting and existing animations', () => {
  for (const method of [
    'canPlayCard', 'canUseAbility', 'canFollowerAttack', 'attackFollower',
    'attackLeader', 'playCard', 'activateAbility', 'endTurn',
  ]) {
    assert.ok(cpu.includes(method), `missing engine integration ${method}`)
    assert.ok(engine.includes(`function ${method}(`) || engine.includes(`function ${method} (`))
  }
  assert.match(cpu, /needsFriendlyPlayTarget\(card\)/)
  assert.match(cpu, /needsAbilityTarget\(card,kind\)/)
  assert.match(app, /const traced = beginPresentation\(localGame\)/)
  assert.match(app, /compactPresentationFrames\(localGame,last\.presentationFrames/)
  assert.match(app, /playedCard:\{/)
})

test('CPU draw cards are hidden but player draws remain face-up', () => {
  assert.match(app, /const selfId=online \? game\.players\[online\.match\.seat\]\.id : game\.players\[0\]\.id/)
  assert.match(app, /const isSelf=player\.id===selfId/)
  assert.match(app, /cardId:isSelf&&getCard\(cards\[index\]\)\?cards\[index\]:undefined/)
})

import { after } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})
after(async () => { await vite.close() })
const gameEngine = await vite.ssrLoadModule('/src/game/engine.ts')
const cpuEngine = await vite.ssrLoadModule('/src/game/cpuOpponent.ts')

test('practice CPU can make legal moves and finish its own turn', () => {
  let state = gameEngine.createInitialGameState()
  state = gameEngine.confirmMulligan(state,[])
  state = gameEngine.confirmMulligan(state,[])
  state = gameEngine.endTurn(state)
  assert.equal(state.currentPlayerId,'player2')
  let actions = 0
  for (; actions < 30 && state.currentPlayerId === 'player2' &&
      state.winnerId === null; actions++) {
    const choice = cpuEngine.nextCpuAction(state,actions)
    assert.ok(choice,'CPU needs to select an action')
    assert.notStrictEqual(choice.result,state,'CPU should only apply accepted actions')
    state = choice.result
  }
  assert.ok(actions > 0)
  assert.ok(state.currentPlayerId !== 'player2' || state.winnerId !== null,
    'CPU must not stall with an unfinished turn')
})

test('practice CPU does not act on human turns or during mulligan', () => {
  const initial = gameEngine.createInitialGameState()
  assert.equal(cpuEngine.nextCpuAction(initial,0),null)
  const started = gameEngine.confirmMulligan(gameEngine.confirmMulligan(initial,[]),[])
  assert.equal(started.currentPlayerId,'player1')
  assert.equal(cpuEngine.nextCpuAction(started,0),null)
})
