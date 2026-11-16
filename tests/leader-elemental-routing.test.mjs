import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Source-contract regression test: custom ability damage must retain its
// printed element when it reaches the shared leader damage resolver.
const source = path => readFileSync(new URL(`../src/game/${path}`, import.meta.url), 'utf8')
const cases = [
  ['neutralRules.ts', /damageLeader\(enemy, 1, element\)/],
  ['pyroLegendaryRules.ts', /damageLeader\(enemy, 3, 'pyro'\)/],
  ['pyroRules.ts', /dealLeaderDamage\(result, 1 - ownerIndex, 1, 'pyro'\)/],
  ['pyroRules.ts', /dealLeaderDamage\(result, enemyIndex, 1, 'pyro'\)/],
  ['hydroRules.ts', /damageLeader\(enemy, 1, 'hydro'\)/],
  ['cryoAdvancedRules.ts', /damageLeader\(opponent, 1, 'cryo'\)/],
  ['electroRules.ts', /damageLeader\(enemy, 2, 'electro'\)/],
  ['electroAdvancedRules.ts', /damageLeader\(enemy, 2, 'electro'\)/],
  ['anemoRules.ts', /damageLeader\(opponent, 2, 'anemo'\)/],
  ['anemoAdvancedRules.ts', /damageLeader\(foe, value, 'anemo'\)/],
  ['geoRules.ts', /damageLeader\(enemy, 1, 'geo'\)/],
  ['geoRules.ts', /damageLeader\(foe,2,'geo'\)/],
  ['dendroRules.ts', /damageLeader\(other, 2, 'dendro'\)/],
  ['dendroRules.ts', /damageLeader\(foe,amount,'dendro'\)/],
  ['dendroRules.ts', /damageLeader\(enemy,3,'dendro'\)/],
]
for (const [file, pattern] of cases) {
  test(`${file}: leader damage keeps its declared element`, () => {
    assert.match(source(file), pattern)
  })
}
test('non-elemental attacks remain non-elemental', () => {
  assert.match(source('electroRules.ts'), /damageLeader\(enemy, 1\)/)
  assert.match(source('geoRules.ts'), /damageLeader\(opponent, 1\)/)
  assert.match(source('anemoAdvancedRules.ts'), /damageLeader\(target, 1\)/)
})
test('temporarily infused basic attacks use the same element for followers and leaders', () => {
  const engine = source('engine.ts')
  assert.match(engine, /const attackerElement = normalAttackElement\(boostedAttacker\)/)
  assert.match(engine, /damageLeader\([\s\S]*?normalAttackElement\(boostedAttacker\)/)
})
test('leader damage stores aura and never attaches wind or geo', () => {
  const shield = source('leaderShield.ts')
  assert.match(shield, /leaderAura: nextAuras/)
  assert.match(shield, /\['none', 'anemo', 'geo'\]/)
})
