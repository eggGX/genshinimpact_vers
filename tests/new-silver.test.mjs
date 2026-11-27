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
  assert.equal(productionCards.length,121)
  assert.equal(getDeckCardPool().length,121)
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
  assert.equal(card.name,'反魂の詩')
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

test('C118 has the official Oratrice spelling, countdown and correct rarity', () => {
  const card=engine.getCard('C118')
  assert.equal(card.name,'諭示裁定カーディナル')
  assert.deepEqual([card.type,card.element,card.rarity,card.cost],['amulet','hydro','silver',4])
  assert.equal(card.description,
    '【カウントダウン_2】\n【ファンファーレ】相手の場の攻撃力が最大のフォロワーからランダムに1枚を破壊する。\n【ラストワード】相手の場の攻撃力が最大のフォロワーからランダムに1枚を破壊する。')
  assert.equal(getDeckCardPool().filter(c=>c.id==='C118').length,1)
  assert.equal(validateProductionCards(productionCards).ready,true)
})

test('C118 fanfare destroys only a highest-attack enemy and leaves a countdown-2 amulet', () => {
  const s=startedGame()
  s.players[0].hand=['C118']
  s.players[0].pp=4
  const low=put(s,1,'C001')
  low.attack=2
  const high=put(s,1,'C011')
  high.attack=8
  const middle=put(s,1,'C001')
  middle.attack=5
  const result=engine.playCard(s,'player1',0)
  assert.equal(result.players[0].pp,0)
  assert.equal(result.players[0].amulets.length,1)
  assert.equal(result.players[0].amulets[0].turnsRemaining,2)
  assert.deepEqual(result.players[1].field.map(f=>f.instanceId),[low.instanceId,middle.instanceId])
  assert.ok(result.players[1].graveyard.includes('C011'))
})

test('C118 does not randomly destroy an enemy below maximum attack when tied', () => {
  const originalRandom=Math.random
  try {
    for(const pick of [0,0.999999]) {
      Math.random=()=>pick
      const s=startedGame()
      s.players[0].hand=['C118']
      s.players[0].pp=4
      const a=put(s,1,'C001'); a.attack=8
      const b=put(s,1,'C011'); b.attack=8
      const c=put(s,1,'C001'); c.attack=3
      const next=engine.playCard(s,'player1',0)
      assert.equal(next.players[1].field.length,2)
      assert.ok(next.players[1].field.some(f=>f.instanceId===c.instanceId))
      const expected=pick===0 ? a.instanceId : b.instanceId
      assert.ok(!next.players[1].field.some(f=>f.instanceId===expected))
    }
  } finally {
    Math.random=originalRandom
  }
})

test('C118 Last Word fires at countdown expiry and reevaluates highest attack', () => {
  let s=startedGame()
  s.players[0].hand=['C118']
  s.players[0].pp=4
  const first=put(s,1,'C001'); first.attack=8
  const second=put(s,1,'C011'); second.attack=4
  s=engine.playCard(s,'player1',0)
  assert.equal(s.players[1].field.length,1)
  assert.equal(s.players[1].field[0].instanceId,second.instanceId)
  s=engine.endTurn(s)
  assert.equal(s.players[0].amulets[0].turnsRemaining,1)
  assert.equal(s.players[1].field.length,1)
  s=engine.endTurn(s)
  s=engine.endTurn(s)
  assert.equal((s.players[0].amulets??[]).length,0)
  assert.equal(s.players[1].field.length,0)
  assert.ok(s.players[1].graveyard.includes('C011'))
})

test('C118 is playable with an empty enemy field; its Fanfare and Last Word safely do nothing', () => {
  let s=startedGame()
  s.players[0].hand=['C118']
  s.players[0].pp=4
  assert.equal(engine.canPlayCard(s,0),true)
  s=engine.playCard(s,'player1',0)
  assert.equal(s.players[0].amulets.length,1)
  s=engine.endTurn(s)
  s=engine.endTurn(s)
  s=engine.endTurn(s)
  assert.equal(s.players[0].amulets.length,0)
  assert.equal(s.players[1].field.length,0)
})

