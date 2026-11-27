import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom', logLevel: 'error',
})
after(async () => { await vite.close() })
const engine = await vite.ssrLoadModule('/src/game/engine.ts')
const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
const { productionCards } = await vite.ssrLoadModule('/src/data/productionCards.ts')
const { productionTokens } = await vite.ssrLoadModule('/src/data/productionTokens.ts')
const { validateProductionCards } = await vite.ssrLoadModule('/src/data/cardValidation.ts')

function started() {
  let state = engine.createInitialGameState()
  state = engine.confirmMulligan(state, [])
  state = engine.confirmMulligan(state, [])
  return state
}
function follower(state, seat, cardId, opts = {}) {
  const card = engine.getCard(cardId)
  const f = {
    instanceId: `nilou-test-${seat}-${state.players[seat].field.length}`,
    cardId, attack: card?.attack ?? 1,
    health: card?.health ?? 6, maxHealth: card?.health ?? 6,
    aura: [], shield: { normal: 0, crystallize: 0 },
    skillUsed: false, burstUsed: false,
    canAttack: true, hasAttacked: false, keywords: [...(card?.keywords ?? [])],
    ...opts,
  }
  state.players[seat].field.push(f)
  return f
}
function playNilou(deck = ['C001','C026','C101']) {
  const s = started()
  s.players[0].deck = [...deck]
  s.players[0].hand = ['C124']
  s.players[0].pp = 4
  return engine.playCard(s, 'player1', 0)
}

test('Nilou C124 and Bountiful Core are correctly registered', () => {
  const n = engine.getCard('C124')
  const core = engine.getCard('token-bountiful-core')
  assert.deepEqual([n.name,n.element,n.rarity,n.cost,n.attack,n.health],
    ['ズバイルシアターの踊り子・ニィロウ','hydro','legendary',4,1,6])
  assert.equal(n.elementalSkill?.ppCost,2)
  assert.equal(n.elementalBurst?.energyCost,3)
  assert.deepEqual([core.name,core.cost,core.attack,core.health,core.token],
    ['豊穣の核',0,0,1,true])
  assert.equal(productionCards.length,124)
  assert.equal(productionTokens.length,26)
  assert.equal(validateProductionCards(productionCards).ready,true)
})

test('Nilou fanfare evaluates remaining deck NOW, even when another element was drawn', () => {
  const yes = playNilou(['C001','C026','C101'])
  assert.equal(yes.players[0].crests?.find(c => c.id === 'C124')?.turnsRemaining,-1)
  const drawnAlready = playNilou([])
  assert.equal(drawnAlready.players[0].crests?.filter(c => c.id === 'C124').length,1)
  const no = playNilou(['C001','C011'])
  assert.equal(no.players[0].crests?.some(c => c.id === 'C124') ?? false,false)
})

test('Nilou crest respects 5 crest slots and same-name uniqueness', () => {
  const s = started()
  s.players[0].deck=['C001']
  s.players[0].hand=['C124','C124']
  s.players[0].pp=8
  let one=engine.playCard(s,'player1',0)
  let two=engine.playCard(one,'player1',0)
  assert.equal(two.players[0].crests?.filter(c=>c.id==='C124').length,1)
  const full=started()
  full.players[0].deck=['C001']
  full.players[0].hand=['C124']
  full.players[0].pp=4
  full.players[0].crests=Array.from({length:5},(_,i)=>({id:`fake-${i}`,turnsRemaining:3,usedElements:[]}))
  const blocked=engine.playCard(full,'player1',0)
  assert.equal(blocked.players[0].crests?.some(c=>c.id==='C124'),false)
})

test('On the crest holder attacking, opponent Bloom creates Bountiful Core instead of Dendro Core', () => {
  const s=playNilou()
  const victim=follower(s,1,'C001')
  victim.aura=[{element:'dendro'}]
  const next=resolveReactionConsequence(s,1,victim.instanceId,'bloom','dendro',0)
  assert.equal(next.players[1].field.some(f=>f.cardId==='dendro-core'),false)
  assert.equal(next.players[1].field.find(f=>f.cardId==='token-bountiful-core')?.health,0)
})

