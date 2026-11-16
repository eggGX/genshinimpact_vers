import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const backend = read('server/src/index.ts')
const frontend = read('src/online/matchClient.ts')
const lobby = read('src/components/FriendRoomLobby.tsx')
const rules = read('firestore.rules')
const serverManifest = JSON.parse(read('server/package.json'))

test('trusted match server validates caller Firebase ID token and room membership', () => {
  assert.match(backend, /auth\.verifyIdToken\(bearer\[1\], true\)/)
  assert.match(backend, /getSeat\(room, uid\)/)
  assert.match(backend, /room\.status !== 'playing'/)
})
test('game state and shuffling happen on server, inside transaction', () => {
  assert.match(backend, /tx\.get\(matchRef\)/)
  assert.match(backend, /createInitialGameState\(decks\)/)
  assert.match(backend, /tx\.create\(matchRef, stored\)/)
  assert.match(backend, /db\.collection\('onlineMatches'\)/)
})
test('client projection omits opponent hand and all deck orders', () => {
  assert.match(backend, /deckCount: player\.deck\.length/)
  assert.match(backend, /handCount: player\.hand\.length/)
  assert.match(backend, /index === seat \? \{ hand: player\.hand \} : \{\}/)
  assert.doesNotMatch(backend.slice(backend.indexOf('function projectState'),backend.indexOf('function getMatchRef')), /deck: player\.deck/)
  assert.match(rules, /allow read, write: if false/)
})
test('mulligan is independent for both seats and committed atomically', () => {
  const reducer = read('server/src/mulligan.ts')
  assert.match(backend, /applyIndependentMulligan/)
  assert.match(backend, /mulliganReady: stored\.mulliganReady \?\? \[false, false\]/)
  assert.match(reducer, /if \(flags\[seat\]\)/)
  assert.match(reducer, /mulliganReady\.every\(Boolean\)/)
  assert.match(reducer, /phase: bothReady \? 'main' : 'mulligan'/)
  assert.match(backend, /tx\.update\(matchRef, result\)/)
})
test('browser uses optional backend address and never uploads match state to Firestore', () => {
  assert.match(frontend, /VITE_MATCH_SERVER_URL/)
  assert.match(frontend, /Authorization: `Bearer \$\{token\}`/)
  assert.match(lobby, /isMatchServerConfigured\(\)/)
  assert.match(lobby, /submitOnlineMulligan/)
  assert.match(lobby, /onlineMatch\.mulliganReady\?\.\[onlineMatch\.seat\]/)
})
test('match server has isolated dependencies and admin SDK', () => {
  assert.ok(serverManifest.dependencies['firebase-admin'])
  assert.ok(serverManifest.dependencies.tsx)
})

test('server validates and routes main-phase actions by active player', () => {
  const commands = read('server/src/matchActions.ts')
  assert.match(backend, /stored\.state\.currentPlayerId !==/)
  assert.match(backend, /applyOnlineAction\(stored\.state, action as OnlineAction\)/)
  assert.match(backend, /stored\.revision !== revision/)
  assert.match(backend, /match\[2\] === 'action'/)
  for (const type of ["'play'", "'ability'", "'attackFollower'", "'attackLeader'", "'endTurn'"]) {
    assert.ok(commands.includes(type), `Missing action type ${type}`)
  }
  assert.match(commands, /exactKeys\(value,/)
  assert.match(commands, /export function validateOnlineAction/)
  assert.match(commands, /playCard\(state, ownerId, action.handIndex, action.targetId\)/)
  assert.match(commands, /activateAbility\(state, action.followerId, action.kind, action.targetId\)/)
  assert.match(commands, /endTurn\(state\)/)
})
test('client requests actions without writing complete game state', () => {
  const app = read('src/App.tsx')
  assert.match(frontend, /submitOnlineAction\(code: string, revision: number, action: OnlineAction\)/)
  assert.match(frontend, /requestMatch\(code, 'POST', 'action', \{ revision, action \}\)/)
  assert.match(lobby, /submitOnlineAction\(room.code, onlineMatch.revision, action\)/)
  assert.match(app, /Array\(p\.handCount\)\.fill\('hidden'\)/)
  assert.match(app, /Array\(p\.deckCount\)\.fill\('hidden'\)/)
})

test('online battle reuses the exact local battle scene with server commands', () => {
  const app = read('src/App.tsx')
  assert.match(app, /renderOnlineBattle=\{\(match, pending, onAction, onLeave\) => <App online=/)
  assert.match(lobby, /return <>\{renderOnlineBattle\(onlineMatch/)
  assert.doesNotMatch(lobby, /<OnlineMatchBoard/)
  assert.match(app, /className=\{\['game','game--battle'/)
  assert.match(app, /className="hand-cards"/)
  assert.match(app, /renderField\(opponent, true\)/)
  assert.match(app, /renderField\(currentPlayer, false\)/)
  assert.match(app, /onlineSend\(\{type:'attackLeader',attackerId\}\)/)
  assert.match(app, /onlineSend\(\{type:'endTurn'\}\)/)
  assert.match(app, /onlineCanAct/)
  assert.match(app, /createInitialGameState/)
  assert.match(app, /<BattleCardTooltip/)
})
test('online player names and status are sourced from server projections', () => {
  const game = read('src/game/engine.ts')
  assert.match(game, /createPlayer\('player1', '空'/)
  assert.match(game, /createPlayer\('player2', '蛍'/)
  assert.match(backend, /name: index === 0 \? '空' : '蛍'/)
  assert.match(backend, /leaderBurningTurns: player.leaderBurningTurns/)
  assert.match(backend, /bondOfLife: player.bondOfLife/)
})
