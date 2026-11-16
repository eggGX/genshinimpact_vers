import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Source-contract regression: elemental hits must retain their printed element
// when routed through the shared stateful leader reaction resolver.
const source = path => readFileSync(new URL(`../src/game/${path}`, import.meta.url), 'utf8')
const cases = [
  ['neutralRules.ts', /resolveLeaderElementalHit\(result, enemyIndex, 1, element/],
  ['pyroLegendaryRules.ts', /resolveLeaderElementalHit\(result, enemyIndex, 3, 'pyro'/],
  ['pyroRules.ts', /dealLeaderDamage\(result, 1 - ownerIndex, 1, 'pyro'\)/],
  ['pyroRules.ts', /dealLeaderDamage\(result, enemyIndex, 1, 'pyro'\)/],
  ['hydroRules.ts', /resolveLeaderElementalHit\(state, 1-index, 1, 'hydro'/],
  ['cryoAdvancedRules.ts', /resolveLeaderElementalHit\(state, state\.players\.findIndex\(p=>p\.id===opponent\.id\), 1, 'cryo'/],
  ['electroRules.ts', /resolveLeaderElementalHit\(state, state\.players\.findIndex\(p => p\.id === enemy\.id\), 2, 'electro'/],
  ['electroAdvancedRules.ts', /resolveLeaderElementalHit\(result, result\.players\.findIndex\(p=>p\.id===enemy\.id\), 2, 'electro'/],
  ['anemoRules.ts', /resolveLeaderElementalHit\(state, state\.players\.findIndex\(p => p\.id === opponent\.id\), 2, 'anemo'/],
  ['anemoAdvancedRules.ts', /resolveLeaderElementalHit\(state, state\.players\.findIndex\(p=>p\.id===foe\.id\), value, 'anemo'/],
  ['geoRules.ts', /resolveLeaderElementalHit\(result, foeIndex, 1, 'geo'/],
  ['geoRules.ts', /resolveLeaderElementalHit\(result,1-i,2,'geo'/],
  ['dendroRules.ts', /resolveLeaderElementalHit\(state, state\.players\.findIndex\(p=>p\.id===other\.id\), 2, 'dendro'/],
  ['dendroRules.ts', /resolveLeaderElementalHit\(state,1-index,amount,'dendro'/],
  ['dendroRules.ts', /resolveLeaderElementalHit\(result,result\.players\.findIndex\(p=>p\.id===enemy\.id\),3,'dendro'/],
]
for (const [file, pattern] of cases) {
  test(`${file}: leader damage keeps its declared element`, () => {
    assert.match(source(file), pattern)
  })
}
test('non-elemental attacks remain non-elemental', () => {
  assert.match(source('electroRules.ts'), /resolveLeaderElementalHit\(state, state\.players\.findIndex\(p => p\.id === enemy\.id\), 1\)/)
  assert.match(source('geoRules.ts'), /resolveLeaderElementalHit\(state, state\.players\.findIndex\(p=>p\.id===opponent\.id\), 1\)/)
  assert.match(source('anemoAdvancedRules.ts'), /damageLeader\(target, 1\)/)
})
test('temporarily infused basic attacks use the same element for followers and leaders', () => {
  const engine = source('engine.ts')
  assert.match(engine, /const attackerElement = normalAttackElement\(boostedAttacker\)/)
  assert.match(engine, /resolveLeaderElementalHit\([\s\S]*?normalAttackElement\(boostedAttacker\)/)
})
test('leader damage stores aura and never attaches wind or geo', () => {
  const shield = source('leaderShield.ts')
  assert.match(shield, /leaderAura: nextAuras/)
  assert.match(shield, /\['none', 'anemo', 'geo'\]/)
})