test('Bloom caused by the opposite side is not replaced by Nilou crest', () => {
  const s=playNilou()
  const victim=follower(s,0,'C001')
  const next=resolveReactionConsequence(s,0,victim.instanceId,'bloom','dendro',1)
  assert.equal(next.players[0].field.some(f=>f.cardId==='dendro-core'),true)
  assert.equal(next.players[0].field.some(f=>f.cardId==='token-bountiful-core'),false)
})

test('Nilou skill triggers one Bloom core, immediately resolves its Last Word, gains energy', () => {
  const oldRandom=Math.random
  try {
    Math.random=()=>0
    let s=playNilou()
    s.players[0].pp=2
    const nilou=s.players[0].field[0]
    const victim=follower(s,1,'C001', {attack:1,health:10,maxHealth:10,aura:[{element:'dendro'}]})
    assert.equal(engine.canUseAbility(s,nilou.instanceId,'skill'),true)
    s=engine.activateAbility(s,nilou.instanceId,'skill')
    assert.equal(s.players[0].energy,1)
    assert.equal(s.players[0].pp,0)
    assert.ok(s.players[0].field[0].keywords.includes('nilou_engage_hydro'))
    assert.equal(s.players[1].leaderHealth,17)
    assert.equal(s.players[1].field.some(f=>f.cardId==='dendro-core'),false)
    assert.equal(s.players[1].field.some(f=>f.cardId==='token-bountiful-core'),false)
    assert.equal(s.players[1].graveyard.filter(id=>id==='token-bountiful-core').length,1)
    assert.ok(s.players[1].field.some(f=>f.instanceId===victim.instanceId))
  } finally {Math.random=oldRandom}
})

test('Nilou crest does not bypass the five-slot field limit', () => {
  const s=playNilou()
  const victim=follower(s,1,'C001')
  for(let i=0;i<4;i++) follower(s,1,'C001')
  const next=resolveReactionConsequence(s,1,victim.instanceId,'bloom','dendro',0)
  assert.equal(next.players[1].field.length,5)
  assert.equal(next.players[1].field.some(f=>f.cardId==='token-bountiful-core'),false)
})

test('Nilou Burst consumes 3 energy and damages each opposing follower by Hydro 2', () => {
  let s=playNilou()
  s.players[0].energy=3
  const nilou=s.players[0].field[0]
  const a=follower(s,1,'C001',{health:5,maxHealth:5})
  const b=follower(s,1,'C001',{health:4,maxHealth:4})
  assert.equal(engine.canUseAbility(s,nilou.instanceId,'burst'),true)
  s=engine.activateAbility(s,nilou.instanceId,'burst')
  assert.equal(s.players[0].energy,0)
  assert.equal(s.players[1].field.find(f=>f.instanceId===a.instanceId)?.health,3)
  assert.equal(s.players[1].field.find(f=>f.instanceId===b.instanceId)?.health,2)
})

test('Nilou encounter applies Hydro 0 before the exchange of normal attack damage', () => {
  const oldRandom=Math.random
  try {
    Math.random=()=>0
    let s=playNilou()
    const nilou=s.players[0].field[0]
    s.players[0].pp=2
    s=engine.activateAbility(s,nilou.instanceId,'skill')
    // Add a new Dendro aura to guarantee the encounter causes Bloom.
    const victim=follower(s,1,'C001',{health:9,maxHealth:9,aura:[{element:'dendro'}]})
    s.players[0].field[0].canAttack=true
    s.players[0].field[0].hasAttacked=false
    const attacked=engine.attackFollower(s,nilou.instanceId,victim.instanceId)
    assert.equal(attacked.players[1].leaderHealth,17)
    assert.equal(attacked.players[1].graveyard.includes('token-bountiful-core'),true)
  } finally {Math.random=oldRandom}
})
