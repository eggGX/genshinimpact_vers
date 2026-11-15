import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const engine = await vite.ssrLoadModule('/src/game/engine.ts')
after(async () => { await vite.close() })

function startedGame() {
  let state = engine.createInitialGameState()
  state = engine.confirmMulligan(state, [])
  state = engine.confirmMulligan(state, [])
  return state
}

function place(state, ownerIndex, cardId, attack = 2, health = 2) {
  const follower = {
    instanceId: 'test-' + ownerIndex + '-' + state.players[ownerIndex].field.length + '-' + cardId,
    cardId,
    attack,
    health,
    maxHealth: health,
    skillUsed: false,
    burstUsed: false,
    aura: [],
    shield: { normal: 0, crystallize: 0 },
    canAttack: true,
    hasAttacked: false,
    keywords: [],
  }
  state.players[ownerIndex].field.push(follower)
  return follower
}

test('開始時は40枚から4枚配り、マリガン後に先攻PP1で始まる', () => {
  const initial = engine.createInitialGameState()
  assert.equal(initial.phase, 'mulligan')
  for (const player of initial.players) {
    assert.equal(player.hand.length, 4)
    assert.equal(player.deck.length, 36)
  }
  const p2 = engine.confirmMulligan(initial, [0, 2])
  assert.equal(p2.currentPlayerId, 'player2')
  const active = engine.confirmMulligan(p2, [1])
  assert.equal(active.phase, 'main')
  assert.equal(active.currentPlayerId, 'player1')
  assert.equal(active.players[0].pp, 1)
  assert.equal(active.players[0].hand.length, 4)
  assert.equal(active.players[1].hand.length, 4)
})

test('ターン終了時に次プレイヤーがドローしてPPを回復', () => {
  const state = engine.endTurn(startedGame())
  assert.equal(state.currentPlayerId, 'player2')
  assert.equal(state.turn, 2)
  assert.equal(state.players[1].hand.length, 5)
  assert.equal(state.players[1].deck.length, 35)
  assert.equal(state.players[1].pp, 1)
})

test('デッキが空の状態でドローすると敗北', () => {
  const state = startedGame()
  state.players[1].deck = []
  const next = engine.endTurn(state)
  assert.equal(next.winnerId, 'player1')
})

test('アビスの魔術師のファンファーレは相手リーダーに2ダメージ', () => {
  const state = startedGame()
  state.players[0].pp = 3
  state.players[0].hand = ['test-mage']
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[1].leaderHealth, 18)
  assert.equal(next.players[0].field.length, 1)
  assert.equal(next.players[0].pp, 0)
})

test('氷の射手は敵フォロワーに2ダメージを与え、破壊する', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-archer']
  const enemy = place(state, 1, 'test-slime', 1, 2)
  assert.equal(engine.canPlayCard(state, 0), true)
  const next = engine.playCard(state, 'player1', 0, enemy.instanceId)
  assert.equal(next.players[1].field.length, 0)
  assert.deepEqual(next.players[1].graveyard, ['test-slime'])
  assert.equal(next.players[0].field.length, 1)
})

test('ラストワードはフォロワーの持ち主を回復する', () => {
  const state = startedGame()
  state.players[1].leaderHealth = 15
  const attacker = place(state, 0, 'test-slime', 2, 3)
  const target = place(state, 1, 'test-hilichurl', 2, 2)
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[1].leaderHealth, 17)
  assert.deepEqual(next.players[1].graveyard, ['test-hilichurl'])
})

test('戦闘のダメージは双方同時に適用される', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 2, 2)
  const target = place(state, 1, 'test-slime', 2, 2)
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[0].field.length, 0)
  assert.equal(next.players[1].field.length, 0)
  assert.equal(next.players[0].graveyard.length, 1)
  assert.equal(next.players[1].graveyard.length, 1)
})

test('ターン終了時の祈祷師はリーダーを1回復する', () => {
  const state = startedGame()
  state.players[0].leaderHealth = 16
  place(state, 0, 'test-shaman', 1, 3)
  const next = engine.endTurn(state)
  assert.equal(next.players[0].leaderHealth, 17)
  assert.equal(next.currentPlayerId, 'player2')
})

test('攻撃したフォロワーは同じターンに再度攻撃できない', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 1, 2)
  const next = engine.attackLeader(state, attacker.instanceId)
  assert.equal(next.players[1].leaderHealth, 19)
  assert.equal(next.players[0].field[0].hasAttacked, true)
  const again = engine.attackLeader(next, attacker.instanceId)
  assert.equal(again.players[1].leaderHealth, 19)
})

test('炎スライムの通常攻撃は生存した敵に炎元素を付着させる', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 1, 2)
  const target = place(state, 1, 'test-mage', 1, 4)
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[1].field[0].health, 3)
  assert.deepEqual(next.players[1].field[0].aura, [{ element: 'pyro' }])
})

