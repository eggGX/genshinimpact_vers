import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const overlay = read('src/pixi/PixiBattleOverlay.tsx')
const summon = read('src/pixi/summonFx.ts')
const css = read('src/App.css')

test('follower arrivals and tokens reuse the established enteringPieces signal', () => {
  assert.match(app, /setEnteringPieces\(current=>new Set\(\[\.\.\.current,\.\.\.fresh\]\)\)/)
  assert.match(app, /data-pixi-summon-key=\{/)
  assert.match(app, /summoningKeys=\{enteringPieces\}/)
  assert.match(app, /field-entering field-entering--opponent/)
})

test('Pixi summon burst is launched only once at each mounted follower position', () => {
  assert.match(overlay, /playedSummons\.current\.has\(key\)/)
  assert.match(overlay, /playedSummons\.current\.add\(key\)/)
  assert.match(overlay, /\.follower-wrapper\.field-entering\[data-pixi-summon-key\]/)
  assert.match(overlay, /spawnSummonBurst\(/)
  assert.match(overlay, /prefers-reduced-motion: reduce/)
  assert.match(overlay, /pointerEvents: 'none'/)
})

test('summon particles clean themselves up; CSS-only entrance is unchanged', () => {
  assert.match(summon, /app\.ticker\.remove\(tick\)/)
  assert.match(summon, /graphics\.destroy\(\)/)
  assert.match(css, /@keyframes field-card-arrive-self/)
  assert.match(css, /@keyframes field-card-arrive-opponent/)
  assert.match(css, /:has\(> \.pixi-battle-overlay\).*field-entering\[data-pixi-summon-key\]/)
  assert.match(css, /display:none/)
})
