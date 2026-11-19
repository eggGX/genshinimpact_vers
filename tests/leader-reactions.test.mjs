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
const { damageLeaderWithReaction } = await vite.ssrLoadModule('/src/game/leaderShield.ts')
const { resolveLeaderElementalHit } = await vite.ssrLoadModule('/src/game/elemental.ts')
const { createSummonedFollower } = await vite.ssrLoadModule('/src/game/neutralRules.ts')

function battle() {
  const state = createInitialGameState()
  state.phase = 'main'
  state.players[0].pp = 1
  state.players[0].maxPp = 1
  return state
}
function hit(auras, element, damage = 2) {
  const state = battle()
  state.players[1].leaderAura = [{ element: auras }]
  return resolveLeaderElementalHit(state, 1, damage, element, 0)
}
test('Vaporize, Melt and Overload add only one leader damage', () => {
  for (const [aura, element] of [['hydro','pyro'], ['cryo','pyro'], ['pyro','electro']]) {
    const next = hit(aura, element, 2)
    assert.equal(next.players[1].leaderHealth, 17, `${aura}+${element} must deal 3`)
    assert.deepEqual(next.players[1].leaderAura, [])
  }
})

test('Superconduct adds 1 to the next physical hit only and is consumed', () => {
  const state = hit('cryo','electro',1)
  assert.equal(state.players[1].leaderSuperconduct, true)
  const elemental = resolveLeaderElementalHit(state, 1, 2, 'pyro')
  assert.equal(elemental.players[1].leaderSuperconduct, true)
  const physical = resolveLeaderElementalHit(elemental, 1, 2, undefined)
  assert.equal(physical.players[1].leaderHealth, elemental.players[1].leaderHealth - 3)
  assert.equal(physical.players[1].leaderSuperconduct, false)
  const again = resolveLeaderElementalHit(physical, 1, 2)
  assert.equal(again.players[1].leaderHealth, physical.players[1].leaderHealth - 2)
})

test('Repeated leader Freezes reduce only one usable PP on next turn', () => {
  let state = hit('hydro','cryo',1)
  assert.equal(state.players[1].leaderFrozenNextTurn, true)
  state.players[1].leaderAura = [{element:'hydro'}]
  state = resolveLeaderElementalHit(state,1,1,'cryo',0)
  assert.equal(state.players[1].leaderFrozenNextTurn, true)
  state = endTurn(state)
  assert.equal(state.currentPlayerId, 'player2')
  assert.equal(state.players[1].maxPp, 1)
  assert.equal(state.players[1].pp, 0)
  assert.equal(state.players[1].leaderFrozenNextTurn, false)
  state = endTurn(state)
  state = endTurn(state)
  assert.equal(state.players[1].pp, state.players[1].maxPp)
})

test('Quicken on leaders consumes Electro and Dendro aura and grants two charges', () => {
  for (const [attached, incoming] of [['dendro','electro'], ['electro','dendro']]) {
    const next = hit(attached, incoming, 1)
    assert.deepEqual(next.players[1].leaderAura, [])
    assert.equal(next.players[1].leaderQuickenCharges, 2)
    assert.equal(next.players[1].leaderHealth, 19)
    assert.ok(next.presentationFrames === undefined || Array.isArray(next.presentationFrames))
  }
})

test('Leader Quicken charges are consumed by the next two positive Electro/Dendro hits', () => {
  const quickened = hit('dendro','electro',1)
  const one = resolveLeaderElementalHit(quickened, 1, 1, 'dendro', 0)
  assert.equal(one.players[1].leaderQuickenCharges, 1)
  assert.deepEqual(one.players[1].leaderAura, [])
  const two = resolveLeaderElementalHit(one, 1, 1, 'electro', 0)
  assert.equal(two.players[1].leaderQuickenCharges, 0)
  assert.deepEqual(two.players[1].leaderAura, [])
  const three = resolveLeaderElementalHit(two, 1, 1, 'dendro', 0)
  assert.deepEqual(three.players[1].leaderAura?.map(a => a.element), ['dendro'])
  assert.equal(three.players[1].leaderQuickenCharges, 0)
})

