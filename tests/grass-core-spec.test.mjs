import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})
after(async () => { await vite.close() })

const { createInitialGameState, endTurn } = await vite.ssrLoadModule('/src/game/engine.ts')
const { createDendroCore, absorbDamage, resolveElementalDamage } =
  await vite.ssrLoadModule('/src/game/elemental.ts')
const { createSummonedFollower } = await vite.ssrLoadModule('/src/game/neutralRules.ts')
const { getCard } = await vite.ssrLoadModule('/src/data/cardRegistry.ts')

function stateWithCore(hp = 1, ally = null) {
  const state = createInitialGameState()
  state.phase = 'main'
  const core = createDendroCore()
  core.health = hp
  core.maxHealth = hp
  state.players[0].field = ally ? [core, ally] : [core]
  return state
}

test('Grass Core is 0/1, cannot attack and takes zero ordinary damage', () => {
  const core = createDendroCore()
  assert.equal(core.attack, 0)
  assert.equal(core.health, 1)
  assert.equal(core.canAttack, false)
  assert.ok(core.keywords.includes('cannot_attack'))
  for (const damage of [0, 1, 5, 20]) {
    const result = absorbDamage(core, damage)
    assert.equal(result.health, 1)
  }
  const withShield = { ...core, shield: { normal: 3, crystallize: 2 } }
  assert.deepEqual(absorbDamage(withShield, 7).shield, withShield.shield)
  const hydro = resolveElementalDamage(core, 5, 'hydro')
  assert.equal(hydro.follower.health, 1)
})

test('Pyro and Electro still destroy the damage-immune Grass Core', () => {
  for (const [element, expected] of [['pyro', 'burgeon'], ['electro', 'hyperbloom']]) {
    const core = createDendroCore()
    core.shield = { normal: 4, crystallize: 3 }
    const hit = resolveElementalDamage(core, 1, element)
    assert.equal(hit.reaction, expected)
    assert.equal(hit.follower.health, 0)
  }
})

test('End of turn: X is snapshotted from current core HP, other follower takes 2 damage X times', () => {
  const ally = createSummonedFollower('C003')
  ally.health = 15
  ally.maxHealth = 15
  const state = stateWithCore(3, ally)
  const after = endTurn(state)
  assert.equal(after.players[0].field.some(f => f.cardId === 'dendro-core'), false)
  const survivor = after.players[0].field.find(f => f.instanceId === ally.instanceId)
  assert.equal(survivor?.health, 9)
})

test('No other followers: end-of-turn still lowers core own HP to zero', () => {
  const state = stateWithCore(2)
  const after = endTurn(state)
  assert.equal(after.players[0].field.some(f => f.cardId === 'dendro-core'), false)
})

test('Core self -0/-1 is not damage and eliminates the core even with shields', () => {
  const state = stateWithCore(1)
  state.players[0].field[0].shield = { normal: 4, crystallize: 4 }
  const after = endTurn(state)
  assert.equal(after.players[0].field.some(f => f.cardId === 'dendro-core'), false)
})

test('Card description reflects the X repetitions and core damage immunity', () => {
  const description = getCard('dendro-core')?.description ?? ''
  assert.match(description, /受けるダメージは0/)
  assert.match(description, /ランダムな他のフォロワー/)
  assert.match(description, /これをX回/)
  assert.match(description, /体力の値/)
})