test('氷の射手のダメージは生存した敵に氷元素を付着させる', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-archer']
  const target = place(state, 1, 'test-mage', 1, 4)
  const next = engine.playCard(state, 'player1', 0, target.instanceId)
  assert.equal(next.players[1].field[0].health, 2)
  assert.deepEqual(next.players[1].field[0].aura, [{ element: 'cryo' }])
})

test('物理通常攻撃は元素付着を生じない', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-hilichurl', 1, 4)
  const target = place(state, 1, 'test-mage', 1, 4)
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.deepEqual(next.players[1].field[0].aura, [])
})

test('風・岩・無元素の攻撃は付着せず、同元素は重複登録しない', async () => {
  const { applyElementalAura } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 4)
  assert.deepEqual(applyElementalAura(target, 'anemo').aura, [])
  assert.deepEqual(applyElementalAura(target, 'geo').aura, [])
  assert.deepEqual(applyElementalAura(target, 'none').aura, [])
  const once = applyElementalAura(target, 'hydro')
  const twice = applyElementalAura(once, 'hydro')
  assert.deepEqual(twice.aura, [{ element: 'hydro' }])
})

test('異なる元素の重なりは保持するが反応を起こさない（STEP14）', async () => {
  const { applyElementalAura } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 4)
  const hydro = applyElementalAura(target, 'hydro')
  const cryo = applyElementalAura(hydro, 'cryo')
  assert.deepEqual(cryo.aura.map(a => a.element), ['hydro', 'cryo'])
  assert.equal(cryo.health, 4)
})

test('訓練兵は登場時に自身を2/2から3/4に強化する', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-trainee']
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[0].field[0].attack, 3)
  assert.equal(next.players[0].field[0].health, 4)
  assert.equal(next.players[0].field[0].maxHealth, 4)
})

test('雷の術師は選択した敵の攻撃力を1下げ、体力は変えない', () => {
  const state = startedGame()
  state.players[0].pp = 3
  state.players[0].hand = ['test-electro-mage']
  const target = place(state, 1, 'test-hilichurl', 2, 2)
  const next = engine.playCard(state, 'player1', 0, target.instanceId)
  assert.equal(next.players[1].field[0].attack, 1)
  assert.equal(next.players[1].field[0].health, 2)
})

test('蒸発は水→炎、炎→水の両方向で+2し付着を消費する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  for (const [attached, incoming] of [['hydro', 'pyro'], ['pyro', 'hydro']]) {
    const state = startedGame()
    const target = place(state, 1, 'test-mage', 1, 10)
    target.aura = [{ element: attached }]
    const outcome = resolveElementalDamage(target, 2, incoming)
    assert.equal(outcome.reaction, 'vaporize')
    assert.equal(outcome.damage, 4)
    assert.equal(outcome.follower.health, 6)
    assert.deepEqual(outcome.follower.aura, [])
  }
})

test('溶解は炎→氷、氷→炎の両方向で+3し付着を消費する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  for (const [attached, incoming] of [['pyro', 'cryo'], ['cryo', 'pyro']]) {
    const state = startedGame()
    const target = place(state, 1, 'test-mage', 1, 10)
    target.aura = [{ element: attached }]
    const outcome = resolveElementalDamage(target, 1, incoming)
    assert.equal(outcome.reaction, 'melt')
    assert.equal(outcome.damage, 4)
    assert.equal(outcome.follower.health, 6)
    assert.deepEqual(outcome.follower.aura, [])
  }
})

test('元素のない攻撃では反応を起こさず、元の付着を維持する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 8)
  target.aura = [{ element: 'pyro' }]
  const result = resolveElementalDamage(target, 2)
  assert.equal(result.reaction, null)
  assert.equal(result.follower.health, 6)
  assert.deepEqual(result.follower.aura, [{ element: 'pyro' }])
})

test('氷の射手の登場時効果で溶解+3、致死ダメージなら墓場へ送る', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-archer']
  const target = place(state, 1, 'test-mage', 1, 4)
  target.aura = [{ element: 'pyro' }]
  const next = engine.playCard(state, 'player1', 0, target.instanceId)
  assert.equal(next.players[1].field.length, 0)
  assert.deepEqual(next.players[1].graveyard, ['test-mage'])
})

test('炎スライムの通常攻撃で蒸発が発生する', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 1, 6)
  const target = place(state, 1, 'test-mage', 1, 7)
  target.aura = [{ element: 'hydro' }]
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[1].field[0].health, 4)
  assert.deepEqual(next.players[1].field[0].aura, [])
})

test('同時戦闘で片方に反応が発生しても双方の攻撃を処理する', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 2, 2)
  const target = place(state, 1, 'test-slime', 2, 4)
  target.aura = [{ element: 'hydro' }]
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[0].field.length, 0)
  assert.equal(next.players[1].field.length, 0)
  assert.deepEqual(next.players[0].graveyard, ['test-slime'])
  assert.deepEqual(next.players[1].graveyard, ['test-slime'])
})