test('Unreactive incoming elements replace leader aura instead of stacking', () => {
  const state = hit('dendro','cryo',1)
  assert.deepEqual(state.players[1].leaderAura?.map(a => a.element), ['cryo'])
  const repeated = resolveLeaderElementalHit(state,1,1,'cryo',0)
  assert.deepEqual(repeated.players[1].leaderAura?.map(a => a.element), ['cryo'])
  const next = resolveLeaderElementalHit(repeated,1,1,'dendro',0)
  assert.deepEqual(next.players[1].leaderAura?.map(a => a.element), ['dendro'])
  const physical = resolveLeaderElementalHit(next,1,1,undefined,0)
  assert.deepEqual(physical.players[1].leaderAura?.map(a => a.element), ['dendro'])
})

test('Leader Burning deals 1 on own turn end and uses one turn of duration', () => {
  const state = hit('dendro','pyro',1)
  assert.equal(state.players[1].leaderBurningTurns, 1)
  const next = endTurn(state)
  assert.equal(next.players[1].leaderHealth, state.players[1].leaderHealth)
  const after = endTurn(next)
  assert.equal(after.players[1].leaderHealth, state.players[1].leaderHealth - 1)
  assert.equal(after.players[1].leaderBurningTurns, 0)
})

test('Leader Bloom summons a Dendro Core onto the affected side', () => {
  const state = hit('dendro','hydro',1)
  assert.ok(state.players[1].field.some(f => f.cardId === 'dendro-core'))
  const core = state.players[1].field.find(f => f.cardId === 'dendro-core')
  const again = resolveLeaderElementalHit({
    ...state,
    players: [state.players[0],{...state.players[1],leaderAura:[{element:'hydro'}]}],
  },1,1,'dendro',0)
  assert.equal(again.players[1].field.find(f => f.cardId === 'dendro-core')?.health, core.health + 1)
})

test('Leader Electro-Charged hits another follower, or leader if none', () => {
  const initial = battle()
  initial.players[1].leaderAura = [{element:'hydro'}]
  initial.players[1].field = [createSummonedFollower('C001')]
  const withFollower = resolveLeaderElementalHit(initial,1,1,'electro',0)
  assert.equal(withFollower.players[1].field[0].health, initial.players[1].field[0].health - 1)
  assert.equal(withFollower.players[1].leaderHealth, 19)
  const noFollower = hit('hydro','electro',1)
  assert.equal(noFollower.players[1].leaderHealth, 18)
})

test('Leader Swirl spreads absorbed element, leader Crystallize shields the attacker', () => {
  const state = battle()
  state.players[1].leaderAura = [{element:'pyro'}]
  state.players[1].field = [createSummonedFollower('C001')]
  const swirled = resolveLeaderElementalHit(state,1,1,'anemo',0)
  assert.equal(swirled.players[1].field[0].health, state.players[1].field[0].health - 1)
  assert.ok(swirled.players[1].field[0].aura.some(a => a.element === 'pyro'))
  const crystal = hit('hydro','geo',1)
  assert.equal(crystal.players[0].leaderShield?.crystallize, 1)
  assert.equal(crystal.players[1].leaderShield?.crystallize, 0)
})

test('Compatibility helper applies one-damage bonus and persists boolean flags', () => {
  const state = battle()
  const result = damageLeaderWithReaction({...state.players[1],leaderAura:[{element:'pyro'}]},2,'hydro')
  assert.equal(result.player.leaderHealth,17)
  assert.equal(result.reaction,'vaporize')
  assert.equal(typeof result.player.leaderFrozenNextTurn,'boolean')
  assert.equal(typeof result.player.leaderSuperconduct,'boolean')
})

test('Barbara crest self-Hydro reacts with Dendro once, consuming the leader aura', async () => {
  const { resolveHydroPermanentsTurnEnd } = await vite.ssrLoadModule('/src/game/hydroAdvancedRules.ts')
  const state = battle()
  state.players[0].leaderAura = [{ element: 'dendro' }]
  state.players[0].crests = [{ id: 'C034', turnsRemaining: 2, usedElements: [] }]
  const changed = resolveHydroPermanentsTurnEnd(state, 'player1', s => s)
  assert.deepEqual(changed.players[0].leaderAura, [])
  assert.equal(changed.players[0].field.filter(f => f.cardId === 'dendro-core').length, 1)
})
