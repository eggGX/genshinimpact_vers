import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8')
const ui = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const hydro = readFileSync(new URL('../src/game/hydroRules.ts', import.meta.url), 'utf8')

test('Raincutter appears in the ally-target selection UI', () => {
  assert.match(ui, /\['C021', 'C044', 'C066', 'C081', 'C030'\]\.includes\(friendlyPlayId/)
  assert.match(ui, /古華剣・裁雨留虹：効果を付与する味方フォロワーを選択してください/)
})
test('Raincutter cannot be cast without a living ally or with the self-fanfare target', () => {
  assert.match(engine, /card\.id === 'C030' && !owner\.field\.some\(f => f\.health > 0\)/)
  assert.match(engine, /card\.id === 'C030'[\s\S]*?targetId === 'self'/)
})
test('Raincutter damages the declared attack target with Hydro before combat', () => {
  assert.match(engine, /const swept = raincutterAttackFollower\(/)
  assert.match(engine, /const triggered = raincutterAttackLeader\(/)
  assert.match(hydro, /resolveElementalDamage\(target, 1, 'hydro'\)/)
  assert.match(hydro, /damageLeader\(enemy, 1, 'hydro'\)/)
})
