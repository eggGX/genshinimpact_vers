import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})
after(async () => { await vite.close() })
const engine = await vite.ssrLoadModule('/src/game/engine.ts')
const { productionCards } = await vite.ssrLoadModule('/src/data/productionCards.ts')
const { getDeckCardPool } = await vite.ssrLoadModule('/src/data/cardRegistry.ts')
const { validateProductionCards } = await vite.ssrLoadModule('/src/data/cardValidation.ts')

function startedGame() {
  let state = engine.createInitialGameState()
  state = engine.confirmMulligan(state, [])
  state = engine.confirmMulligan(state, [])
  state.players[0].pp = 4
  state.players[0].hand = ['C116']
  return state
}
function put(state, seat, cardId, keywords = []) {
  const follower = {
    instanceId: 'silver-test-' + seat + '-' + state.players[seat].field.length,
    cardId, attack: 7, health: 7, maxHealth: 7,
    skillUsed: true, burstUsed: true, canAttack: true, hasAttacked: true,
    aura: [{element:'pyro'}], shield: {normal:3, crystallize:2},
    keywords,
  }
  state.players[seat].field.push(follower)
  return follower
}

test('C116 is a registered, buildable 4 PP neutral silver; base cards retain IDs', () => {
  const card = engine.getCard('C116')
  assert.equal(card.name, '荒野の呪い')
  assert.equal(card.type, 'spell')
  assert.equal(card.rarity, 'silver')
  assert.equal(card.element, 'none')
  assert.equal(card.cost, 4)
  assert.match(card.description, /自分か相手の場のフォロワー1枚を選ぶ/)
  assert.equal(productionCards.length,116)
  assert.equal(getDeckCardPool().length,116)
  assert.equal(validateProductionCards(productionCards).ready,true)
  assert.equal(productionCards.filter(c => c.id === 'C001').length,1)
})

test('C116 transforms enemy without destroying or triggering last words', () => {
  const state = startedGame()
  const original = put(state,1,'C004',['lastword','guard'])
  const graveBefore = [...state.players[1].graveyard]
  const result = engine.playCard(state,'player1',0,original.instanceId)
  const transformed = result.players[1].field[0]
  assert.equal(transformed.cardId,'C001')
  assert.notEqual(transformed.instanceId,original.instanceId)
  assert.deepEqual([transformed.attack,transformed.health,transformed.maxHealth],[1,2,2])
  assert.deepEqual(transformed.shield,{normal:0,crystallize:0})
  assert.deepEqual(transformed.aura,[])
  assert.deepEqual(transformed.keywords,[])
  assert.equal(transformed.hasAttacked,false)
  assert.equal(transformed.skillUsed,false)
  assert.deepEqual(result.players[1].graveyard,graveBefore)
  assert.equal(result.players[1].field.length,1)
  assert.equal(result.players[0].pp,0)
  assert.ok(result.players[0].graveyard.includes('C116'))
})

test('C116 can transform a friendly follower even when enemy field is empty', () => {
  const state = startedGame()
  const own = put(state,0,'C008')
  assert.equal(engine.canPlayCard(state,0),true)
  const result = engine.playCard(state,'player1',0,own.instanceId)
  assert.equal(result.players[0].field[0].cardId,'C001')
  assert.notEqual(result.players[0].field[0].instanceId,own.instanceId)
})

test('C116 requires a valid, selectable follower and cannot target enemy aura/stealth', () => {
  const empty = startedGame()
  assert.equal(engine.canPlayCard(empty,0),false)
  const foe = put(empty,1,'C004',['aura','stealth'])
  assert.equal(engine.canPlayCard(empty,0),false)
  assert.strictEqual(engine.playCard(empty,'player1',0,foe.instanceId),empty)
  foe.keywords = []
  assert.equal(engine.canPlayCard(empty,0),true)
  assert.strictEqual(engine.playCard(empty,'player1',0,'missing'),empty)
  empty.players[0].pp = 3
  assert.equal(engine.canPlayCard(empty,0),false)
})

test('catalogue explicitly orders by element, rarity, then cost and stable ID', () => {
  const library = readFileSync(new URL('../src/components/CardLibrary.tsx',import.meta.url),'utf8')
  assert.match(library,/ELEMENT_ORDER\.indexOf\(a\.element\) - ELEMENT_ORDER\.indexOf\(b\.element\)/)
  assert.match(library,/RARITY_ORDER\.indexOf\(a\.rarity\) - RARITY_ORDER\.indexOf\(b\.rarity\)/)
  assert.match(library,/a\.cost - b\.cost/)
  assert.match(library,/a\.id\.localeCompare\(b\.id\)/)
})
