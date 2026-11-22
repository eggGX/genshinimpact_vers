import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const engine = read('src/game/engine.ts')
const overlay = read('src/pixi/PixiBattleOverlay.tsx')
const effect = read('src/pixi/destructionFx.ts')
const app = read('src/App.tsx')
const css = read('src/App.css')

test('destroyed followers leave the authoritative field before Last Words resolve', () => {
  const remove = engine.indexOf('field: player.field.filter(f => f.health > 0)')
  const deathFrame = engine.indexOf("captureFrame(result, '通常攻撃などによるフォロワー破壊')")
  const lastWord = engine.indexOf("'on_destroy',", deathFrame)
  assert.ok(remove >= 0 && deathFrame > remove && lastWord > deathFrame)
})

test('Pixi battle effects are mounted automatically on the normal duel screen', () => {
  assert.match(app, /<PixiBattleOverlay cue=\{playback && playback\.index > 0/)
  assert.doesNotMatch(app, /has\('pixi-overlay'\)/)
  assert.match(overlay, /pixi-battle-overlay--ready/)
  assert.match(css, /:has\(> \.pixi-battle-overlay--ready\)/)
})

test('Pixi destruction targets only the transient non-interactive death ghost', () => {
  assert.match(app, /className="follower-wrapper battle-destroying"/)
  assert.match(app, /style=\{\{ animationDuration: `\$\{playbackDelay\}ms` \}\}/)
  assert.match(overlay, /querySelectorAll<HTMLElement>\(\s*'\.follower-wrapper\.battle-destroying'/)
  assert.match(overlay, /spawnDestructionBurst\(/)
  assert.match(overlay, /Math\.min\(frameDuration \* 0\.85, 780\)/)
  assert.match(overlay, /prefers-reduced-motion: reduce/)
  assert.match(overlay, /pointerEvents: 'none'/)
})

test('CSS-only destruction survives and Pixi dissolution is selectively enabled', () => {
  assert.match(css, /@keyframes battle-destruction-exit/)
  assert.match(css, /:has\(> \.pixi-battle-overlay--ready\)/)
  assert.match(css, /@keyframes battle-pixi-card-fade/)
  assert.match(css, /\.battle-destruction-flash \{\s*display:none/)
  assert.match(effect, /app\.ticker\.remove\(tick\)/)
  assert.match(effect, /particles\.destroy\(\)/)
})
