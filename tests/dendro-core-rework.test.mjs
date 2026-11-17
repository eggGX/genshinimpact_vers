import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error',
})
after(async () => { await vite.close() })
const { createInitialGameState, confirmMulligan, endTurn } =
  await vite.ssrLoadModule('/src/game/engine.ts')
const { createDendroCore, absorbDamage, resolveElementalDamage } =
  await vite.ssrLoadModule('/src/game/elemental.ts')
const { getCard } = await vite.ssrLoadModule('/src/data/cardRegistry.ts')

function startedGame() {
  let game = createInitialGameState()
  game = confirmMulligan(game, [])
  return confirmMulligan(game, [])
}
function target(name, health = 10, shield = 0) {
  return {
    instanceId: name, cardId: 'C001', attack: 1, health,
    maxHealth: health, aura: [], shield: { normal: shield, crystallize: 0 },
    skillUsed: false, burstUsed: false, canAttack: true, hasAttacked: false, keywords: [],
  }
}

test('Dendro Core prevents ordinary physical and elemental damage', () => {
  const core = createDendroCore()
  assert.equal(absorbDamage(core, 99).health, 1)
  for (const element of [undefined, 'none', 'hydro', 'cryo', 'anemo', 'geo', 'dendro']) {
    const hit = resolveElementalDamage(core, 99, element)
    assert.equal(hit.follower.health, 1)
    assert.equal(hit.damage, 0)
  }
})
test('Pyro and Electro still detonate even a shielded or grown Dendro Core', () => {
  const core = { ...createDendroCore(), health: 3, maxHealth: 3,
    shield: { normal: 9, crystallize: 9 } }
  for (const [element, reaction] of [['pyro', 'burgeon'], ['electro', 'hyperbloom']]) {
    const hit = resolveElementalDamage(core, 1, element)
    assert.equal(hit.reaction, reaction)
    assert.equal(hit.follower.health, 0)
  }
})
test('A 0/1 Dendro Core damages only another follower then destroys itself', () => {
  const state = startedGame()
  state.players[0].field = [createDendroCore(), target('victim')]
  const next = endTurn(state)
  assert.equal(next.players[0].field.some(f => f.cardId === 'dendro-core'), false)
  assert.equal(next.players[0].field.find(f => f.instanceId === 'victim').health, 8)
})
test('A 0/3 Dendro Core deals three separate 2-damage hits and loses 3 health', () => {
  const state = startedGame()
  const core = createDendroCore()
  state.players[0].field = [{ ...core, health: 3, maxHealth: 3 }, target('victim')]
  const next = endTurn(state)
  assert.equal(next.players[0].field.some(f => f.cardId === 'dendro-core'), false)
  assert.equal(next.players[0].field.find(f => f.instanceId === 'victim').health, 4)
})
test('If no other follower exists, the Core still loses its own health', () => {
  const state = startedGame()
  state.players[0].field = [{ ...createDendroCore(), health: 2, maxHealth: 2 }]
  const next = endTurn(state)
  assert.equal(next.players[0].field.length, 0)
})
test('Core turn-end damage is absorbed by another follower shield', () => {
  const state = startedGame()
  state.players[0].field = [createDendroCore(), target('shielded', 10, 3)]
  const next = endTurn(state)
  assert.equal(next.players[0].field[0].health, 10)
  assert.equal(next.players[0].field[0].shield.normal, 1)
})
test('Core card description matches the engine rules', () => {
  const description = getCard('dendro-core')?.description ?? ''
  for (const wording of ['受けるダメージは0', 'ランダムな他のフォロワー', '2ダメージ', '+0/-1', 'X回']) {
    assert.ok(description.includes(wording), wording)
  }
})