test('C119 is a three PP cryo silver countdown amulet with the agreed wording', () => {
  const card=engine.getCard('C119')
  assert.equal(card.name,'クルースニクの炉')
  assert.deepEqual([card.type,card.element,card.rarity,card.cost],['amulet','cryo','silver',3])
  assert.equal(card.description,'【カウントダウン_2】\n自分のターン終了時、自分の場のフォロワーすべてを+0/+2する。')
  assert.equal(getDeckCardPool().filter(c=>c.id==='C119').length,1)
  assert.equal(validateProductionCards(productionCards).ready,true)
})

test('C119 buffs existing followers and their max HP on the turn it is played', () => {
  let s=startedGame()
  s.players[0].hand=['C119']
  s.players[0].pp=3
  const a=put(s,0,'C001')
  a.attack=2; a.health=2; a.maxHealth=4
  const b=put(s,0,'C011')
  b.attack=5; b.health=3; b.maxHealth=6
  s=engine.playCard(s,'player1',0)
  assert.equal(s.players[0].pp,0)
  assert.equal(s.players[0].amulets.length,1)
  assert.equal(s.players[0].amulets[0].turnsRemaining,2)
  s=engine.endTurn(s)
  assert.deepEqual(s.players[0].field.map(f=>[f.attack,f.health,f.maxHealth]),[[2,4,6],[5,5,8]])
  assert.equal(s.players[0].amulets[0].turnsRemaining,1)
})

test('C119 triggers again on the second owner turn end, then disappears', () => {
  let s=startedGame()
  s.players[0].hand=['C119']
  s.players[0].pp=3
  const follower=put(s,0,'C001')
  follower.attack=2; follower.health=2; follower.maxHealth=2
  s=engine.playCard(s,'player1',0)
  s=engine.endTurn(s)
  s=engine.endTurn(s)
  s=engine.endTurn(s)
  assert.equal(s.players[0].field[0].attack,2)
  assert.equal(s.players[0].field[0].health,6)
  assert.equal(s.players[0].field[0].maxHealth,6)
  assert.equal(s.players[0].amulets.length,0)
})

test('C119 does not buff the opposing field and is safe with an empty allied board', () => {
  let s=startedGame()
  s.players[0].hand=['C119']
  s.players[0].pp=3
  const foe=put(s,1,'C001')
  foe.health=2;foe.maxHealth=2
  s=engine.playCard(s,'player1',0)
  s=engine.endTurn(s)
  assert.equal(s.players[1].field[0].health,2)
  assert.equal(s.players[0].amulets[0].turnsRemaining,1)
})

test('C120 is the playable 2 PP electro silver energy spell with consistent wording', () => {
  const card=engine.getCard('C120')
  assert.equal(card.name,'一心浄土')
  assert.deepEqual([card.type,card.element,card.rarity,card.cost],['spell','electro','silver',2])
  assert.equal(card.description,'自分の元素エネルギーを2獲得する。')
  assert.equal(getDeckCardPool().filter(c=>c.id==='C120').length,1)
  assert.equal(validateProductionCards(productionCards).ready,true)
})

test('C120 grants two energy, clamps at five, and spends exactly 2 PP', () => {
  for(const [starting,expected] of [[0,2],[3,5],[4,5],[5,5]]) {
    const s=startedGame()
    s.players[0].hand=['C120']
    s.players[0].pp=3
    s.players[0].energy=starting
    s.players[1].energy=1
    assert.equal(engine.canPlayCard(s,0),true)
    const next=engine.playCard(s,'player1',0)
    assert.equal(next.players[0].energy,expected)
    assert.equal(next.players[0].pp,1)
    assert.deepEqual(next.players[0].hand,[])
    assert.ok(next.players[0].graveyard.includes('C120'))
    assert.equal(next.players[1].energy,1)
  }
})

test('C120 cannot be played without enough PP and requires no board target', () => {
  const s=startedGame()
  s.players[0].hand=['C120']
  s.players[0].pp=1
  assert.equal(engine.canPlayCard(s,0),false)
  assert.strictEqual(engine.playCard(s,'player1',0),s)
  s.players[0].pp=2
  assert.equal(engine.canPlayCard(s,0),true)
  assert.equal(engine.playCard(s,'player1',0).players[0].energy,2)
})

