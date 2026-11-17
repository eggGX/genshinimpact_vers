import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom', logLevel: 'error',
})
after(async () => { await vite.close() })

const { resolveElementalDamage, applyElementalAura } = await vite.ssrLoadModule('/src/game/elemental.ts')
const { createSummonedFollower } = await vite.ssrLoadModule('/src/game/neutralRules.ts')

function follower() {
  return createSummonedFollower('C001')
}

test('Dendro then Cryo leaves only Cryo attached (no reaction)', () => {
  const dendro = resolveElementalDamage(follower(), 0, 'dendro')
  const cryo = resolveElementalDamage(dendro.follower, 0, 'cryo')
  assert.equal(cryo.reaction, null)
  assert.deepEqual(cryo.follower.aura.map(x => x.element), ['cryo'])
})

test('Cryo then Dendro leaves only Dendro attached (no reaction)', () => {
  const cryo = resolveElementalDamage(follower(), 0, 'cryo')
  const dendro = resolveElementalDamage(cryo.follower, 0, 'dendro')
  assert.equal(dendro.reaction, null)
  assert.deepEqual(dendro.follower.aura.map(x => x.element), ['dendro'])
})

test('Repeated same element stays attached once', () => {
  const first = resolveElementalDamage(follower(), 1, 'pyro')
  const second = resolveElementalDamage(first.follower, 1, 'pyro')
  assert.equal(second.reaction, null)
  assert.deepEqual(second.follower.aura.map(x => x.element), ['pyro'])
})

test('Reactive elements still consume both elements', () => {
  const pyro = resolveElementalDamage(follower(), 1, 'pyro')
  const hydro = resolveElementalDamage(pyro.follower, 1, 'hydro')
  assert.equal(hydro.reaction, 'vaporize')
  assert.deepEqual(hydro.follower.aura, [])
})

test('Elemental creatures retain their inherent element including Anemo and Geo', () => {
  for (const [id, element] of [['C041', 'cryo'], ['C071', 'anemo'], ['C086', 'geo']]) {
    const creature = createSummonedFollower(id)
    const hit = resolveElementalDamage(creature, 0, 'dendro')
    assert.deepEqual(hit.follower.aura.map(x => x.element), [element], id)
    assert.deepEqual(applyElementalAura(hit.follower, 'hydro').aura.map(x => x.element), [element], id)
  }
})

test('The new nonreactive aura overwrites any old stacked auras', () => {
  const old = { ...follower(), aura: [{ element: 'cryo' }, { element: 'dendro' }] }
  const updated = applyElementalAura(old, 'hydro')
  assert.deepEqual(updated.aura.map(x => x.element), ['hydro'])
})