test('感電は水＋雷で反応し、攻撃対象の付着を解除する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  for (const [aura, incoming] of [['hydro', 'electro'], ['electro', 'hydro']]) {
    const state = startedGame()
    const target = place(state, 1, 'test-mage', 1, 8)
    target.aura = [{ element: aura }]
    const result = resolveElementalDamage(target, 2, incoming)
    assert.equal(result.reaction, 'electro_charged')
    assert.equal(result.follower.health, 6)
    assert.deepEqual(result.follower.aura, [])
  }
})

test('感電の追加1ダメージは別の敵フォロワーへ与える', async () => {
  const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 8)
  place(state, 1, 'test-hilichurl', 1, 3)
  const next = resolveReactionConsequence(state, 1, target.instanceId, 'electro_charged')
  assert.equal(next.players[1].field[0].health, 8)
  assert.equal(next.players[1].field[1].health, 2)
  assert.equal(next.players[1].leaderHealth, 20)
})

test('感電で別の敵がいないときはリーダーに1ダメージ', async () => {
  const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 8)
  const next = resolveReactionConsequence(state, 1, target.instanceId, 'electro_charged')
  assert.equal(next.players[1].leaderHealth, 19)
})

test('過負荷は炎＋雷で反応しコスト5以下の敵を手札に戻す', async () => {
  const { resolveReactionConsequence, resolveElementalDamage } =
    await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-hilichurl', 1, 8)
  target.aura = [{ element: 'pyro' }]
  const outcome = resolveElementalDamage(target, 1, 'electro')
  assert.equal(outcome.reaction, 'overloaded')
  state.players[1].field[0] = outcome.follower
  const before = state.players[1].hand.length
  const next = resolveReactionConsequence(state, 1, target.instanceId, outcome.reaction)
  assert.equal(next.players[1].field.length, 0)
  assert.equal(next.players[1].hand.length, before + 1)
  assert.equal(next.players[1].hand.at(-1), 'test-hilichurl')
  assert.equal(next.players[1].graveyard.length, 0)
})

test('凍結は水＋氷で発生し、反応後は付着を解除する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 8)
  target.aura = [{ element: 'hydro' }]
  const outcome = resolveElementalDamage(target, 1, 'cryo')
  assert.equal(outcome.reaction, 'frozen')
  assert.deepEqual(outcome.follower.aura, [])
  assert.equal(outcome.follower.health, 7)
  assert.equal(outcome.follower.keywords.includes('frozen'), true)
  assert.equal(engine.canFollowerAttack(outcome.follower), false)
})

test('凍結したフォロワーは持ち主のターン終了まで攻撃不可', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-hilichurl', 2, 5)
  attacker.keywords = ['frozen']
  const blocked = engine.attackLeader(state, attacker.instanceId)
  assert.equal(blocked.players[1].leaderHealth, 20)
  const switched = engine.endTurn(state)
  assert.equal(switched.players[0].field[0].keywords.includes('frozen'), false)
  assert.equal(switched.currentPlayerId, 'player2')
})

test('氷の射手の効果で凍結し、解除前は攻撃できない', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-archer']
  const target = place(state, 1, 'test-mage', 1, 8)
  target.aura = [{ element: 'hydro' }]
  const next = engine.playCard(state, 'player1', 0, target.instanceId)
  const enemy = next.players[1].field[0]
  assert.equal(enemy.health, 6)
  assert.equal(enemy.keywords.includes('frozen'), true)
  assert.equal(engine.canFollowerAttack(enemy), false)
})

test('通常攻撃中の反応はダメージの同時処理を維持する', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 1, 5)
  const target = place(state, 1, 'test-hilichurl', 1, 5)
  target.aura = [{ element: 'electro' }]
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[0].field[0].health, 4)
  assert.equal(next.players[1].field.length, 0)
  assert.equal(next.players[1].hand.at(-1), 'test-hilichurl')
})

test('超電導：氷＋雷で次の物理ダメージが+2になり一度で消費される', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const f = place(state, 1, 'test-mage', 1, 10)
  f.aura = [{element:'cryo'}]
  const reaction = resolveElementalDamage(f, 1, 'electro')
  assert.equal(reaction.reaction, 'superconduct')
  assert.ok(reaction.follower.keywords.includes('superconduct'))
  assert.deepEqual(reaction.follower.aura, [])
  const hit = resolveElementalDamage(reaction.follower, 1)
  assert.equal(hit.damage, 3)
  assert.equal(hit.follower.keywords.includes('superconduct'), false)
  assert.equal(resolveElementalDamage(hit.follower, 1).damage, 1)
})

test('原激化：草＋雷で2回分の状態を作り雷・草の命中で消費する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const f = place(state, 1, 'test-mage', 1, 12)
  f.aura = [{element:'dendro'}]
  const first = resolveElementalDamage(f, 1, 'electro')
  assert.equal(first.reaction,'quicken')
  assert.ok(first.follower.keywords.includes('quicken:2'))
  const second = resolveElementalDamage(first.follower, 1, 'electro')
  assert.ok(second.follower.keywords.includes('quicken:1'))
  const third = resolveElementalDamage(second.follower, 1, 'dendro')
  assert.equal(third.follower.keywords.some(k => k.startsWith('quicken:')),false)
})