test('C121 is a buildable 2 PP Anemo silver spell with consistent wording', () => {
  const card=engine.getCard('C121')
  assert.equal(card.name,'風の翼')
  assert.deepEqual([card.type,card.element,card.rarity,card.cost],['spell','anemo','silver',2])
  assert.equal(card.description,'自分の場のフォロワー1枚を選ぶ。それは「守護を無視して攻撃できる」をもつ。')
  assert.equal(getDeckCardPool().filter(c=>c.id==='C121').length,1)
  assert.equal(validateProductionCards(productionCards).ready,true)
})

test('C121 requires a living allied follower; rejects enemy and absent targets', () => {
  const s=startedGame()
  s.players[0].hand=['C121']
  s.players[0].pp=2
  const enemy=put(s,1,'C001',['guard'])
  assert.equal(engine.canPlayCard(s,0),false)
  assert.strictEqual(engine.playCard(s,'player1',0,enemy.instanceId),s)
  const ally=put(s,0,'C011')
  assert.equal(engine.canPlayCard(s,0),true)
  assert.strictEqual(engine.playCard(s,'player1',0,enemy.instanceId),s)
  assert.strictEqual(engine.playCard(s,'player1',0),s)
  const after=engine.playCard(s,'player1',0,ally.instanceId)
  assert.equal(after.players[0].pp,0)
  assert.deepEqual(after.players[0].hand,[])
  assert.ok(after.players[0].graveyard.includes('C121'))
  assert.ok(after.players[0].field[0].keywords.includes('ignore_guard'))
  assert.equal(after.players[1].field[0].keywords.includes('ignore_guard'),false)
})

test('C121 bypasses Guard when attacking enemy followers, not combat readiness', () => {
  let s=startedGame()
  s.players[0].hand=['C121']
  s.players[0].pp=2
  const ally=put(s,0,'C001')
  ally.attack=2; ally.health=5; ally.maxHealth=5; ally.hasAttacked=false
  const guard=put(s,1,'C001',['guard'])
  guard.attack=1; guard.health=5; guard.maxHealth=5
  const enemy=put(s,1,'C011')
  enemy.attack=1; enemy.health=5; enemy.maxHealth=5
  const blocked=engine.attackFollower(s,ally.instanceId,enemy.instanceId)
  assert.strictEqual(blocked,s)
  s=engine.playCard(s,'player1',0,ally.instanceId)
  const hit=engine.attackFollower(s,ally.instanceId,enemy.instanceId)
  assert.equal(hit.players[1].field.find(f=>f.instanceId===enemy.instanceId)?.health,3)
  assert.equal(hit.players[1].field.find(f=>f.instanceId===guard.instanceId)?.health,5)
  assert.equal(hit.players[0].field[0].hasAttacked,true)
})

test('C121 bypasses Guard to attack leader, but does not grant Storm or Rush', () => {
  let s=startedGame()
  s.players[0].hand=['C121']
  s.players[0].pp=2
  const ally=put(s,0,'C001')
  ally.attack=3
  ally.health=5
  ally.maxHealth=5
  ally.hasAttacked=false
  put(s,1,'C001',['guard'])
  const blocked=engine.attackLeader(s,ally.instanceId)
  assert.strictEqual(blocked,s)
  s=engine.playCard(s,'player1',0,ally.instanceId)
  const result=engine.attackLeader(s,ally.instanceId)
  assert.equal(result.players[1].leaderHealth,17)

  let unavailable=startedGame()
  unavailable.players[0].hand=['C121']
  unavailable.players[0].pp=2
  const fresh=put(unavailable,0,'C001')
  fresh.attack=3
  fresh.canAttack=false
  put(unavailable,1,'C001',['guard'])
  unavailable=engine.playCard(unavailable,'player1',0,fresh.instanceId)
  const notReady=engine.attackLeader(unavailable,fresh.instanceId)
  assert.strictEqual(notReady,unavailable)
})

test('C121 does not stack duplicate ignore-guard keywords when applied twice', () => {
  let s=startedGame()
  s.players[0].hand=['C121','C121']
  s.players[0].pp=4
  const ally=put(s,0,'C001')
  s=engine.playCard(s,'player1',0,ally.instanceId)
  s=engine.playCard(s,'player1',0,ally.instanceId)
  assert.equal(s.players[0].field[0].keywords.filter(k=>k==='ignore_guard').length,1)
})
