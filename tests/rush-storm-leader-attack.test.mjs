import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const anemo = readFileSync(new URL('../src/game/anemoAdvancedRules.ts', import.meta.url), 'utf8')

test('Rush-only restriction does not block leader attack after Storm is gained', () => {
  assert.match(engine, /attacker\.keywords\.includes\('rush_only'\) && !attacker\.keywords\.includes\('storm'\)/)
  assert.match(app, /selectedAttacker\.keywords\.includes\('rush_only'\) && !selectedAttacker\.keywords\.includes\('storm'\)/)
})
test('Xiao burst grants Storm and canAttack while retaining plunge attack', () => {
  assert.match(anemo, /if \(cardId === 'C084'\) return edit/)
  assert.match(anemo, /canAttack: true, keywords: \[\.\.\.new Set\(\[\.\.\.f\.keywords, 'storm', 'plunge_attack'/)
})
test('ordinary Rush-only minions still cannot attack the leader on arrival', () => {
  assert.match(engine, /card\.keywords\?\.includes\('rush'\) \? \['rush_only'\] : \[\]/)
  assert.match(engine, /attacker\.keywords\.includes\('rush_only'\) && !attacker\.keywords\.includes\('storm'\)/)
})