test('燃焼：炎＋草でターン数1が付き、ターン終了に1ダメージで解除', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const f = place(state, 0, 'test-mage', 1, 10)
  f.aura = [{element:'dendro'}]
  const reaction = resolveElementalDamage(f, 1, 'pyro')
  assert.equal(reaction.reaction,'burning')
  assert.ok(reaction.follower.keywords.includes('burning:1'))
  state.players[0].field[0] = reaction.follower
  const next = engine.endTurn(state)
  assert.equal(next.players[0].field[0].health, 8)
  assert.equal(next.players[0].field[0].keywords.some(k => k.startsWith('burning:')),false)
})

test('拡散：風＋炎は別の敵にも1ダメージと炎付着', async () => {
  const { resolveElementalDamage,resolveReactionConsequence } =
    await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const primary = place(state,1,'test-mage',1,8)
  const other = place(state,1,'test-hilichurl',1,8)
  primary.aura=[{element:'pyro'}]
  const effect=resolveElementalDamage(primary,1,'anemo')
  assert.equal(effect.reaction,'swirl')
  state.players[1].field[0]=effect.follower
  const result=resolveReactionConsequence(state,1,primary.instanceId,effect.reaction,effect.reactedElement)
  assert.equal(result.players[1].field[1].health,7)
  assert.deepEqual(result.players[1].field[1].aura,[{element:'pyro'}])
  assert.equal(result.players[1].field[0].health,7)
  assert.deepEqual(result.players[1].field[0].aura,[])
  assert.equal(other.health,8)
})

test('拡散の飛び火は別の元素と反応できる', async () => {
  const {resolveElementalDamage,resolveReactionConsequence} = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state=startedGame()
  const primary=place(state,1,'test-mage',1,8)
  const secondary=place(state,1,'test-hilichurl',1,8)
  primary.aura=[{element:'pyro'}]
  secondary.aura=[{element:'hydro'}]
  const reaction=resolveElementalDamage(primary,1,'anemo')
  state.players[1].field[0]=reaction.follower
  const next=resolveReactionConsequence(state,1,primary.instanceId,reaction.reaction,reaction.reactedElement)
  assert.equal(next.players[1].field[1].health,5)
  assert.deepEqual(next.players[1].field[1].aura,[])
})

test('結晶：岩で反応すると攻撃側の結晶シールドが1増加する', async () => {
  const {resolveElementalDamage,resolveReactionConsequence}=await vite.ssrLoadModule('/src/game/elemental.ts')
  const state=startedGame()
  const caster=place(state,0,'test-hilichurl',1,8)
  const target=place(state,1,'test-mage',1,8)
  target.aura=[{element:'hydro'}]
  const r=resolveElementalDamage(target,1,'geo')
  assert.equal(r.reaction,'crystallize')
  state.players[1].field[0]=r.follower
  const next=resolveReactionConsequence(state,1,target.instanceId,r.reaction,r.reactedElement)
  assert.equal(next.players[0].field[0].shield.crystallize,1)
  assert.equal(next.players[0].field[0].instanceId,caster.instanceId)
})

test('シールド：通常から消費し、その後に結晶、残りだけHP減少', async () => {
  const { absorbDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const unit = place(state, 0, 'test-shield-guard', 1, 10)
  unit.shield = { normal: 3, crystallize: 4 }
  const a = absorbDamage(unit, 5)
  assert.equal(a.health, 10)
  assert.deepEqual(a.shield, { normal: 0, crystallize: 2 })
  const b = absorbDamage(a, 4)
  assert.equal(b.health, 8)
  assert.deepEqual(b.shield, { normal: 0, crystallize: 0 })
})

test('シールド：各種類の最大値は10、負の付与は無視', async () => {
  const { grantShield } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const unit = place(state, 0, 'test-shield-guard', 1, 10)
  const a = grantShield(unit, 'normal', 20)
  const b = grantShield(a, 'crystallize', 30)
  assert.deepEqual(b.shield, { normal: 10, crystallize: 10 })
  assert.deepEqual(grantShield(b, 'normal', -5).shield, b.shield)
})

test('シールド兵の登場時効果は通常シールド3を付与する', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-shield-guard']
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[0].field[0].shield.normal, 3)
})

test('通常攻撃と反撃の両方でシールドが吸収する', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-hilichurl', 3, 5)
  const target = place(state, 1, 'test-shield-guard', 2, 5)
  attacker.shield = { normal: 2, crystallize: 1 }
  target.shield = { normal: 1, crystallize: 1 }
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[0].field[0].health, 5)
  assert.deepEqual(next.players[0].field[0].shield, {normal:0, crystallize:1})
  assert.equal(next.players[1].field[0].health, 4)
  assert.deepEqual(next.players[1].field[0].shield, {normal:0, crystallize:0})
})

