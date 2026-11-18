import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const css = read('src/App.css')

test('hand drag uses pointer capture with a movement threshold and does not trigger click', () => {
  assert.match(app, /const startHandDrag = \(event:/)
  assert.match(app, /setPointerCapture\(event\.pointerId\)/)
  assert.match(app, /const moveHandDrag = \(event:/)
  assert.match(app, /Math\.hypot\(event\.clientX - pointer\.startX, event\.clientY - pointer\.startY\) < 10/)
  assert.match(app, /onPointerDown=\{event => startHandDrag\(event, index\)\}/)
  assert.match(app, /onPointerUp=\{event => finishHandDrag\(event\)\}/)
  assert.match(app, /onPointerCancel=\{event => finishHandDrag\(event, true\)\}/)
  assert.match(app, /if \(!suppressHandDragClick\.current\) handlePlayCard\(index\)/)
})

test('hand release plays only within own field; click still uses existing play handler', () => {
  assert.match(app, /data-hand-play-zone=\{!isOpponent \? 'self' : undefined\}/)
  assert.match(app, /document\.elementFromPoint\(x, y\)\?\.closest\('\[data-hand-play-zone="self"\]'\)/)
  assert.match(app, /handOverOwnField\(event\.clientX, event\.clientY\)/)
  assert.match(app, /handlePlayCard\(pointer\.handIndex, true\)/)
  assert.match(app, /if \(!canPlayCard\(game, handIndex\)\) return/)
  assert.match(app, /if \(online\) onlineSend\(\{type:'play',handIndex\}\)/)
})

test('targeted plays select target by click after drop, not by drop position', () => {
  assert.match(app, /const handlePlayCard = \(handIndex: number, fromDrag = false\)/)
  assert.match(app, /fromDrag \? handIndex : previous === handIndex \? null : handIndex/)
  assert.match(app, /needsPlayTarget\(card\)/)
  assert.match(app, /needsFriendlyPlayTarget\(card\)/)
  assert.match(app, /handleEnemyFollowerClick\(follower\.instanceId\)/)
  assert.doesNotMatch(app.split('const finishHandDrag =')[1]?.split('const handleUseAbility =')[0] ?? '', /targetId:/)
})

test('invalid drops and Fa?rka hand-cost choice do not trigger a card play', () => {
  assert.match(app, /if \(!cancelled && onlineCanAct && canPlayCard\(game, pointer\.handIndex\) &&/)
  assert.match(app, /f\.cardId === 'C083'/)
  assert.match(app, /onPointerCancel=\{event => finishHandDrag\(event, true\)\}/)
  assert.match(css, /\.hand-card:not\(:disabled\)\{touch-action:none/)
  assert.match(css, /\.hand-drag-ghost\{[\s\S]*?pointer-events:none/)
  assert.match(css, /\.card-slot\.hand-play-drop-hover/)
})
