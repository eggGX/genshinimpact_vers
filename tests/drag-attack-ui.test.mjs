import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const css = read('src/App.css')
const engine = read('src/game/engine.ts')

test('drag uses pointer capture and requires deliberate movement', () => {
  assert.match(app, /event\.currentTarget\.setPointerCapture\(event\.pointerId\)/)
  assert.match(app, /Math\.hypot\(event\.clientX - pointer\.startX, event\.clientY - pointer\.startY\) < 10/)
  assert.match(app, /onPointerDown=\{!isOpponent \? event => startAttackDrag/)
  assert.match(app, /onPointerMove=\{!isOpponent \? moveAttackDrag/)
  assert.match(app, /onPointerUp=\{!isOpponent \? event => finishAttackDrag/)
  assert.match(app, /onPointerCancel=\{!isOpponent \? event => finishAttackDrag\(event, true\)/)
})

test('dragging onto enemy leader portrait or follower uses existing combat actions', () => {
  assert.match(app, /data-attack-drop="leader"/)
  assert.match(app, /data-attack-drop=\{isOpponent \? follower\.instanceId : undefined\}/)
  assert.match(app, /document\.elementFromPoint\(x, y\)\?\.closest/)
  assert.match(app, /onlineSend\(\{ type: 'attackLeader', attackerId: pointer\.attackerId \}\)/)
  assert.match(app, /onlineSend\(\{ type: 'attackFollower', attackerId: pointer\.attackerId, targetId: target \}\)/)
  assert.match(app, /animateAction\(previous => attackLeader\(previous, pointer\.attackerId\)/)
  assert.match(app, /animateAction\(previous => attackFollower\(previous, pointer\.attackerId, target\)/)
  assert.match(engine, /export function attackFollower\(/)
  assert.match(engine, /export function attackLeader\(/)
})

test('invalid drops do not attack and native click still works', () => {
  assert.match(app, /if \(!target\) return/)
  assert.match(app, /if \(cancelled \|\| !onlineCanAct \|\| game\.winnerId !== null\) return/)
  assert.match(app, /if \(suppressDraggedClick\.current\) return/)
  assert.match(app, /handleSelectAttacker\(follower\)/)
  assert.match(app, /onClick=\{handleAttackLeader\}/)
  assert.match(css, /\.field-card\.can-attack\{touch-action:none/)
  assert.match(css, /\.attack-drag-ghost\{[\s\S]*?pointer-events:none/)
})

test('guard, stealth, intimidate and rush checks are reused for drag drop', () => {
  assert.match(app, /target\.keywords\.includes\('intimidate'\)/)
  assert.match(app, /target\.keywords\.includes\('stealth'\)/)
  assert.match(app, /isGuarded\(opponent\)/)
  assert.match(app, /attacker\.keywords\.includes\('plunge_attack'\)/)
  assert.match(app, /attacker\.keywords\.includes\('rush_only'\)/)
  assert.match(app, /canFollowerAttack\(attacker\)/)
})