test('元素ダメージは反応計算後の合計値をシールドで吸収する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const unit = place(state, 1, 'test-mage', 1, 10)
  unit.aura = [{element:'hydro'}]
  unit.shield = {normal:3, crystallize:2}
  const result = resolveElementalDamage(unit, 2, 'pyro')
  assert.equal(result.reaction,'vaporize')
  assert.equal(result.damage,4)
  assert.equal(result.follower.health,10)
  assert.deepEqual(result.follower.shield, {normal:0, crystallize:1})
  assert.deepEqual(result.follower.aura, [])
})

test('元素生物：登場時から固有元素を持つ（水・風・岩）', () => {
  for(const [id,element] of [['test-hydro-elemental','hydro'],['test-anemo-elemental','anemo'],['test-geo-elemental','geo']]) {
    const state = startedGame()
    state.players[0].pp = 2
    state.players[0].hand = [id]
    const next = engine.playCard(state, 'player1', 0)
    assert.deepEqual(next.players[0].field[0].aura, [{element}])
  }
})

test('元素生物：反応後に固有元素付着を復元し別元素は残さない', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const unit = place(state, 1, 'test-hydro-elemental', 1, 10)
  unit.aura = [{element:'hydro'}]
  const result = resolveElementalDamage(unit, 1, 'pyro')
  assert.equal(result.reaction, 'vaporize')
  assert.deepEqual(result.follower.aura, [{element:'hydro'}])
})

test('元素生物：風・岩の固有付着は元素反応後も保持', async () => {
  const { restoreInherentAura, resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  for (const [id,element] of [['test-anemo-elemental','anemo'],['test-geo-elemental','geo']]) {
    const unit = place(state, 1, id, 1, 10)
    assert.deepEqual(restoreInherentAura(unit).aura, [{element}])
    const result = resolveElementalDamage(restoreInherentAura(unit), 1, 'hydro')
    assert.deepEqual(result.follower.aura[0], {element})
  }
})

test('燃焼ダメージもシールドで吸収してHPを減らさない', () => {
  const state = startedGame()
  const unit = place(state, 0, 'test-mage', 1, 10)
  unit.shield = { normal: 1, crystallize: 0 }
  unit.keywords = ['burning:1']
  const next = engine.endTurn(state)
  assert.equal(next.players[0].field[0].health,10)
  assert.equal(next.players[0].field[0].shield.normal,0)
})

test('開花：水＋草の反応で攻撃側に0/1草原核を生成し攻撃不可', async () => {
  const { resolveElementalDamage, resolveReactionConsequence } =
    await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 10)
  target.aura = [{ element: 'hydro' }]
  const result = resolveElementalDamage(target, 1, 'dendro')
  assert.equal(result.reaction, 'bloom')
  assert.deepEqual(result.follower.aura, [])
  state.players[1].field[0] = result.follower
  const next = resolveReactionConsequence(state, 1, target.instanceId, 'bloom', result.reactedElement, 0)
  const core = next.players[0].field[0]
  assert.equal(core.cardId, 'dendro-core')
  assert.equal(core.attack, 0)
  assert.equal(core.health, 1)
  assert.equal(engine.canFollowerAttack(core), false)
})

test('再開花：既存の草原核の体力と最大体力が1増加する', async () => {
  const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
  let state = startedGame()
  state = resolveReactionConsequence(state, 1, 'dummy', 'bloom', 'hydro', 0)
  const old = state.players[0].field[0]
  state = resolveReactionConsequence(state, 1, 'dummy', 'bloom', 'hydro', 0)
  assert.equal(state.players[0].field.length, 1)
  assert.equal(state.players[0].field[0].instanceId, old.instanceId)
  assert.equal(state.players[0].field[0].health, 2)
  assert.equal(state.players[0].field[0].maxHealth, 2)
})

test('草原核は自分のフィールド5枠を超えて生成されない', async () => {
  const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  for (let i = 0; i < 5; i++) place(state, 0, 'test-slime', 1, 2)
  const next = resolveReactionConsequence(state, 1, 'dummy', 'bloom', 'hydro', 0)
  assert.equal(next.players[0].field.length, 5)
  assert.equal(next.players[0].field.some(f => f.cardId === 'dendro-core'), false)
})

test('烈開花：炎で草原核を破壊し持ち主リーダーを3ターン燃焼にする', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 1, 4)
  const core = place(state, 1, 'dendro-core', 0, 1)
  core.keywords = ['cannot_attack']
  core.shield = { normal: 5, crystallize: 2 }
  const next = engine.attackFollower(state, attacker.instanceId, core.instanceId)
  assert.equal(next.players[1].field.length, 0)
  assert.ok(next.players[1].graveyard.includes('dendro-core'))
  assert.equal(next.players[1].leaderBurningTurns, 3)
})

