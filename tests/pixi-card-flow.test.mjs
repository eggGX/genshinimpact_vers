import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const css = read('src/App.css')
const engine = read('src/game/engine.ts')

test('unwanted draw and mulligan particles are removed without changing card travel', () => {
  assert.doesNotMatch(app, /PixiCardFlowOverlay/)
  assert.match(css, /@keyframes battle-draw-travel/)
  assert.match(css, /@keyframes battle-draw-flip/)
  assert.match(css, /@keyframes mulligan-card-in/)
  assert.match(css, /@keyframes mulligan-card-out/)
  assert.match(app, /drawFlights\.map\(flight=>/)
})

test('turn-end effects resolve before the engine switches player and draws', () => {
  const turn = engine.slice(engine.indexOf('export function endTurn('))
  const endEffects = turn.indexOf("'turn_end'")
  const burnAndCores = turn.indexOf('草原核：ターン終了時')
  const nextPlayer = turn.indexOf('result.turn + 1')
  const draw = turn.indexOf('次のプレイヤーがカードをドロー')
  assert.ok(endEffects >= 0 && burnAndCores > endEffects)
  assert.ok(nextPlayer > burnAndCores && draw > nextPlayer)
})

test('turn announcement follows the presented turn, not the final committed turn', () => {
  assert.match(app, /const shownGame = playback \? playback\.frames\[playback\.index\]\.state : game/)
  assert.match(app, /const turnKey = `\$\{shownGame\.turn\}:\$\{shownGame\.currentPlayerId\}`/)
  assert.match(app, /shownGame\.players\.find/)
  assert.match(app, /atTurnBoundary/)
  assert.match(app, /turnAnnouncement\?\.id === shownTurnKey/)
})

test('new-turn draw waits for banner dismissal while card-effect draws play immediately', () => {
  assert.match(app, /if \(turnAnnouncement\) return/)
  assert.match(app, /pendingTurnDrawFlights\.current\.push/)
  assert.match(app, /completedTurnAnnouncement\.current !== turnKey/)
  assert.match(app, /completedTurnAnnouncement\.current = turnAnnouncement\.id/)
  assert.match(app, /pendingTurnDrawFlights\.current\.some/)
  assert.match(app, /startDrawFlights\(flights, isSelf\)/)
  assert.match(app, /startDrawFlights\(entry\.flights, entry\.isSelf\)/)
  assert.match(app, /drawFlights\.length > 0/)
})
