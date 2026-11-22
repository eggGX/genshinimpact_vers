import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const overlay = read('src/pixi/PixiBattleOverlay.tsx')
const trail = read('src/pixi/attackFx.ts')
const css = read('src/App.css')

test('attack trail reuses existing battle playback and never replaces legal combat', () => {
  assert.match(app, /const pixiAttackCue = \(\(\) => \{/)
  assert.match(app, /playback\.index !== 0/)
  assert.match(app, /attackTargetId\?: string/)
  assert.match(app, /playback\.attackTargetId/)
  assert.match(app, /attack=\{pixiAttackCue\}/)
  assert.match(css, /battle-attack-lunge/)
})

test('exact clicked and dragged targets are passed to local Pixi attack cue', () => {
  assert.ok(app.includes("pointer.attackerId, target)"))
  assert.ok(app.includes("attackerId, targetId)"))
  assert.ok(app.includes("attackerId, 'leader')"))
})

test('Pixi attack trail is pointer transparent and respects reduced motion', () => {
  assert.match(overlay, /spawnAttackTrail\(/)
  assert.match(overlay, /attack\?\.key/)
  assert.match(overlay, /prefers-reduced-motion: reduce/)
  assert.match(overlay, /pointerEvents: 'none'/)
  assert.match(trail, /app\.ticker\.remove\(tick\)/)
  assert.match(trail, /graphic\.destroy\(\)/)
})