test('超開花：雷で草原核を破壊し自陣別フォロワーに3ダメージ', async () => {
  const { resolveElementalDamage, resolveReactionConsequence } =
    await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const core = place(state, 1, 'dendro-core', 0, 1)
  core.keywords = ['cannot_attack']
  const target = place(state, 1, 'test-mage', 1, 8)
  const outcome = resolveElementalDamage(core, 1, 'electro')
  assert.equal(outcome.reaction, 'hyperbloom')
  state.players[1].field[0] = outcome.follower
  const next = resolveReactionConsequence(state, 1, core.instanceId, outcome.reaction)
  assert.equal(next.players[1].field[0].health, 0)
  assert.equal(next.players[1].field[1].health, 5)
  assert.equal(target.health, 8)
})

test('草原核への物理攻撃はシールドで防げる', async () => {
  const { createDendroCore, grantShield, resolveElementalDamage } =
    await vite.ssrLoadModule('/src/game/elemental.ts')
  const core = grantShield(createDendroCore(), 'normal', 2)
  const hit = resolveElementalDamage(core, 1)
  assert.equal(hit.reaction, null)
  assert.equal(hit.follower.health, 1)
  assert.equal(hit.follower.shield.normal, 1)
})

test('草原核のターン終了時自傷2ダメージは通常シールドから吸収する', async () => {
  const { createDendroCore } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const core = createDendroCore()
  core.shield.normal = 2
  state.players[0].field.push(core)
  const next = engine.endTurn(state)
  assert.equal(next.players[0].field.length, 1)
  assert.equal(next.players[0].field[0].health, 1)
  assert.equal(next.players[0].field[0].shield.normal, 0)
})

test('草原核の自傷で破壊されたトークンも墓場に送られる', async () => {
  const { createDendroCore } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  state.players[0].field.push(createDendroCore())
  const next = engine.endTurn(state)
  assert.equal(next.players[0].field.length, 0)
  assert.deepEqual(next.players[0].graveyard, ['dendro-core'])
})

test('烈開花によるリーダー燃焼は3回の持ち主ターン終了時にダメージ', () => {
  let state = startedGame()
  state.players[0].leaderBurningTurns = 3
  for (let i = 0; i < 6; i++) state = engine.endTurn(state)
  assert.equal(state.players[0].leaderHealth, 17)
  assert.equal(state.players[0].leaderBurningTurns, 0)
  state = engine.endTurn(state)
  state = engine.endTurn(state)
  assert.equal(state.players[0].leaderHealth, 17)
})

test('草の術師による実際のファンファーレ開花で草原核が生成される', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-dendro-caster']
  const target = place(state, 1, 'test-mage', 1, 6)
  target.aura = [{ element: 'hydro' }]
  const next = engine.playCard(state, 'player1', 0, target.instanceId)
  assert.equal(next.players[0].field.length, 2)
  assert.equal(next.players[0].field[1].cardId, 'dendro-core')
  assert.equal(next.players[1].field[0].health, 5)
})

test('草原核トークンは通常のランダムデッキに含まれない', () => {
  for (let i = 0; i < 8; i++) {
    const state = engine.createInitialGameState()
    for (const player of state.players) {
      assert.equal([...player.hand, ...player.deck].includes('dendro-core'), false)
    }
  }
})

test('共有ENはプレイヤーごとに0で始まりフォロワーにENを持たない', () => {
  const state = startedGame()
  assert.equal(state.players[0].energy, 0)
  assert.equal(state.players[1].energy, 0)
  const follower = place(state, 0, 'test-elemental-caster', 1, 4)
  assert.equal('energy' in follower, false)
})

test('元素スキルは登場ターンに使用できEN+1と能力効果を適用する', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-elemental-caster']
  const placed = engine.playCard(state, 'player1', 0)
  const source = placed.players[0].field[0]
  assert.equal(source.canAttack, false)
  assert.equal(engine.canUseAbility(placed, source.instanceId, 'skill'), true)
  const next = engine.activateAbility(placed, source.instanceId, 'skill')
  assert.equal(next.players[0].energy, 1)
  assert.equal(next.players[0].field[0].shield.normal, 1)
  assert.equal(next.players[0].field[0].skillUsed, true)
  assert.equal(next.players[1].energy, 0)
})

test('スキルは同じフォロワーで1ターン1回しか使えない', () => {
  const state = startedGame()
  const f = place(state, 0, 'test-elemental-caster', 1, 4)
  const next = engine.activateAbility(state, f.instanceId, 'skill')
  assert.equal(engine.canUseAbility(next, f.instanceId, 'skill'), false)
  const again = engine.activateAbility(next, f.instanceId, 'skill')
  assert.equal(again, next)
  assert.equal(next.players[0].energy, 1)
})

test('異なるフォロワーのスキルで共通ENを最大5まで貯める', () => {
  let state = startedGame()
  state.players[0].energy = 4
  const a = place(state, 0, 'test-elemental-caster', 1, 4)
  const b = place(state, 0, 'test-electro-caster', 1, 4)
  state = engine.activateAbility(state, a.instanceId, 'skill')
  state = engine.activateAbility(state, b.instanceId, 'skill')
  assert.equal(state.players[0].energy, 5)
  assert.equal(state.players[0].field[0].skillUsed, true)
  assert.equal(state.players[0].field[1].skillUsed, true)
})

