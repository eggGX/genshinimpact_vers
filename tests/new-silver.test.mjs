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
  assert.equal(productionCards.length,117)
  assert.equal(getDeckCardPool().length,117)
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

test('C117 is a playable 2 PP pyro silver with normalized Last Word wording', () => {
  const card = engine.getCard('C117')
  assert.equal(card.name,'反魂の歌')
  assert.equal(card.type,'spell')
  assert.equal(card.rarity,'silver')
  assert.equal(card.element,'pyro')
  assert.equal(card.cost,2)
  assert.equal(card.description,'自分の場のフォロワー1枚を選ぶ。それは「【ラストワード】これと同名のフォロワー1体を自分の場に出す。」をもつ。')
  assert.equal(getDeckCardPool().filter(c=>c.id==='C117').length,1)
})

test('C117 cannot be used without a friendly target, never targets enemies, and spends 2 PP', () => {
  const s=startedGame()
  s.players[0].pp=2
  s.players[0].hand=['C117']
  const enemy=put(s,1,'C011')
  assert.equal(engine.canPlayCard(s,0),false)
  assert.strictEqual(engine.playCard(s,'player1',0,enemy.instanceId),s)
  const own=put(s,0,'C011')
  assert.equal(engine.canPlayCard(s,0),true)
  assert.strictEqual(engine.playCard(s,'player1',0,enemy.instanceId),s)
  assert.strictEqual(engine.playCard(s,'player1',0),s)
  const next=engine.playCard(s,'player1',0,own.instanceId)
  assert.equal(next.players[0].pp,0)
  assert.deepEqual(next.players[0].hand,[])
  assert.ok(next.players[0].graveyard.includes('C117'))
  assert.ok(next.players[0].field[0].keywords.includes('revive_same_name_lastword'))
})

test('C117 grants a Last Word which revives a fresh same-name follower only after destruction', () => {
  const s=startedGame()
  s.players[0].pp=2
  s.players[0].hand=['C117']
  const attacker=put(s,0,'C011')
  const target=put(s,1,'C012')
  attacker.attack=1
  attacker.health=1
  attacker.maxHealth=1
  target.attack=2
  target.health=2
  target.maxHealth=2
  target.keywords=[]
  const enchanted=engine.playCard(s,'player1',0,attacker.instanceId)
  const result=engine.attackFollower(enchanted,attacker.instanceId,target.instanceId)
  const revived=result.players[0].field.find(f=>f.cardId==='C011')
  assert.ok(revived)
  assert.notEqual(revived.instanceId,attacker.instanceId)
  assert.equal(revived.attack,engine.getCard('C011').attack)
  assert.equal(revived.health,engine.getCard('C011').health)
  assert.equal(revived.hasAttacked,false)
  assert.ok(!revived.keywords.includes('revive_same_name_lastword'))
  assert.ok(result.players[0].graveyard.includes('C011'))
})

test('C117 does not copy its granted Last Word through transformation', () => {
  const s=startedGame()
  s.players[0].hand=['C117','C116']
  s.players[0].pp=6
  const source=put(s,0,'C011')
  const empowered=engine.playCard(s,'player1',0,source.instanceId)
  const transformed=engine.playCard(empowered,'player1',0,source.instanceId)
  assert.equal(transformed.players[0].field[0].cardId,'C001')
  assert.ok(!transformed.players[0].field[0].keywords.includes('revive_same_name_lastword'))
})

test('C117 obeys five-card board cap when the granted Last Word summons', () => {
  const s=startedGame()
  s.players[0].hand=['C117']
  s.players[0].pp=2
  const source=put(s,0,'C011')
  source.health=1
  source.attack=1
  const other=put(s,1,'C012')
  other.attack=3
  other.health=4
  for(let i=0;i<4;i++) put(s,0,'C001')
  const enchanted=engine.playCard(s,'player1',0,source.instanceId)
  const after=engine.attackFollower(enchanted,source.instanceId,other.instanceId)
  assert.equal(after.players[0].field.length,5)
})