test('元素爆発は共有EN不足では使用不可かつ状態を変更しない', () => {
  const state = startedGame()
  const f = place(state, 0, 'test-electro-caster', 1, 4)
  assert.equal(engine.canUseAbility(state, f.instanceId, 'burst'), false)
  assert.equal(engine.activateAbility(state, f.instanceId, 'burst'), state)
})

test('元素爆発はEN2を消費しリーダーへ3ダメージを与える', () => {
  const state = startedGame()
  const f = place(state, 0, 'test-electro-caster', 1, 4)
  state.players[0].energy = 3
  const next = engine.activateAbility(state, f.instanceId, 'burst')
  assert.equal(next.players[0].energy, 1)
  assert.equal(next.players[1].leaderHealth, 17)
  assert.equal(next.players[0].field[0].burstUsed, true)
  assert.equal(engine.canUseAbility(next, f.instanceId, 'burst'), false)
})

test('元素爆発の対象指定は必須で、無効対象ならENを消費しない', () => {
  const state = startedGame()
  state.players[0].energy = 2
  const f = place(state, 0, 'test-elemental-caster', 1, 4)
  const enemy = place(state, 1, 'test-hilichurl', 1, 6)
  assert.equal(engine.canUseAbility(state, f.instanceId, 'burst'), true)
  assert.equal(engine.activateAbility(state, f.instanceId, 'burst'), state)
  assert.equal(engine.activateAbility(state, f.instanceId, 'burst', 'missing'), state)
  const next = engine.activateAbility(state, f.instanceId, 'burst', enemy.instanceId)
  assert.equal(next.players[0].energy, 0)
  assert.equal(next.players[1].field[0].health, 3)
  assert.equal(next.players[0].field[0].burstUsed, true)
})

test('元素爆発は同じターン1回、スキルとは別枠', () => {
  const state = startedGame()
  state.players[0].energy = 2
  const f = place(state, 0, 'test-electro-caster', 1, 4)
  const burst = engine.activateAbility(state, f.instanceId, 'burst')
  assert.equal(engine.canUseAbility(burst, f.instanceId, 'skill'), true)
  const skill = engine.activateAbility(burst, f.instanceId, 'skill')
  assert.equal(skill.players[0].energy, 1)
  assert.equal(skill.players[1].leaderHealth, 16)
  assert.equal(engine.canUseAbility(skill, f.instanceId, 'burst'), false)
})

test('凍結中はスキルも爆発も使用できない', () => {
  const state = startedGame()
  state.players[0].energy = 5
  const f = place(state, 0, 'test-electro-caster', 1, 4)
  f.keywords = ['frozen']
  assert.equal(engine.canUseAbility(state, f.instanceId, 'skill'), false)
  assert.equal(engine.canUseAbility(state, f.instanceId, 'burst'), false)
  assert.equal(engine.activateAbility(state, f.instanceId, 'skill'), state)
})

test('能力使用回数は自分の次ターン開始時にリセットされる', () => {
  let state = startedGame()
  const f = place(state, 0, 'test-electro-caster', 1, 4)
  state.players[0].energy = 2
  state = engine.activateAbility(state, f.instanceId, 'skill')
  state = engine.activateAbility(state, f.instanceId, 'burst')
  assert.equal(state.players[0].field[0].skillUsed, true)
  assert.equal(state.players[0].field[0].burstUsed, true)
  state = engine.endTurn(state)
  assert.equal(state.players[0].field[0].skillUsed, true)
  state = engine.endTurn(state)
  assert.equal(state.currentPlayerId, 'player1')
  assert.equal(state.players[0].field[0].skillUsed, false)
  assert.equal(state.players[0].field[0].burstUsed, false)
})

test('相手フォロワーの能力は手動で使用できない', () => {
  const state = startedGame()
  const enemy = place(state, 1, 'test-electro-caster', 1, 4)
  assert.equal(engine.canUseAbility(state, enemy.instanceId, 'skill'), false)
  assert.equal(engine.activateAbility(state, enemy.instanceId, 'skill'), state)
})

test('使用可能な効果なし・ゲーム終了後は能力使用不可', () => {
  const state = startedGame()
  const ordinary = place(state, 0, 'test-hilichurl', 2, 2)
  const caster = place(state, 0, 'test-electro-caster', 1, 4)
  assert.equal(engine.canUseAbility(state, ordinary.instanceId, 'skill'), false)
  state.winnerId = 'player1'
  assert.equal(engine.canUseAbility(state, caster.instanceId, 'skill'), false)
})

test('複数効果は順番に処理し破壊時のラストワードを次の効果より先に解決する', () => {
  const state = startedGame()
  const caster = place(state, 0, 'test-chain-caster', 1, 4)
  const enemy = place(state, 1, 'test-hilichurl', 1, 2)
  state.players[1].leaderHealth = 20
  const next = engine.activateAbility(state, caster.instanceId, 'skill', enemy.instanceId)
  assert.equal(next.players[1].field.length, 0)
  assert.deepEqual(next.players[1].graveyard, ['test-hilichurl'])
  // 敵ラストワードの+2は満タンで溢れ、続くリーダー2ダメージで18になる
  assert.equal(next.players[1].leaderHealth, 18)
  assert.equal(next.players[0].energy, 1)
})

test('途中で対象が破壊されても後続のリーダー効果は実行される', () => {
  const state = startedGame()
  const caster = place(state, 0, 'test-chain-caster', 1, 4)
  const target = place(state, 1, 'test-mage', 1, 1)
  const next = engine.activateAbility(state, caster.instanceId, 'skill', target.instanceId)
  assert.equal(next.players[1].field.length, 0)
  assert.equal(next.players[1].leaderHealth, 18)
  assert.equal(next.players[0].field[0].skillUsed, true)
})

test('途中で勝敗が確定した場合は後続の回復効果を実行しない', () => {
  const state = startedGame()
  const caster = place(state, 0, 'test-chain-caster', 1, 4)
  state.players[0].energy = 2
  const next = engine.activateAbility(state, caster.instanceId, 'burst')
  assert.equal(next.winnerId, 'player1')
  assert.equal(next.players[1].leaderHealth, 0)
  assert.equal(next.players[0].energy, 0)
})

test('オーラ：選択対象がオーラのみなら対象指定能力を使用できない', () => {
  const state = startedGame()
  const caster = place(state, 0, 'test-elemental-caster', 1, 4)
  state.players[0].energy = 2
  const protectedUnit = place(state, 1, 'test-mage', 1, 4)
  protectedUnit.keywords = ['aura']
  assert.equal(engine.canUseAbility(state, caster.instanceId, 'burst'), false)
  assert.equal(engine.activateAbility(state, caster.instanceId, 'burst', protectedUnit.instanceId), state)
})

test('オーラ：別の選択可能な敵がいれば能力を発動できるがオーラは選べない', () => {
  const state = startedGame()
  const caster = place(state, 0, 'test-elemental-caster', 1, 4)
  state.players[0].energy = 2
  const protectedUnit = place(state, 1, 'test-mage', 1, 4)
  protectedUnit.keywords = ['aura']
  const ordinary = place(state, 1, 'test-mage', 1, 4)
  assert.equal(engine.canUseAbility(state, caster.instanceId, 'burst'), true)
  assert.equal(engine.activateAbility(state, caster.instanceId, 'burst', protectedUnit.instanceId), state)
  const next = engine.activateAbility(state, caster.instanceId, 'burst', ordinary.instanceId)
  assert.equal(next.players[1].field[0].health, 4)
  assert.equal(next.players[1].field[1].health, 1)
  assert.equal(next.players[0].energy, 0)
})

test('オーラ：ファンファーレで対象に選べずPPも手札も消費しない', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-archer']
  const target = place(state, 1, 'test-mage', 1, 4)
  target.keywords = ['aura']
  assert.equal(engine.canPlayCard(state, 0), false)
  assert.equal(engine.playCard(state, 'player1', 0, target.instanceId), state)
  place(state, 1, 'test-mage', 1, 4)
  assert.equal(engine.canPlayCard(state, 0), true)
  assert.equal(engine.playCard(state, 'player1', 0, target.instanceId), state)
})

test('威圧：フォロワーからの攻撃だけ防ぎ効果の対象には選べる', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-hilichurl', 3, 5)
  const intimidating = place(state, 1, 'test-mage', 1, 6)
  intimidating.keywords = ['intimidate']
  assert.equal(engine.attackFollower(state, attacker.instanceId, intimidating.instanceId), state)
  state.players[0].pp = 2
  state.players[0].hand = ['test-archer']
  const next = engine.playCard(state, 'player1', 0, intimidating.instanceId)
  assert.equal(next.players[1].field[0].health, 4)
})

test('オーラのフォロワーは通常攻撃対象には選べる', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-hilichurl', 2, 5)
  const target = place(state, 1, 'test-mage', 1, 6)
  target.keywords = ['aura']
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[1].field[0].health, 4)
})

test('複数効果中の元素反応でも後続効果と使用済み状態が保持される', () => {
  const state = startedGame()
  const caster = place(state, 0, 'test-chain-caster', 1, 4)
  const enemy = place(state, 1, 'test-hydro-elemental', 1, 9)
  enemy.aura = [{ element: 'hydro' }]
  const next = engine.activateAbility(state, caster.instanceId, 'skill', enemy.instanceId)
  assert.equal(next.players[1].field[0].health, 1) // 2+2 then 2+2 reaction from inherent hydro
  assert.deepEqual(next.players[1].field[0].aura, [{ element: 'hydro' }])
  assert.equal(next.players[1].leaderHealth, 18)
  assert.equal(next.players[0].field[0].skillUsed, true)
})
