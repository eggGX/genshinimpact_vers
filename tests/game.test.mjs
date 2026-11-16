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

test('戦闘のダメージは双方同時に適用される', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'C011', 2, 2)
  const target = place(state, 1, 'C011', 2, 2)
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[0].field.length, 0)
  assert.equal(next.players[1].field.length, 0)
  assert.equal(next.players[0].graveyard.length, 1)
  assert.equal(next.players[1].graveyard.length, 1)
})

test('攻撃したフォロワーは同じターンに再度攻撃できない', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'C011', 1, 2)
  const next = engine.attackLeader(state, attacker.instanceId)
  assert.equal(next.players[1].leaderHealth, 19)
  assert.equal(next.players[0].field[0].hasAttacked, true)
  const again = engine.attackLeader(next, attacker.instanceId)
  assert.equal(again.players[1].leaderHealth, 19)
})

test('炎アビス魔術師の元素通常攻撃は生存した敵に炎元素を付着させる', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'C014', 1, 2)
  const target = place(state, 1, 'C001', 1, 4)
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[1].field[0].health, 3)
  assert.deepEqual(next.players[1].field[0].aura, [{ element: 'pyro' }])
})

test('物理通常攻撃は元素付着を生じない', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'C001', 1, 4)
  const target = place(state, 1, 'C001', 1, 4)
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.deepEqual(next.players[1].field[0].aura, [])
})

test('風・岩・無元素の攻撃は付着せず、同元素は重複登録しない', async () => {
  const { applyElementalAura } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'C001', 1, 4)
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
  const target = place(state, 1, 'C001', 1, 4)
  const hydro = applyElementalAura(target, 'hydro')
  const cryo = applyElementalAura(hydro, 'cryo')
  assert.deepEqual(cryo.aura.map(a => a.element), ['hydro', 'cryo'])
  assert.equal(cryo.health, 4)
})

test('蒸発は水→炎、炎→水の両方向で+2し付着を消費する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  for (const [attached, incoming] of [['hydro', 'pyro'], ['pyro', 'hydro']]) {
    const state = startedGame()
    const target = place(state, 1, 'C001', 1, 10)
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
    const target = place(state, 1, 'C001', 1, 10)
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
  const target = place(state, 1, 'C001', 1, 8)
  target.aura = [{ element: 'pyro' }]
  const result = resolveElementalDamage(target, 2)
  assert.equal(result.reaction, null)
  assert.equal(result.follower.health, 6)
  assert.deepEqual(result.follower.aura, [{ element: 'pyro' }])
})

test('炎アビス魔術師の元素通常攻撃で蒸発が発生する', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'C014', 1, 6)
  const target = place(state, 1, 'C001', 1, 7)
  target.aura = [{ element: 'hydro' }]
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[1].field[0].health, 4)
  assert.deepEqual(next.players[1].field[0].aura, [])
})

test('同時戦闘で片方に反応が発生しても双方の攻撃を処理する', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'C014', 2, 2)
  const target = place(state, 1, 'C011', 2, 4)
  target.aura = [{ element: 'hydro' }]
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[0].field.length, 0)
  assert.equal(next.players[1].field.length, 0)
  assert.deepEqual(next.players[0].graveyard, ['C014'])
  assert.deepEqual(next.players[1].graveyard, ['C011'])
})

test('感電は水＋雷で反応し、攻撃対象の付着を解除する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  for (const [aura, incoming] of [['hydro', 'electro'], ['electro', 'hydro']]) {
    const state = startedGame()
    const target = place(state, 1, 'C001', 1, 8)
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
  const target = place(state, 1, 'C001', 1, 8)
  place(state, 1, 'C001', 1, 3)
  const next = resolveReactionConsequence(state, 1, target.instanceId, 'electro_charged')
  assert.equal(next.players[1].field[0].health, 8)
  assert.equal(next.players[1].field[1].health, 2)
  assert.equal(next.players[1].leaderHealth, 20)
})

test('感電で別の敵がいないときはリーダーに1ダメージ', async () => {
  const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'C001', 1, 8)
  const next = resolveReactionConsequence(state, 1, target.instanceId, 'electro_charged')
  assert.equal(next.players[1].leaderHealth, 19)
})

test('過負荷は炎＋雷で反応しコスト5以下の敵を手札に戻す', async () => {
  const { resolveReactionConsequence, resolveElementalDamage } =
    await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'C001', 1, 8)
  target.aura = [{ element: 'pyro' }]
  const outcome = resolveElementalDamage(target, 1, 'electro')
  assert.equal(outcome.reaction, 'overloaded')
  state.players[1].field[0] = outcome.follower
  const before = state.players[1].hand.length
  const next = resolveReactionConsequence(state, 1, target.instanceId, outcome.reaction)
  assert.equal(next.players[1].field.length, 0)
  assert.equal(next.players[1].hand.length, before + 1)
  assert.equal(next.players[1].hand.at(-1), 'C001')
  assert.equal(next.players[1].graveyard.length, 0)
})

test('凍結は水＋氷で発生し、反応後は付着を解除する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'C001', 1, 8)
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
  const attacker = place(state, 0, 'C001', 2, 5)
  attacker.keywords = ['frozen']
  const blocked = engine.attackLeader(state, attacker.instanceId)
  assert.equal(blocked.players[1].leaderHealth, 20)
  const switched = engine.endTurn(state)
  assert.equal(switched.players[0].field[0].keywords.includes('frozen'), false)
  assert.equal(switched.currentPlayerId, 'player2')
})

test('通常攻撃中の反応はダメージの同時処理を維持する', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'C014', 1, 5)
  const target = place(state, 1, 'C001', 1, 5)
  target.aura = [{ element: 'electro' }]
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[0].field[0].health, 4)
  assert.equal(next.players[1].field.length, 0)
  assert.equal(next.players[1].hand.at(-1), 'C001')
})

test('超電導：氷＋雷で次の物理ダメージが+2になり一度で消費される', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const f = place(state, 1, 'C001', 1, 10)
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
  const f = place(state, 1, 'C001', 1, 12)
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
  const f = place(state, 0, 'C001', 1, 10)
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
  const primary = place(state,1,'C001',1,8)
  const other = place(state,1,'C001',1,8)
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
  const primary=place(state,1,'C001',1,8)
  const secondary=place(state,1,'C001',1,8)
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
  const caster=place(state,0,'C001',1,8)
  const target=place(state,1,'C001',1,8)
  target.aura=[{element:'hydro'}]
  const r=resolveElementalDamage(target,1,'geo')
  assert.equal(r.reaction,'crystallize')
  state.players[1].field[0]=r.follower
  const next=resolveReactionConsequence(state,1,target.instanceId,r.reaction,r.reactedElement)
  assert.equal(next.players[0].field[0].shield.crystallize,1)
  assert.equal(next.players[0].field[0].instanceId,caster.instanceId)
})

test('元素ダメージは反応計算後の合計値をシールドで吸収する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const unit = place(state, 1, 'C001', 1, 10)
  unit.aura = [{element:'hydro'}]
  unit.shield = {normal:3, crystallize:2}
  const result = resolveElementalDamage(unit, 2, 'pyro')
  assert.equal(result.reaction,'vaporize')
  assert.equal(result.damage,4)
  assert.equal(result.follower.health,10)
  assert.deepEqual(result.follower.shield, {normal:0, crystallize:1})
  assert.deepEqual(result.follower.aura, [])
})

test('燃焼ダメージもシールドで吸収してHPを減らさない', () => {
  const state = startedGame()
  const unit = place(state, 0, 'C001', 1, 10)
  unit.shield = { normal: 1, crystallize: 0 }
  unit.keywords = ['burning:1']
  const next = engine.endTurn(state)
  assert.equal(next.players[0].field[0].health,10)
  assert.equal(next.players[0].field[0].shield.normal,0)
})

test('開花：水＋草の反応で発動者の相手側に0/1草原核を生成し攻撃不可', async () => {
  const { resolveElementalDamage, resolveReactionConsequence } =
    await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'C001', 1, 10)
  target.aura = [{ element: 'hydro' }]
  const result = resolveElementalDamage(target, 1, 'dendro')
  assert.equal(result.reaction, 'bloom')
  assert.deepEqual(result.follower.aura, [])
  state.players[1].field[0] = result.follower
  const next = resolveReactionConsequence(state, 1, target.instanceId, 'bloom', result.reactedElement, 0)
  const core = next.players[1].field.find(f => f.cardId === 'dendro-core')
  assert.ok(core)
  assert.equal(core.cardId, 'dendro-core')
  assert.equal(core.attack, 0)
  assert.equal(core.health, 1)
  assert.equal(engine.canFollowerAttack(core), false)
})

test('再開花：既存の草原核の体力と最大体力が1増加する', async () => {
  const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
  let state = startedGame()
  state = resolveReactionConsequence(state, 1, 'dummy', 'bloom', 'hydro', 0)
  const old = state.players[1].field[0]
  state = resolveReactionConsequence(state, 1, 'dummy', 'bloom', 'hydro', 0)
  assert.equal(state.players[1].field.length, 1)
  assert.equal(state.players[1].field[0].instanceId, old.instanceId)
  assert.equal(state.players[1].field[0].health, 2)
  assert.equal(state.players[1].field[0].maxHealth, 2)
})

test('草原核は自分のフィールド5枠を超えて生成されない', async () => {
  const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  for (let i = 0; i < 5; i++) place(state, 1, 'C011', 1, 2)
  const next = resolveReactionConsequence(state, 1, 'dummy', 'bloom', 'hydro', 0)
  assert.equal(next.players[1].field.length, 5)
  assert.equal(next.players[1].field.some(f => f.cardId === 'dendro-core'), false)
})

test('烈開花：炎で草原核を破壊し持ち主リーダーを3ターン燃焼にする', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'C014', 1, 4)
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
  const target = place(state, 1, 'C001', 1, 8)
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

test('草原核トークンは通常のランダムデッキに含まれない', () => {
  for (let i = 0; i < 8; i++) {
    const state = engine.createInitialGameState()
    for (const player of state.players) {
      assert.equal([...player.hand, ...player.deck].includes('dendro-core'), false)
    }
  }
})

test('オーラのフォロワーは通常攻撃対象には選べる', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'C001', 2, 5)
  const target = place(state, 1, 'C001', 1, 6)
  target.keywords = ['aura']
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[1].field[0].health, 4)
})

test('カード登録台帳は正式115枚・トークン24種だけを含む',async()=>{
  const { getCard,getAllCards,cardRegistry }=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const { productionCards }=await vite.ssrLoadModule('/src/data/productionCards.ts')
  const { productionTokens }=await vite.ssrLoadModule('/src/data/productionTokens.ts')
  assert.equal(productionCards.length,115)
  assert.equal(productionTokens.length,24)
  assert.equal(cardRegistry.size,139)
  assert.equal(getAllCards().length,139)
  for(const card of [...productionCards,...productionTokens])
    assert.equal(getCard(card.id)?.name,card.name)
  assert.equal(getCard('card-does-not-exist'),undefined)
})

test('カード登録台帳：IDの重複はエラーとして検出される', async () => {
  const { createCardRegistry } = await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const card = engine.getCard('C011')
  assert.throws(() => createCardRegistry([card, card]), /Duplicate card ID/)
  assert.throws(() => createCardRegistry([{ ...card, id: ' ' }]), /Card ID/)
})

test('カード登録台帳：トークンは検索可能でもデッキ候補に含まれない', async () => {
  const { getCard, getDeckCardPool } =
    await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const pool = getDeckCardPool()
  assert.equal(getCard('dendro-core')?.token, true)
  assert.ok(pool.length > 0)
  assert.equal(pool.some(card => card.id === 'dendro-core'), false)
  assert.ok(pool.every(card => !card.token))
})

test('正式カードとトークンの登録元だけを使用する', async()=>{
  const { productionCards }=await vite.ssrLoadModule('/src/data/productionCards.ts')
  const { productionTokens }=await vite.ssrLoadModule('/src/data/productionTokens.ts')
  const { getAllCards }=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  assert.equal(productionCards.length,115)
  assert.equal(productionTokens.length,24)
  assert.equal(getAllCards().length,productionCards.length+productionTokens.length)
})

test('正式115枚の枚数計画は無元素10枚と7元素各15枚', async () => {
  const { ELEMENT_ORDER, RARITY_ORDER, PLANNED_CARD_COUNTS, PLANNED_TOTAL } =
    await vite.ssrLoadModule('/src/data/cardValidation.ts')
  assert.equal(PLANNED_TOTAL, 115)
  assert.equal(ELEMENT_ORDER.length, 8)
  assert.equal(RARITY_ORDER.length, 4)
  assert.deepEqual(PLANNED_CARD_COUNTS.none, {
    bronze: 4, silver: 4, gold: 2, legendary: 0,
  })
  for (const element of ELEMENT_ORDER.filter(e => e !== 'none')) {
    assert.deepEqual(PLANNED_CARD_COUNTS[element], {
      bronze: 4, silver: 4, gold: 4, legendary: 3,
    })
  }
})

test('正式70枚登録時はエラーなし・予定45枚が不足と判定', async () => {
  const { validateProductionCards } = await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const { productionCards } = await vite.ssrLoadModule('/src/data/productionCards.ts')
  const report = validateProductionCards(productionCards)
  assert.deepEqual(report.errors, [])
  assert.equal(report.total, 115)
  assert.equal(report.plannedTotal, 115)
  assert.equal(report.slots.length, 32)
  assert.equal(report.slots.reduce((n, slot) => n + slot.remaining, 0), 0)
  assert.equal(report.ready, true)
})

test('カード検証：重複IDと空ID・空名前を検出', async () => {
  const { validateProductionCards } = await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const base = engine.getCard('C011')
  const report = validateProductionCards([
    { ...base, id: 'a', name: '1' },
    { ...base, id: 'a', name: '2' },
    { ...base, id: ' ', name: '' },
  ])
  assert.ok(report.errors.some(e => e.includes('重複')))
  assert.ok(report.errors.some(e => e.includes('ID')))
  assert.ok(report.errors.some(e => e.includes('名前')))
  assert.equal(report.ready, false)
})

test('カード検証：元素別・レアリティ別の枠超過を検出', async () => {
  const { validateProductionCards } = await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const base = engine.getCard('C011')
  const cards = Array.from({ length: 5 }, (_, n) => ({ ...base, id: `pyro-b-${n}` }))
  const report = validateProductionCards(cards)
  assert.ok(report.errors.some(e => e.includes('上限4枚')))
  assert.equal(report.slots.find(s => s.element === 'pyro' && s.rarity === 'bronze').registered, 5)
})

test('カード検証：コスト・攻撃力・体力とトークン禁止を検出', async () => {
  const { validateProductionCards } = await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const base = engine.getCard('C011')
  const report = validateProductionCards([
    { ...base, cost: -1, attack: -2, health: 0, token: true },
  ])
  for (const marker of ['コスト', '攻撃力', '体力', 'トークン']) {
    assert.ok(report.errors.some(e => e.includes(marker)), marker)
  }
})

test('カード検索：正式カード／トークンの区分を分離', async () => {
  const { filterCards } = await vite.ssrLoadModule('/src/data/cardFilters.ts')
  const cards = [engine.getCard('token-baron-bunny'), engine.getCard('C001')]
  const prodIds = new Set(['C001'])
  const filters = { element: 'all', rarity: 'all', origin: 'production', search: '' }
  assert.deepEqual(filterCards(cards, filters, prodIds).map(card => card.id), ['C001'])
  assert.deepEqual(filterCards(cards, { ...filters, origin: 'token' }, prodIds).map(card => card.id), ['token-baron-bunny'])
  assert.deepEqual(filterCards(cards, { ...filters, origin: 'all', search: 'ヒル' }, prodIds).map(card => card.id), ['C001'])
})

test('無元素の正式カードC001-C010を原本どおり10枚登録', async () => {
  const { neutralCards } = await vite.ssrLoadModule('/src/data/cards/neutral.ts')
  assert.deepEqual(neutralCards.map(c => c.id),
    Array.from({ length: 10 }, (_, i) => 'C' + String(i + 1).padStart(3, '0')))
  assert.deepEqual(neutralCards.map(c => c.name), [
    'ヒルチャール', '宝盗団・雑夫', '遺跡守衛', 'ワイルドハント',
    'ヒルチャール強襲', 'エラ・マスク', 'ティミー',
    'ヒルチャール暴徒', 'パイモンのへそくり', '第四降臨者の力',
  ])
  assert.deepEqual(neutralCards.map(c => c.cost), [1, 2, 5, 4, 4, 3, 3, 4, 3, 5])
  assert.deepEqual(neutralCards.map(c => c.rarity),
    ['bronze', 'bronze', 'bronze', 'bronze',
      'silver', 'silver', 'silver', 'silver', 'gold', 'gold'])
})

test('無元素10枚の種類とステータスを原本と照合', async () => {
  const { neutralCards } = await vite.ssrLoadModule('/src/data/cards/neutral.ts')
  assert.deepEqual(neutralCards.map(c => c.type), [
    'follower', 'follower', 'follower', 'follower', 'spell',
    'follower', 'follower', 'follower', 'spell', 'spell',
  ])
  assert.deepEqual(neutralCards.map(c => [c.attack ?? null, c.health ?? null]), [
    [1,2], [2,1], [4,6], [2,2], [null,null],
    [2,2], [1,1], [3,4], [null,null], [null,null],
  ])
  assert.equal(neutralCards.find(c => c.id === 'C004').region[0], 'ナド・クライ')
  assert.equal(neutralCards.find(c => c.id === 'C008').traits[0], 'ヒルチャール')
})

test('無元素カードの説明には確定した能力を保持し未実装を明示', async () => {
  const { neutralCards } = await vite.ssrLoadModule('/src/data/cards/neutral.ts')
  for (const card of neutralCards) {
    assert.equal(card.element, 'none')
    assert.ok(card.description.length > 0)
    assert.equal(card.implementationStatus, 'playable')
  }
  assert.match(neutralCards[2].description, /守護/)
  assert.match(neutralCards[3].description, /ラストワード/)
  assert.match(neutralCards[6].description, /ハト/)
  assert.match(neutralCards[7].description, /突進/)
  assert.match(neutralCards[8].description, /最大PP/)
  assert.match(neutralCards[9].description, /カウントダウン7/)
})

test('無元素・炎・水の登録数は100/115で残り15枚', async () => {
  const { productionCards } = await vite.ssrLoadModule('/src/data/productionCards.ts')
  const { validateProductionCards } = await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const report = validateProductionCards(productionCards)
  assert.deepEqual(report.errors, [])
  assert.equal(report.total, 115)
  assert.equal(report.plannedTotal, 115)
  assert.equal(report.slots.reduce((n,s) => n + s.remaining,0),0)
  assert.equal(report.slots.filter(s => s.element === 'none').every(s => s.remaining === 0),true)
  assert.equal(report.ready,true)
})

test('正式無元素カード10枚はデッキに入りフォロワーとスペルをプレイ可能', async () => {
  const { getCard, getDeckCardPool } = await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  assert.equal(getCard('C001').name,'ヒルチャール')
  assert.equal(getCard('C010').type,'spell')
  assert.equal(getDeckCardPool().filter(c => /^C00[1-9]$|^C010$/.test(c.id)).length,10)
  const state = startedGame()
  state.players[0].hand = ['C001', 'C005']
  state.players[0].pp = 10
  assert.equal(engine.canPlayCard(state,0),true)
  assert.equal(engine.canPlayCard(state,1),true)
})

test('C001 ヒルチャール：PP1で1/2が登場し能力なし', () => {
  const state = startedGame()
  state.players[0].pp = 1
  state.players[0].hand = ['C001']
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[0].pp, 0)
  assert.equal(next.players[0].field[0].cardId, 'C001')
  assert.equal(next.players[0].field[0].attack, 1)
  assert.equal(next.players[0].field[0].health, 2)
})

test('C002 宝盗団：デッキのブロンズを1枚検索して手札へ加える', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['C002']
  state.players[0].deck = ['C003', 'C006', 'C001']
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[0].hand.length, 1)
  assert.ok(['C001', 'C003'].includes(next.players[0].hand[0]))
  assert.equal(next.players[0].deck.length, 2)
  assert.equal(next.players[0].field[0].cardId, 'C002')
})

test('C002 宝盗団：デッキにブロンズがなければ検索は不発', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['C002']
  state.players[0].deck = ['C006']
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[0].hand.length, 0)
  assert.deepEqual(next.players[0].deck, ['C006'])
})

test('C003 遺跡守衛：守護がいると敵リーダーや非守護への攻撃を禁止', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'C001', 3, 5)
  const guard = place(state, 1, 'C003', 1, 8)
  guard.keywords = ['guard']
  const ordinary = place(state, 1, 'C001', 1, 5)
  assert.equal(engine.attackLeader(state, attacker.instanceId), state)
  assert.equal(engine.attackFollower(state, attacker.instanceId, ordinary.instanceId), state)
  const next = engine.attackFollower(state, attacker.instanceId, guard.instanceId)
  assert.equal(next.players[1].field[0].health, 5)
})

test('C004 ワイルドハント：登場時に同名を召喚し分身はファンファーレを連鎖しない', () => {
  const state = startedGame()
  state.players[0].pp = 4
  state.players[0].hand = ['C004']
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[0].field.length, 2)
  assert.deepEqual(next.players[0].field.map(f => f.cardId), ['C004', 'C004'])
  assert.ok(next.players[0].field[1].keywords.includes('no_last_word'))
})

test('C004 ワイルドハント：本体の破壊で分身を召喚、分身はラストワード無し', () => {
  const state = startedGame()
  const main = place(state, 0, 'C004', 2, 1)
  const opponent = place(state, 1, 'C001', 2, 8)
  let next = engine.attackFollower(state, main.instanceId, opponent.instanceId)
  assert.equal(next.players[0].field.length, 1)
  assert.equal(next.players[0].field[0].cardId, 'C004')
  assert.ok(next.players[0].field[0].keywords.includes('no_last_word'))
  // 分身が次に破壊されても再召喚しない
  const copy = next.players[0].field[0]
  next.players[0].field[0] = {...copy, canAttack:true}
  next = engine.attackFollower(next, copy.instanceId, opponent.instanceId)
  assert.equal(next.players[0].field.length, 0)
})

test('C005 ヒルチャール強襲：スペルはフィールドを消費せず最大4体召喚', () => {
  const state = startedGame()
  state.players[0].pp = 4
  state.players[0].hand = ['C005']
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[0].pp, 0)
  assert.equal(next.players[0].field.length, 4)
  assert.ok(next.players[0].field.every(f=>f.cardId==='C001'))
  assert.deepEqual(next.players[0].graveyard, ['C005'])
})

test('C005 ヒルチャール強襲：既存3体なら残り2枠のみ召喚', () => {
  const state = startedGame()
  state.players[0].pp = 4
  state.players[0].hand = ['C005']
  for(let i=0;i<3;i++) place(state,0,'C001',1,2)
  const next = engine.playCard(state,'player1',0)
  assert.equal(next.players[0].field.length,5)
  assert.equal(next.players[0].field.filter(f=>f.cardId==='C001').length,5)
})

test('C006 エラ・マスク：味方ヒルチャール全員に永続+1/+1', () => {
  const state = startedGame()
  state.players[0].pp = 3
  state.players[0].hand = ['C006']
  const a = place(state,0,'C001',1,2)
  place(state,0,'C003',4,6)
  const next = engine.playCard(state,'player1',0)
  assert.equal(next.players[0].field[0].instanceId,a.instanceId)
  assert.deepEqual([next.players[0].field[0].attack,next.players[0].field[0].health],[2,3])
  assert.deepEqual([next.players[0].field[1].attack,next.players[0].field[1].health],[4,6])
})

test('C007 ティミー：ハト2体は1/1疾走で召喚ターンから攻撃可能', () => {
  const state = startedGame()
  state.players[0].pp = 3
  state.players[0].hand = ['C007']
  const next = engine.playCard(state,'player1',0)
  assert.equal(next.players[0].field.length,3)
  const doves=next.players[0].field.filter(f=>f.cardId==='neutral-dove')
  assert.equal(doves.length,2)
  assert.ok(doves.every(f=>f.attack===1&&f.health===1&&f.canAttack&&f.keywords.includes('storm')))
  const after = engine.attackLeader(next,doves[0].instanceId)
  assert.equal(after.players[1].leaderHealth,19)
})

test('C007 ティミー：ハトがいないターン終了時に自身を+1/+1', () => {
  const state=startedGame()
  const timmy=place(state,0,'C007',1,1)
  const next=engine.endTurn(state)
  const result=next.players[0].field.find(f=>f.instanceId===timmy.instanceId)
  assert.equal(result.attack,2)
  assert.equal(result.health,2)
})

test('C008 ヒルチャール暴徒：突進は登場ターンに敵フォロワーのみ攻撃可能', () => {
  const state=startedGame()
  state.players[0].pp=4
  state.players[0].hand=['C008']
  const enemy=place(state,1,'C001',1,8)
  const summoned=engine.playCard(state,'player1',0)
  const attacker=summoned.players[0].field[0]
  assert.equal(engine.attackLeader(summoned,attacker.instanceId),summoned)
  assert.equal(engine.canFollowerAttack(attacker),true)
  const next=engine.attackFollower(summoned,attacker.instanceId,enemy.instanceId)
  assert.equal(next.players[1].field[0].health,5)
})

test('C008 ヒルチャール暴徒：味方ヒルチャールがいる攻撃時に+1攻撃', () => {
  const state=startedGame()
  const attacker=place(state,0,'C008',3,4)
  place(state,0,'C001',1,2)
  const enemy=place(state,1,'C001',1,8)
  const next=engine.attackFollower(state,attacker.instanceId,enemy.instanceId)
  assert.equal(next.players[0].field[0].attack,4)
  assert.equal(next.players[1].field[0].health,4)
})

test('C009 パイモンのへそくり：ドロー1＋最大PP+1、現PPは回復しない', () => {
  const state=startedGame()
  state.players[0].maxPp=5
  state.players[0].pp=4
  state.players[0].hand=['C009']
  state.players[0].deck=['C001','C003']
  const next=engine.playCard(state,'player1',0)
  assert.equal(next.players[0].maxPp,6)
  assert.equal(next.players[0].pp,1)
  assert.deepEqual(next.players[0].hand,['C001'])
  assert.deepEqual(next.players[0].deck,['C003'])
})

test('C009 パイモンのへそくり：空デッキからのドローは即敗北', () => {
  const state=startedGame()
  state.players[0].pp=3
  state.players[0].hand=['C009']
  state.players[0].deck=[]
  const next=engine.playCard(state,'player1',0)
  assert.equal(next.winnerId,'player2')
})

test('C010 第四降臨者の力：EN+3で最大5、カウントダウン7付与', () => {
  const state=startedGame()
  state.players[0].pp=5
  state.players[0].energy=4
  state.players[0].hand=['C010']
  const next=engine.playCard(state,'player1',0)
  assert.equal(next.players[0].energy,5)
  assert.equal(next.players[0].crests[0].turnsRemaining,7)
  assert.deepEqual(next.players[0].crests[0].usedElements,[])
})

test('C010 第四降臨者の力：7回の自ターン終了で7属性が重複せずリーダー7ダメ', () => {
  let state=startedGame()
  state.players[0].pp=5
  state.players[0].hand=['C010']
  state=engine.playCard(state,'player1',0)
  for(let i=0;i<13;i++) state=engine.endTurn(state)
  assert.equal(state.players[1].leaderHealth,13)
  assert.deepEqual(state.players[0].crests,[])
})

test('正式炎カードC011-C025は15枚・B4/S4/G4/L3で原本の名前とコストを保持', async () => {
  const { pyroCards } = await vite.ssrLoadModule('/src/data/cards/pyro.ts')
  assert.deepEqual(pyroCards.map(c => c.id),
    Array.from({length:15}, (_, i)=>'C'+String(11+i).padStart(3,'0')))
  assert.deepEqual(pyroCards.map(c=>c.name), [
    '炎スライム','ヒルチャール射手・炎','ドドコ','アビスの魔術師・炎',
    '旋火輪','素晴らしい旅','ファデュイ・デットエージェント・炎','双界の炎',
    '偵察騎士・アンバー','万民百味・香菱','ペニー冒険団・ベネット',
    '特巡隊隊長・シュヴルーズ','闇夜の英雄・ディルック',
    '幻惑のトリック・リネ','往生堂堂主・胡桃',
  ])
  assert.deepEqual(pyroCards.map(c=>c.cost), [1,2,2,3,4,3,4,4,3,3,3,4,5,4,4])
  assert.deepEqual(pyroCards.map(c=>c.rarity), [
    ...Array(4).fill('bronze'),...Array(4).fill('silver'),
    ...Array(4).fill('gold'),...Array(3).fill('legendary')
  ])
  assert.ok(pyroCards.every(c=>c.element==='pyro'))
})

test('炎元素15枚に水15枚を加え正式カードは100/115、残り15枚', async () => {
  const { productionCards }=await vite.ssrLoadModule('/src/data/productionCards.ts')
  const { validateProductionCards }=await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const result=validateProductionCards(productionCards)
  assert.equal(result.total,115)
  assert.equal(result.slots.filter(s=>s.element==='pyro').reduce((n,s)=>n+s.remaining,0),0)
  assert.equal(result.slots.reduce((n,s)=>n+s.remaining,0),0)
  assert.deepEqual(result.errors,[])
})

test('炎元素15枚は原本どおり種類・地域・二つ名・効果説明を保持', async () => {
  const { pyroCards }=await vite.ssrLoadModule('/src/data/cards/pyro.ts')
  assert.deepEqual(pyroCards.map(c=>c.type),[
    'follower','follower','follower','follower',
    'spell','amulet','follower','spell',
    'follower','follower','follower','follower',
    'follower','follower','follower',
  ])
  assert.deepEqual(pyroCards.filter(c=>c.type==='follower').map(c=>[c.attack,c.health]),[
    [2,2],[2,2],[1,2],[2,2],[3,2],
    [2,3],[2,3],[2,4],[3,4],[4,5],[2,3],[3,4],
  ])
  assert.equal(pyroCards.find(c=>c.id==='C023').description.includes('1ターン最大3回'),true)
  assert.equal(pyroCards.find(c=>c.id==='C024').traits[0],'ファデュイ')
  assert.equal(pyroCards.find(c=>c.id==='C025').region[0],'璃月')
})

test('炎元素は全15枚対戦可能、専用トークンはデッキに含まれない', async () => {
  const { pyroCards }=await vite.ssrLoadModule('/src/data/cards/pyro.ts')
  const { getDeckCardPool }=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  assert.deepEqual(pyroCards.filter(c=>c.implementationStatus==='playable').map(c=>c.id),
    ['C011','C012','C013','C014','C015','C016','C017','C018','C019','C020','C021','C022','C023','C024','C025'])
  const pool=getDeckCardPool().map(c=>c.id)
  for(const c of pyroCards) assert.equal(pool.includes(c.id), c.implementationStatus==='playable')
  const state=startedGame()
  state.players[0].pp=10
  state.players[0].hand=['C023']
  assert.equal(engine.canPlayCard(state,0),true)
})

test('C011 炎スライムは登場時に炎元素が常時付着する', () => {
  const state=startedGame()
  state.players[0].pp=1
  state.players[0].hand=['C011']
  const next=engine.playCard(state,'player1',0)
  assert.equal(next.players[0].field[0].cardId,'C011')
  assert.deepEqual(next.players[0].field[0].aura,[{element:'pyro'}])
})

test('C012 炎射手はファンファーレで対象1体に炎1ダメージと付着', () => {
  const state=startedGame()
  state.players[0].pp=2
  state.players[0].hand=['C012']
  const target=place(state,1,'C001',1,5)
  const next=engine.playCard(state,'player1',0,target.instanceId)
  assert.equal(next.players[1].field[0].health,4)
  assert.deepEqual(next.players[1].field[0].aura,[{element:'pyro'}])
})

test('C012 炎射手は対象不在やオーラのみでも本体をプレイできる', () => {
  const state=startedGame()
  state.players[0].pp=2
  state.players[0].hand=['C012']
  assert.equal(engine.canPlayCard(state,0),true)
  const noTarget=engine.playCard(state,'player1',0)
  assert.deepEqual(noTarget.players[0].field.map(f=>f.cardId),['C012'])
  assert.equal(noTarget.players[0].pp,0)
  const withAura=startedGame()
  withAura.players[0].pp=2
  withAura.players[0].hand=['C012']
  const target=place(withAura,1,'C001',1,5)
  target.keywords=['aura']
  assert.equal(engine.canPlayCard(withAura,0),true)
  assert.equal(engine.playCard(withAura,'player1',0,target.instanceId),withAura)
  const next=engine.playCard(withAura,'player1',0)
  assert.equal(next.players[0].field[0].cardId,'C012')
  assert.equal(next.players[1].field[0].health,5)
})

test('C013 ドドコは破壊時にランダムな敵1体に炎2ダメージ', () => {
  const state=startedGame()
  const dodoco=place(state,0,'C013',1,1)
  const enemy=place(state,1,'C001',2,7)
  const next=engine.attackFollower(state,dodoco.instanceId,enemy.instanceId)
  assert.equal(next.players[0].field.length,0)
  assert.equal(next.players[1].field[0].health,4)
  assert.deepEqual(next.players[1].field[0].aura,[{element:'pyro'}])
})

test('C013 ドドコのラストワードは敵フォロワーがいなければ不発', () => {
  const state=startedGame()
  const dodoco=place(state,0,'C013',1,1)
  dodoco.health=0
  // ターン終了処理は通常の破壊処理を呼ぶ
  const next=engine.endTurn(state)
  assert.equal(next.players[1].leaderHealth,20)
})

test('C014 炎アビスの魔術師は登場時通常シールド3・通常攻撃は炎', () => {
  const state=startedGame()
  state.players[0].pp=3
  state.players[0].hand=['C014']
  const next=engine.playCard(state,'player1',0)
  assert.equal(next.players[0].field[0].shield.normal,3)
  assert.equal(engine.getCard('C014').normalAttackElement,'pyro')
})

test('C015 旋火輪：全敵フォロワーに炎1ダメージ、クレスト2ターンを付与', () => {
  const state = startedGame()
  state.players[0].hand = ['C015']
  state.players[0].pp = 4
  const a = place(state, 1, 'C001', 1, 6)
  const b = place(state, 1, 'C001', 1, 4)
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[0].pp, 0)
  assert.deepEqual(next.players[0].graveyard, ['C015'])
  assert.equal(next.players[1].field.find(f => f.instanceId === a.instanceId).health, 5)
  assert.equal(next.players[1].field.find(f => f.instanceId === b.instanceId).health, 3)
  assert.deepEqual(next.players[1].field[0].aura, [{ element: 'pyro' }])
  assert.equal(next.players[0].crests[0].id, 'C015')
  assert.equal(next.players[0].crests[0].turnsRemaining, 2)
})

test('C015 旋火輪：全体ダメージは蒸発反応とシールド吸収に対応', () => {
  const state = startedGame()
  state.players[0].hand = ['C015']
  state.players[0].pp = 4
  const hydro = place(state, 1, 'C001', 1, 8)
  hydro.aura = [{ element: 'hydro' }]
  const shielded = place(state, 1, 'C001', 1, 5)
  shielded.shield = { normal: 2, crystallize: 0 }
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[1].field[0].health, 5)
  assert.equal(next.players[1].field[0].aura.length, 0)
  assert.equal(next.players[1].field[1].health, 5)
  assert.equal(next.players[1].field[1].shield.normal, 1)
})

test('C015 旋火輪：自分のターン終了時に敵全体とリーダーへ炎1を2回発動', () => {
  let state = startedGame()
  state.players[0].hand = ['C015']
  state.players[0].pp = 4
  place(state, 1, 'C001', 1, 10)
  state = engine.playCard(state, 'player1', 0)
  state = engine.endTurn(state)
  assert.equal(state.players[1].leaderHealth, 19)
  assert.equal(state.players[1].field[0].health, 8)
  assert.equal(state.players[0].crests[0].turnsRemaining, 1)
  state = engine.endTurn(state)
  state = engine.endTurn(state)
  assert.equal(state.players[1].leaderHealth, 18)
  assert.equal(state.players[1].field[0].health, 7)
  assert.deepEqual(state.players[0].crests, [])
})

test('C015 と C010 のクレストは別処理で発動する', () => {
  const state = startedGame()
  state.players[0].hand = ['C015']
  state.players[0].pp = 4
  state.players[0].crests = [{
    id: 'C010', turnsRemaining: 7, usedElements: [],
  }]
  const played = engine.playCard(state, 'player1', 0)
  const next = engine.endTurn(played)
  assert.equal(next.players[1].leaderHealth, 18)
  assert.equal(next.players[0].crests.find(c => c.id === 'C010').turnsRemaining, 6)
  assert.equal(next.players[0].crests.find(c => c.id === 'C015').turnsRemaining, 1)
})

test('C016 素晴らしい旅：アミュレットとして場を使いターン終了時にHP2回復＋攻撃1', () => {
  let state = startedGame()
  state.players[0].hand = ['C016']
  state.players[0].pp = 3
  state.players[0].leaderHealth = 15
  place(state, 0, 'C001', 2, 4)
  state = engine.playCard(state, 'player1', 0)
  assert.equal(state.players[0].field.length, 1)
  assert.equal(state.players[0].amulets.length, 1)
  assert.equal(state.players[0].amulets[0].turnsRemaining, 3)
  assert.equal(state.players[0].graveyard.includes('C016'), false)
  state = engine.endTurn(state)
  assert.equal(state.players[0].leaderHealth, 17)
  assert.equal(state.players[0].field[0].attack, 3)
  assert.equal(state.players[0].amulets[0].turnsRemaining, 2)
})

test('C016 素晴らしい旅：カウントダウン3で消滅し墓場には送らない', () => {
  let state = startedGame()
  state.players[0].hand = ['C016']
  state.players[0].pp = 3
  state = engine.playCard(state, 'player1', 0)
  for(let i = 0; i < 5; i++) state = engine.endTurn(state)
  assert.equal(state.players[0].amulets.length, 0)
  assert.equal(state.players[0].leaderHealth, 20)
})

test('C016 素晴らしい旅：フィールド合計5枠なら新規アミュレット不可', () => {
  const state = startedGame()
  state.players[0].hand = ['C016']
  state.players[0].pp = 3
  for(let i = 0; i < 5; i++) place(state, 0, 'C001', 1, 2)
  assert.equal(engine.canPlayCard(state, 0), false)
  assert.equal(engine.playCard(state, 'player1', 0), state)
})

test('C017 デットエージェント：潜伏と炎通常攻撃を所持し対象指定を回避', () => {
  const state = startedGame()
  state.players[0].hand = ['C017']
  state.players[0].pp = 4
  const agentState = engine.playCard(state, 'player1', 0)
  const agent = agentState.players[0].field[0]
  assert.ok(agent.keywords.includes('stealth'))
  assert.equal(engine.getCard('C017').normalAttackElement, 'pyro')
  const enemyAttacker = place(agentState, 1, 'C001', 3, 5)
  const enemyTurn = { ...agentState, currentPlayerId: 'player2' }
  assert.equal(engine.attackFollower(enemyTurn, enemyAttacker.instanceId, agent.instanceId), enemyTurn)
})

test('C017 デットエージェント：通常攻撃で潜伏解除、他のファデュイがいれば再潜伏', () => {
  const state = startedGame()
  const agent = place(state, 0, 'C017', 3, 5)
  agent.keywords = ['stealth']
  const enemy = place(state, 1, 'C001', 0, 10)
  let next = engine.attackFollower(state, agent.instanceId, enemy.instanceId)
  assert.equal(next.players[0].field[0].keywords.includes('stealth'), false)
  const withFatui = startedGame()
  const agent2 = place(withFatui, 0, 'C017', 3, 5)
  agent2.keywords = ['stealth']
  place(withFatui, 0, 'C017', 3, 2)
  const enemy2 = place(withFatui, 1, 'C001', 0, 10)
  next = engine.attackFollower(withFatui, agent2.instanceId, enemy2.instanceId)
  assert.equal(next.players[0].field[0].keywords.includes('stealth'), true)
})

test('C018 双界の炎：指定した敵をシールド無視で破壊し両リーダーへ2ダメージ', () => {
  const state = startedGame()
  state.players[0].hand = ['C018']
  state.players[0].pp = 4
  const enemy = place(state, 1, 'C003', 4, 9)
  enemy.keywords = ['guard']
  enemy.shield = { normal: 10, crystallize: 10 }
  const next = engine.playCard(state, 'player1', 0, enemy.instanceId)
  assert.equal(next.players[1].field.length, 0)
  assert.deepEqual(next.players[1].graveyard, ['C003'])
  assert.equal(next.players[0].leaderHealth, 18)
  assert.equal(next.players[1].leaderHealth, 18)
  assert.deepEqual(next.players[0].graveyard, ['C018'])
})

test('C018 双界の炎：対象無し・潜伏・オーラには使用不可', () => {
  const state = startedGame()
  state.players[0].hand = ['C018']
  state.players[0].pp = 4
  assert.equal(engine.canPlayCard(state, 0), false)
  const hidden = place(state, 1, 'C017', 3, 4)
  hidden.keywords = ['stealth']
  assert.equal(engine.canPlayCard(state, 0), false)
  assert.equal(engine.playCard(state, 'player1', 0, hidden.instanceId), state)
  const ordinary = place(state, 1, 'C001', 1, 2)
  assert.equal(engine.canPlayCard(state, 0), true)
  assert.equal(engine.playCard(state, 'player1', 0, hidden.instanceId), state)
  const next = engine.playCard(state, 'player1', 0, ordinary.instanceId)
  assert.equal(next.players[1].field.some(f => f.instanceId === hidden.instanceId), true)
  assert.equal(next.players[0].leaderHealth, 18)
})

test('共通召喚はアミュレットも含めた場の5枠上限を守る', () => {
  let state = startedGame()
  state.players[0].hand = ['C016', 'C005']
  state.players[0].pp = 10
  state = engine.playCard(state, 'player1', 0)
  assert.equal(state.players[0].amulets.length, 1)
  state = engine.playCard(state, 'player1', 0)
  assert.equal(state.players[0].field.length, 4)
  assert.equal(state.players[0].field.length + state.players[0].amulets.length, 5)
})

test('STEP28 炎ゴールド4枚は対戦対応、PP消費型スキルと原本の能力文を保持', async () => {
  const { pyroCards } = await vite.ssrLoadModule('/src/data/cards/pyro.ts')
  const cards = pyroCards.filter(c => Number(c.id.slice(1)) >= 19 && Number(c.id.slice(1)) <= 22)
  assert.deepEqual(cards.map(c => c.name), [
    '偵察騎士・アンバー', '万民百味・香菱',
    'ペニー冒険団・ベネット', '特巡隊隊長・シュヴルーズ',
  ])
  assert.deepEqual(cards.map(c => c.implementationStatus), Array(4).fill('playable'))
  assert.deepEqual(cards.map(c => c.elementalSkill.ppCost), [1, 2, 1, 1])
  assert.deepEqual(cards.map(c => c.elementalSkill.name), [
    '爆弾人形', 'グゥオパァー出撃', '溢れる情熱', '近迫阻止射撃・速',
  ])
})

test('専用トークン：ウサギ伯爵とグゥオパァーの原本ステータスとデッキ除外', async () => {
  const { productionTokens } = await vite.ssrLoadModule('/src/data/productionTokens.ts')
  const { getDeckCardPool, getCard } = await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  assert.deepEqual(productionTokens.map(t => [t.name,t.cost,t.attack,t.health]), [
    ['ハト', 1, 1, 1],
    ['ウサギ伯爵', 1, 0, 3], ['グゥオパァー', 2, 1, 3],
    ['ファニーハット・キャット', 5, 5, 5],
    ['水圧装置', 1, undefined, undefined],
    ['虚影', 1, 0, 2],
    ['化海月', 2, 0, 4],
    ['氷蛍', 1, 1, 1],
    ['氷蓮', 1, 0, 3],
    ['イツパパ', 2, 1, 3],
    ['雷蛍', 1, 1, 1],
    ['オズ', 3, 3, 3],
    ['殺生櫻', 1, undefined, undefined],
    ['ビックラキャット・ボックス', 3, 0, 8],
    ['璇璣屏', 2, undefined, undefined],
    ['ぐるぐるコマちゃん', 2, undefined, undefined],
    ['陽華', 2, undefined, undefined],
    ['たもと', 2, 1, 3],
    ['月桂・跳躍型', 2, 0, 3],
    ['コレアンバー', 0, undefined, undefined],
    ['草霊', 2, 2, 2],
    ['月桂・投擲型', 2, 0, 3],
    ['ルミドゥースの瓶', 2, undefined, undefined],
    ['草原核', 0, 0, 1],
  ])
  for(const card of productionTokens) {
    assert.equal(card.token, true)
    assert.equal(getCard(card.id).name, card.name)
    assert.equal(getDeckCardPool().some(c => c.id === card.id), false)
  }
  assert.deepEqual(productionTokens.find(t => t.id === 'token-baron-bunny').keywords, ['guard', 'damage_cap_1'])
})

test('C019 アンバー：ファンファーレで敵1体へ炎2ダメージと付着', () => {
  const state = startedGame()
  state.players[0].hand = ['C019']
  state.players[0].pp = 3
  const enemy = place(state, 1, 'C001', 1, 6)
  const next = engine.playCard(state, 'player1', 0, enemy.instanceId)
  assert.equal(next.players[0].field[0].cardId, 'C019')
  assert.equal(next.players[1].field[0].health, 4)
  assert.deepEqual(next.players[1].field[0].aura, [{ element: 'pyro' }])
  assert.equal(next.players[0].pp, 0)
})

test('C019 アンバー：スキルPP1とEN+1でウサギ伯爵を召喚し1ターン1回', () => {
  const state = startedGame()
  state.players[0].hand = ['C019']
  state.players[0].pp = 4
  const enemy = place(state, 1, 'C001', 1, 8)
  let next = engine.playCard(state, 'player1', 0, enemy.instanceId)
  const amber = next.players[0].field[0]
  assert.equal(engine.canUseAbility(next, amber.instanceId, 'skill'), true)
  next = engine.activateAbility(next, amber.instanceId, 'skill')
  assert.equal(next.players[0].pp, 0)
  assert.equal(next.players[0].energy, 1)
  assert.deepEqual(next.players[0].field.map(f => f.cardId), ['C019', 'token-baron-bunny'])
  assert.equal(next.players[0].field[1].health, 3)
  assert.ok(next.players[0].field[1].keywords.includes('guard'))
  assert.equal(engine.canUseAbility(next, amber.instanceId, 'skill'), false)
})

test('ウサギ伯爵：2以上の被ダメージを1にし守護が機能する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const rabbit = place(state, 1, 'token-baron-bunny', 0, 3)
  rabbit.keywords = ['guard', 'damage_cap_1']
  const ally = place(state, 1, 'C001', 1, 2)
  const enemy = place(state, 0, 'C001', 4, 4)
  assert.equal(resolveElementalDamage(rabbit, 6, 'pyro').follower.health, 2)
  assert.equal(engine.attackLeader(state, enemy.instanceId), state)
  assert.equal(engine.attackFollower(state, enemy.instanceId, ally.instanceId), state)
  const next = engine.attackFollower(state, enemy.instanceId, rabbit.instanceId)
  assert.equal(next.players[1].field[0].health, 2)
})

test('ウサギ伯爵：破壊時に敵全体と相手リーダーに炎1ダメージ', () => {
  const state = startedGame()
  const rabbit = place(state, 0, 'token-baron-bunny', 0, 1)
  rabbit.keywords = ['guard', 'damage_cap_1']
  const attacker = place(state, 1, 'C001', 3, 5)
  const other = place(state, 1, 'C001', 1, 4)
  const enemyTurn = {...state, currentPlayerId: 'player2'}
  const next = engine.attackFollower(enemyTurn, attacker.instanceId, rabbit.instanceId)
  assert.equal(next.players[0].field.length, 0)
  assert.ok(next.players[0].graveyard.includes('token-baron-bunny'))
  assert.equal(next.players[1].leaderHealth, 19)
  assert.equal(next.players[1].field.find(f=>f.instanceId===attacker.instanceId).health, 4)
  assert.equal(next.players[1].field.find(f=>f.instanceId===other.instanceId).health, 3)
  assert.deepEqual(next.players[1].field[1].aura,[{element:'pyro'}])
})

test('C020 香菱：スキルPP2・EN+1でグゥオパァー召喚', () => {
  const state = startedGame()
  state.players[0].hand = ['C020']
  state.players[0].pp = 5
  let next = engine.playCard(state, 'player1', 0)
  const xiangling = next.players[0].field[0]
  next = engine.activateAbility(next, xiangling.instanceId, 'skill')
  assert.equal(next.players[0].pp, 0)
  assert.equal(next.players[0].energy, 1)
  assert.deepEqual(next.players[0].field.map(f=>f.cardId), ['C020', 'token-guoba'])
  assert.deepEqual([next.players[0].field[1].attack, next.players[0].field[1].health], [1,3])
})

test('C020 香菱：グゥオパァーがいる自ターン終了時に自身+1/+1', () => {
  const state = startedGame()
  const xiangling = place(state, 0, 'C020', 2, 3)
  place(state, 0, 'token-guoba', 1, 3)
  const next = engine.endTurn(state)
  const now = next.players[0].field.find(f=>f.instanceId===xiangling.instanceId)
  assert.deepEqual([now.attack, now.health, now.maxHealth],[3,4,4])
  assert.equal(next.players[1].leaderHealth, 16)
})

test('グゥオパァー：敵フォロワーがいなければ毎自ターン終了でリーダーへ炎2を2回', () => {
  let state = startedGame()
  place(state, 0, 'token-guoba', 1, 3)
  state = engine.endTurn(state)
  assert.equal(state.players[1].leaderHealth, 16)
  state = engine.endTurn(state)
  state = engine.endTurn(state)
  assert.equal(state.players[1].leaderHealth, 12)
})

test('C021 ベネット：召喚時は味方一体か自身を指定して攻撃力+1', () => {
  let state = startedGame()
  state.players[0].hand = ['C021']
  state.players[0].pp = 3
  assert.equal(engine.needsFriendlyPlayTarget(engine.getCard('C021')), true)
  assert.equal(engine.playCard(state, 'player1', 0), state)
  state = engine.playCard(state, 'player1', 0, 'self')
  assert.equal(state.players[0].field[0].attack, 3)
  const withAlly = startedGame()
  withAlly.players[0].hand = ['C021']
  withAlly.players[0].pp = 3
  const ally = place(withAlly, 0, 'C001', 1, 2)
  const next = engine.playCard(withAlly, 'player1', 0, ally.instanceId)
  assert.equal(next.players[0].field[0].attack, 2)
  assert.equal(next.players[0].field[1].attack, 2)
})

test('C021 ベネット：スキルPP1で敵に炎4・自身に物理1、EN+1', () => {
  const state = startedGame()
  const bennett = place(state, 0, 'C021', 2, 4)
  const target = place(state, 1, 'C001', 1, 8)
  state.players[0].pp = 1
  const next = engine.activateAbility(state, bennett.instanceId, 'skill', target.instanceId)
  assert.equal(next.players[0].pp, 0)
  assert.equal(next.players[0].energy, 1)
  assert.equal(next.players[0].field[0].health, 3)
  assert.equal(next.players[1].field[0].health, 4)
  assert.deepEqual(next.players[1].field[0].aura,[{element:'pyro'}])
  assert.equal(next.players[0].field[0].skillUsed, true)
})

test('PP不足では元素スキルを使えずターン中の制限も変わらない', () => {
  const state = startedGame()
  const amber = place(state, 0, 'C019', 2, 3)
  state.players[0].pp = 0
  assert.equal(engine.canUseAbility(state, amber.instanceId, 'skill'), false)
  assert.equal(engine.activateAbility(state, amber.instanceId, 'skill'), state)
  assert.equal(state.players[0].field[0].skillUsed, false)
  assert.equal(state.players[0].energy, 0)
})

test('C022 シュヴルーズ：スキルPP1・炎2と自リーダーHP2回復・EN+1', () => {
  const state = startedGame()
  const cheval = place(state, 0, 'C022', 3, 4)
  const enemy = place(state, 1, 'C001', 1, 8)
  state.players[0].pp = 1
  state.players[0].leaderHealth = 16
  const next = engine.activateAbility(state, cheval.instanceId, 'skill', enemy.instanceId)
  assert.equal(next.players[0].pp, 0)
  assert.equal(next.players[0].energy, 1)
  assert.equal(next.players[1].field[0].health, 6)
  assert.equal(next.players[0].leaderHealth, 18)
  assert.equal(next.players[0].field[0].skillUsed, true)
})

test('C022 シュヴルーズ：過負荷を起こすたびに自陣全員の攻撃力+1', () => {
  const state = startedGame()
  const cheval = place(state, 0, 'C022', 3, 4)
  const ally = place(state, 0, 'C001', 1, 4)
  const enemy = place(state, 1, 'C001', 1, 8)
  enemy.aura = [{element:'electro'}]
  state.players[0].pp = 1
  const next = engine.activateAbility(state, cheval.instanceId, 'skill', enemy.instanceId)
  assert.equal(next.players[0].field.find(f=>f.instanceId===cheval.instanceId).attack, 4)
  assert.equal(next.players[0].field.find(f=>f.instanceId===ally.instanceId).attack, 2)
  assert.equal(next.players[1].field.length, 0)
  assert.equal(next.players[1].hand.at(-1), 'C001')
})

test('C022 シュヴルーズ：2体いれば過負荷1回につき+2攻撃力', async () => {
  const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  place(state, 0, 'C022', 3, 4)
  place(state, 0, 'C022', 3, 4)
  const ally = place(state, 0, 'C001', 1, 4)
  const enemy = place(state, 1, 'C001', 1, 6)
  const next = resolveReactionConsequence(state, 1, enemy.instanceId, 'overloaded', 'electro', 0)
  assert.equal(next.players[0].field[0].attack, 5)
  assert.equal(next.players[0].field[1].attack, 5)
  assert.equal(next.players[0].field.find(f=>f.instanceId===ally.instanceId).attack, 3)
})

test('相手のターン中に生じた過負荷ではシュヴルーズのバフは発生しない', async () => {
  const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const cheval = place(state, 0, 'C022', 3, 4)
  const enemy = place(state, 1, 'C001', 1, 6)
  state.currentPlayerId = 'player2'
  const next = resolveReactionConsequence(state, 1, enemy.instanceId, 'overloaded', 'electro', 0)
  assert.equal(next.players[0].field.find(f=>f.instanceId===cheval.instanceId).attack, 3)
})

test('召喚系スキルは場5枠が埋まっていると発動不可・PPやENを消費しない', () => {
  const state = startedGame()
  const amber = place(state, 0, 'C019', 2, 3)
  for(let i=0;i<4;i++) place(state, 0, 'C001', 1, 2)
  state.players[0].pp = 5
  assert.equal(engine.canUseAbility(state, amber.instanceId, 'skill'), false)
  assert.equal(engine.activateAbility(state, amber.instanceId, 'skill'), state)
  assert.equal(state.players[0].pp, 5)
  assert.equal(state.players[0].energy, 0)
})

test('カード検証：元素スキルのPPコストは0以上の整数のみ', async () => {
  const { validateProductionCards } = await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const card = engine.getCard('C019')
  assert.deepEqual(validateProductionCards([card]).errors, [])
  for (const invalid of [-1, 0.5, NaN]) {
    const bad = { ...card, elementalSkill: { ...card.elementalSkill, ppCost: invalid } }
    assert.ok(validateProductionCards([bad]).errors.some(e => e.includes('元素スキル')))
  }
})

test('STEP29 炎レジェンド3枚のスキル・爆発とPP/ENが原本どおり', async () => {
  const { pyroCards } = await vite.ssrLoadModule('/src/data/cards/pyro.ts')
  const legends = pyroCards.filter(c => c.rarity === 'legendary')
  assert.deepEqual(legends.map(c => c.id), ['C023','C024','C025'])
  assert.deepEqual(legends.map(c => c.implementationStatus), ['playable','playable','playable'])
  assert.deepEqual(legends.map(c => c.elementalSkill.ppCost), [1,1,1])
  assert.deepEqual(legends.map(c => c.elementalBurst.energyCost), [3,2,3])
  assert.deepEqual(legends.map(c => [c.cost,c.attack,c.health]), [[5,4,5],[4,2,3],[4,3,4]])
  assert.deepEqual(legends.map(c => c.elementalSkill.name),
    ['逆焔の刃','ビウィルダー・ライト','蝶導来世'])
  assert.deepEqual(legends.map(c => c.elementalBurst.name),
    ['黎明','大魔術・ミラクルパレード','安神秘法'])
})

test('C023 ディルック：スキル1/2/3回目は炎3/4/5ダメージ、各PP1とEN+1', () => {
  let state = startedGame()
  const diluc = place(state,0,'C023',4,5)
  state.players[0].pp=4
  const target = place(state,1,'C001',1,20)
  for (const [i,expectedHp] of [17,13,8].entries()) {
    assert.equal(engine.canUseAbility(state,diluc.instanceId,'skill'),true)
    state=engine.activateAbility(state,diluc.instanceId,'skill',target.instanceId)
    assert.equal(state.players[1].field[0].health,expectedHp)
    assert.equal(state.players[0].pp,3-i)
    assert.equal(state.players[0].energy,i+1)
    assert.equal(state.players[0].field[0].skillUsesThisTurn,i+1)
  }
  assert.equal(engine.canUseAbility(state,diluc.instanceId,'skill'),false)
  assert.equal(engine.activateAbility(state,diluc.instanceId,'skill',target.instanceId),state)
})

test('C023 ディルック：使用回数は次の自分のターンにリセット', () => {
  let state = startedGame()
  const diluc=place(state,0,'C023',4,5)
  state.players[0].pp=5
  place(state,1,'C001',1,25)
  state=engine.activateAbility(state,diluc.instanceId,'skill',state.players[1].field[0].instanceId)
  assert.equal(state.players[0].field[0].skillUsesThisTurn,1)
  state=engine.endTurn(state)
  state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].skillUsesThisTurn,0)
  assert.equal(engine.canUseAbility(state,diluc.instanceId,'skill'),true)
})

test('C023 ディルック：元素爆発はEN3消費し敵全体とリーダーに炎3', () => {
  let state=startedGame()
  const diluc=place(state,0,'C023',4,5)
  state.players[0].energy=4
  const a=place(state,1,'C001',1,7)
  const b=place(state,1,'C001',1,8)
  b.aura=[{element:'hydro'}]
  state=engine.activateAbility(state,diluc.instanceId,'burst')
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[1].leaderHealth,17)
  assert.equal(state.players[1].field.find(f=>f.instanceId===a.instanceId).health,4)
  assert.equal(state.players[1].field.find(f=>f.instanceId===b.instanceId).health,3)
  assert.equal(state.players[0].field[0].burstUsed,true)
})

test('C023 ディルック：スキルと爆発は別枠で同じターンに使用できる', () => {
  let state=startedGame()
  const diluc=place(state,0,'C023',4,5)
  state.players[0].energy=3
  state.players[0].pp=1
  const enemy=place(state,1,'C001',1,12)
  state=engine.activateAbility(state,diluc.instanceId,'skill',enemy.instanceId)
  state=engine.activateAbility(state,diluc.instanceId,'burst')
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[1].leaderHealth,17)
  assert.equal(state.players[1].field[0].health,6)
})

test('C024 リネ：疾走で登場ターンからリーダーへ攻撃可能', () => {
  let state=startedGame()
  state.players[0].pp=4
  state.players[0].hand=['C024']
  state=engine.playCard(state,'player1',0)
  const lyney=state.players[0].field[0]
  assert.equal(lyney.keywords.includes('storm'),true)
  assert.equal(lyney.canAttack,true)
  state=engine.attackLeader(state,lyney.instanceId)
  assert.equal(state.players[1].leaderHealth,18)
})

test('C024 リネ：味方炎カードが自身含め3枚以上なら攻撃時+1/+0', () => {
  let state=startedGame()
  const lyney=place(state,0,'C024',2,3)
  const a=place(state,0,'C001',1,2)
  place(state,0,'C019',2,3)
  let next=engine.attackLeader(state,lyney.instanceId)
  assert.equal(next.players[1].leaderHealth,18)
  assert.equal(next.players[0].field.find(f=>f.instanceId===lyney.instanceId).attack,2)
  state.players[0].field.find(f=>f.instanceId===a.instanceId).cardId='C011'
  next=engine.attackLeader(state,lyney.instanceId)
  assert.equal(next.players[1].leaderHealth,17)
  assert.equal(next.players[0].field.find(f=>f.instanceId===lyney.instanceId).attack,3)
})

test('C024 リネ：元素スキルはPP1で炎2ダメージ、EN1獲得', () => {
  let state=startedGame()
  const lyney=place(state,0,'C024',2,3)
  const enemy=place(state,1,'C001',1,6)
  state.players[0].pp=1
  state=engine.activateAbility(state,lyney.instanceId,'skill',enemy.instanceId)
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[1].field[0].health,4)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'pyro'}])
})

test('C024 リネ：爆発でファニーハット・キャットに変身し全状態をリセット', () => {
  let state=startedGame()
  const lyney=place(state,0,'C024',9,1)
  lyney.shield={normal:5,crystallize:3}
  lyney.aura=[{element:'hydro'}]
  lyney.keywords=['storm','burning:2']
  lyney.hasAttacked=true
  lyney.skillUsed=true
  lyney.skillUsesThisTurn=1
  state.players[0].energy=3
  state=engine.activateAbility(state,lyney.instanceId,'burst')
  assert.equal(state.players[0].energy,1)
  const cat=state.players[0].field[0]
  assert.equal(cat.cardId,'token-funny-hat-cat')
  assert.notEqual(cat.instanceId,lyney.instanceId)
  assert.deepEqual([cat.attack,cat.health,cat.maxHealth],[5,5,5])
  assert.deepEqual(cat.shield,{normal:0,crystallize:0})
  assert.deepEqual(cat.aura,[])
  assert.equal(cat.hasAttacked,false)
  assert.equal(cat.skillUsed,false)
  assert.equal(cat.burstUsed,false)
  assert.equal(cat.canAttack,true)
  for(const k of ['rush','aura','intimidate','rush_only']) assert.ok(cat.keywords.includes(k))
  assert.deepEqual(state.players[0].graveyard,[])
})

test('ファニーハット・キャット：突進で敵フォロワー攻撃可能、リーダーは不可', () => {
  const state=startedGame()
  state.players[0].energy=2
  const lyney=place(state,0,'C024',2,3)
  let next=engine.activateAbility(state,lyney.instanceId,'burst')
  const cat=next.players[0].field[0]
  const enemy=place(next,1,'C001',1,9)
  assert.equal(engine.attackLeader(next,cat.instanceId),next)
  next=engine.attackFollower(next,cat.instanceId,enemy.instanceId)
  assert.equal(next.players[1].field[0].health,4)
})

test('ファニーハット・キャット：次の自分ターン開始で破壊、リネを無ファンファーレ召喚', () => {
  let state=startedGame()
  const lyney=place(state,0,'C024',2,3)
  state.players[0].energy=2
  state=engine.activateAbility(state,lyney.instanceId,'burst')
  assert.equal(state.players[0].field[0].cardId,'token-funny-hat-cat')
  state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].cardId,'token-funny-hat-cat')
  state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].cardId,'C024')
  assert.equal(state.players[0].field[0].attack,2)
  assert.ok(state.players[0].graveyard.includes('token-funny-hat-cat'))
  assert.equal(state.players[0].graveyard.includes('C024'),false)
})

test('ファニーハット・キャット：オーラと威圧が有効、破壊時にもリネを召喚', () => {
  let state=startedGame()
  const lyney=place(state,0,'C024',2,3)
  state.players[0].energy=2
  state=engine.activateAbility(state,lyney.instanceId,'burst')
  const cat=state.players[0].field[0]
  const enemy=place(state,1,'C001',1,8)
  const p2={...state,currentPlayerId:'player2'}
  assert.equal(engine.attackFollower(p2,enemy.instanceId,cat.instanceId),p2)
  p2.players[1].hand=['C018'];p2.players[1].pp=4
  assert.equal(engine.canPlayCard(p2,0),false)
  // Destruction through a non-targeted combat result is represented by removing health.
  p2.players[0].field[0].health=0
  const next=engine.endTurn(p2)
  assert.ok(next.players[0].field.some(f=>f.cardId==='C024'))
})

test('C025 胡桃：疾走とHP10以下限定の+2攻撃力', () => {
  let state=startedGame()
  state.players[0].hand=['C025']
  state.players[0].pp=4
  state.players[0].leaderHealth=11
  state=engine.playCard(state,'player1',0)
  const hutao=state.players[0].field[0]
  assert.equal(hutao.canAttack,true)
  let next=engine.attackLeader(state,hutao.instanceId)
  assert.equal(next.players[1].leaderHealth,17)
  const low=startedGame()
  low.players[0].leaderHealth=10
  const empowered=place(low,0,'C025',3,4)
  next=engine.attackLeader(low,empowered.instanceId)
  assert.equal(next.players[1].leaderHealth,15)
  assert.equal(next.players[0].field[0].attack,3)
})

test('C025 胡桃：元素スキルはPP1とHP3を消費し自身+2攻撃、炎通常攻撃付与', () => {
  let state=startedGame()
  const hutao=place(state,0,'C025',3,4)
  state.players[0].pp=1
  state.players[0].leaderHealth=15
  state=engine.activateAbility(state,hutao.instanceId,'skill')
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[0].leaderHealth,12)
  assert.equal(state.players[0].field[0].attack,5)
  assert.ok(state.players[0].field[0].keywords.includes('normal_attack_pyro'))
  const target=place(state,1,'C001',1,9)
  state=engine.attackFollower(state,hutao.instanceId,target.instanceId)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'pyro'}])
})

test('C025 胡桃：HPが3ならスキルの自傷ダメージで敗北する', () => {
  let state=startedGame()
  const hutao=place(state,0,'C025',3,4)
  state.players[0].leaderHealth=3
  state.players[0].pp=1
  state=engine.activateAbility(state,hutao.instanceId,'skill')
  assert.equal(state.winnerId,'player2')
  assert.equal(state.players[0].leaderHealth,0)
  assert.equal(state.players[0].field[0].attack,3)
})

test('C025 胡桃：元素爆発で敵リーダー炎4・自リーダーHP3回復、EN3消費', () => {
  let state=startedGame()
  const hutao=place(state,0,'C025',3,4)
  state.players[0].energy=3
  state.players[0].leaderHealth=13
  state=engine.activateAbility(state,hutao.instanceId,'burst')
  assert.equal(state.players[1].leaderHealth,16)
  assert.equal(state.players[0].leaderHealth,16)
  assert.equal(state.players[0].energy,0)
  assert.equal(state.players[0].field[0].burstUsed,true)
})

test('C025 胡桃：爆発で相手を倒した後は回復を行わない', () => {
  let state=startedGame()
  const hutao=place(state,0,'C025',3,4)
  state.players[0].energy=3
  state.players[0].leaderHealth=10
  state.players[1].leaderHealth=4
  state=engine.activateAbility(state,hutao.instanceId,'burst')
  assert.equal(state.winnerId,'player1')
  assert.equal(state.players[0].leaderHealth,10)
})

test('変身トークンは登録済みだがデッキに入らない', async () => {
  const { getDeckCardPool } = await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const card=engine.getCard('token-funny-hat-cat')
  assert.deepEqual([card.cost,card.attack,card.health],[5,5,5])
  assert.deepEqual(card.keywords,['rush','aura','intimidate'])
  assert.equal(getDeckCardPool().some(c=>c.id===card.id),false)
})

test('C025 胡桃：HP10以下の攻撃力+2は反撃時にも適用され、HP回復で解除される', () => {
  const state = startedGame()
  const attacker = place(state,0,'C001',2,10)
  const hutao = place(state,1,'C025',3,4)
  state.players[1].leaderHealth = 10
  let next = engine.attackFollower(state,attacker.instanceId,hutao.instanceId)
  assert.equal(next.players[0].field[0].health,5)
  const healthy = startedGame()
  healthy.players[1].leaderHealth = 11
  const attacker2 = place(healthy,0,'C001',2,10)
  place(healthy,1,'C025',3,4)
  next = engine.attackFollower(healthy,attacker2.instanceId,healthy.players[1].field[0].instanceId)
  assert.equal(next.players[0].field[0].health,7)
})

test('STEP30 水元素C026-C040のカード名・コスト・レアリティは確定資料どおり', async () => {
  const { hydroCards } = await vite.ssrLoadModule('/src/data/cards/hydro.ts')
  assert.deepEqual(hydroCards.map(c=>c.id),
    Array.from({length:15},(_,i)=>'C'+String(26+i).padStart(3,'0')))
  assert.deepEqual(hydroCards.map(c=>c.name),[
    '水スライム','ヒルチャールシャーマン・水','コホラ仔竜','アビスの魔術師・水',
    '古華剣・裁雨留虹','シャイニングミラクル♪','重甲ヤドカニ','ヒルチャールレンジャー・水',
    'みんなのアイドル・バーバラ','少壮気鋭・行秋','アアル村の守護者・キャンディス',
    '発明家・アイノ','占星術師・モナ','現人神の巫女・珊瑚宮心海',
    '執行官第十一位・タルタリヤ',
  ])
  assert.deepEqual(hydroCards.map(c=>c.cost),[1,3,2,3,2,3,4,5,4,3,4,3,4,5,5])
  assert.deepEqual(hydroCards.map(c=>c.rarity),[
    ...Array(4).fill('bronze'),...Array(4).fill('silver'),
    ...Array(4).fill('gold'),...Array(3).fill('legendary')
  ])
  assert.ok(hydroCards.every(c=>c.element==='hydro'))
})

test('STEP30 水元素15枚のカードタイプ・フォロワーステータスと登録状況', async () => {
  const { hydroCards }=await vite.ssrLoadModule('/src/data/cards/hydro.ts')
  assert.deepEqual(hydroCards.map(c=>c.type),[
    'follower','follower','follower','follower','spell','spell',
    'follower','follower','follower','follower','follower','follower',
    'follower','follower','follower'
  ])
  assert.deepEqual(hydroCards.filter(c=>c.type==='follower').map(c=>[c.attack,c.health]),[
    [2,2],[1,4],[2,2],[2,2],[2,5],[4,4],
    [2,5],[2,3],[3,5],[2,4],[2,4],[2,6],[4,5]
  ])
  assert.deepEqual(hydroCards.filter(c=>c.implementationStatus==='playable').map(c=>c.id),
    ['C026','C027','C028','C029','C030','C031','C032','C033','C034','C035','C036','C037','C038','C039','C040'])
  const { getDeckCardPool }=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const pool = new Set(getDeckCardPool().map(c=>c.id))
  for(const c of hydroCards) assert.equal(pool.has(c.id),c.implementationStatus==='playable')
})

test('STEP30 構築済み水元素15枚と正式登録総数を照合',async()=>{
  const { productionCards }=await vite.ssrLoadModule('/src/data/productionCards.ts')
  const { validateProductionCards }=await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const report=validateProductionCards(productionCards)
  assert.deepEqual(report.errors,[])
  assert.equal(report.total,115)
  assert.equal(report.slots.filter(s=>s.element==='hydro').reduce((n,s)=>n+s.remaining,0),0)
  assert.equal(report.slots.reduce((n,s)=>n+s.remaining,0),0)
  assert.equal(report.ready,true)
})

test('C030はVer.1.0.1で対戦対応し味方フォロワー不在時は対象を選べない',()=>{
  const state=startedGame()
  state.players[0].pp=10
  state.players[0].hand=['C030']
  assert.equal(engine.getCard('C030').implementationStatus,'playable')
  assert.match(engine.getCard('C030').description,/今攻撃している対象/)
  assert.equal(engine.playCard(state,'player1',0),state)
  const ally=place(state,0,'C001',1,2)
  const played=engine.playCard(state,'player1',0,ally.instanceId)
  assert.ok(played.players[0].field[0].keywords.includes('raincutter_on_attack'))
})

test('C026 水スライムは元素生物の水元素を常時付着した状態で出す',()=>{
  let state=startedGame()
  state.players[0].pp=1; state.players[0].hand=['C026']
  state=engine.playCard(state,'player1',0)
  assert.deepEqual(state.players[0].field[0].aura,[{element:'hydro'}])
  assert.equal(state.players[0].field[0].health,2)
})

test('C027 水シャーマンは自分のターン終了時に全味方フォロワーを1回復',()=>{
  const state=startedGame()
  place(state,0,'C027',1,4)
  const f=place(state,0,'C001',2,3)
  f.maxHealth=5
  const full=place(state,0,'C001',1,2)
  const next=engine.endTurn(state)
  assert.equal(next.players[0].field.find(x=>x.instanceId===f.instanceId).health,4)
  assert.equal(next.players[0].field.find(x=>x.instanceId===full.instanceId).health,2)
  assert.equal(next.players[1].leaderHealth,20)
})

test('C028 コホラ仔竜の突進は登場ターンのフォロワー攻撃のみ可能',()=>{
  let state=startedGame()
  state.players[0].pp=2;state.players[0].hand=['C028']
  state=engine.playCard(state,'player1',0)
  const dragon=state.players[0].field[0]
  assert.equal(engine.attackLeader(state,dragon.instanceId),state)
  const victim=place(state,1,'C001',1,4)
  const next=engine.attackFollower(state,dragon.instanceId,victim.instanceId)
  assert.equal(next.players[1].field[0].health,2)
})

test('C029 水アビス魔術師はファンファーレでシールド3と水通常攻撃',()=>{
  let state=startedGame()
  state.players[0].pp=3;state.players[0].hand=['C029']
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].field[0].shield.normal,3)
  const target=place(state,1,'C001',1,6)
  state.players[0].field[0].canAttack=true
  const next=engine.attackFollower(state,state.players[0].field[0].instanceId,target.instanceId)
  assert.deepEqual(next.players[1].field[0].aura,[{element:'hydro'}])
})

test('C031 シャイニングミラクルは全味方とリーダー2回復・カード1枚ドロー',()=>{
  let state=startedGame()
  state.players[0].hand=['C031'];state.players[0].pp=3
  state.players[0].leaderHealth=14
  state.players[0].deck=['C001','C026']
  const a=place(state,0,'C001',1,2)
  a.maxHealth=5
  const b=place(state,0,'C001',1,4)
  b.maxHealth=5
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].leaderHealth,16)
  assert.equal(state.players[0].field[0].health,4)
  assert.equal(state.players[0].field[1].health,5)
  assert.deepEqual(state.players[0].hand,['C001'])
  assert.deepEqual(state.players[0].deck,['C026'])
  assert.deepEqual(state.players[0].graveyard,['C031'])
})

test('C031 ドロー時のデッキ切れは回復後でも即敗北',()=>{
  let state=startedGame()
  state.players[0].hand=['C031'];state.players[0].pp=3
  state.players[0].deck=[]
  state=engine.playCard(state,'player1',0)
  assert.equal(state.winnerId,'player2')
})

test('C032 重甲ヤドカニは守護で、毎自ターン終了時に通常シールド2',()=>{
  let state=startedGame()
  state.players[0].hand=['C032'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0)
  assert.ok(state.players[0].field[0].keywords.includes('guard'))
  state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].shield.normal,2)
  state=engine.endTurn(state)
  state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].shield.normal,4)
})

test('C033 水レンジャーは突進し攻撃時にヒルチャール1体を召喚',()=>{
  let state=startedGame()
  state.players[0].hand=['C033'];state.players[0].pp=5
  state=engine.playCard(state,'player1',0)
  const ranger=state.players[0].field[0]
  assert.equal(engine.attackLeader(state,ranger.instanceId),state)
  const enemy=place(state,1,'C001',1,10)
  state=engine.attackFollower(state,ranger.instanceId,enemy.instanceId)
  assert.deepEqual(state.players[0].field.map(f=>f.cardId),['C033','C001'])
  assert.equal(state.players[1].field[0].health,6)
})

test('C033 水レンジャー攻撃時の召喚は場が満員なら不発、攻撃自体は成立',()=>{
  let state=startedGame()
  const ranger=place(state,0,'C033',4,4)
  for(let i=0;i<4;i++)place(state,0,'C001',1,2)
  const enemy=place(state,1,'C001',1,8)
  state=engine.attackFollower(state,ranger.instanceId,enemy.instanceId)
  assert.equal(state.players[0].field.length,5)
  assert.equal(state.players[1].field[0].health,4)
})

test('C036 キャンディスは守護持ち、スキルPP1で自身シールド3＋敵に水2',()=>{
  let state=startedGame()
  state.players[0].hand=['C036'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0)
  const candace=state.players[0].field[0]
  const enemy=place(state,1,'C001',1,7)
  state.players[0].pp=1
  state=engine.activateAbility(state,candace.instanceId,'skill',enemy.instanceId)
  assert.ok(state.players[0].field[0].keywords.includes('guard'))
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[0].field[0].shield.normal,3)
  assert.equal(state.players[1].field[0].health,5)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'hydro'}])
})

test('STEP42：水元素15枚はすべて対戦対応（C030を含む）',()=>{
  const state=startedGame()
  state.players[0].pp=10
  state.players[0].hand=['C030','C034','C035','C037','C038','C039','C040']
  assert.equal(engine.canPlayCard(state,0),true)
  for(let i=1;i<state.players[0].hand.length;i++){
    assert.ok(engine.getCard(state.players[0].hand[i]).description.length>0)
    assert.equal(engine.canPlayCard(state,i),true)
  }
})

test('STEP31 6枚の水ゴールド・レジェンドに確定したスキル/爆発とPP/ENを登録',async()=>{
  const ids=['C034','C035','C037','C038','C039','C040']
  assert.deepEqual(ids.map(id=>engine.getCard(id).elementalSkill.ppCost),[2,1,1,1,1,1])
  assert.deepEqual(ids.map(id=>engine.getCard(id).elementalSkill.name),[
    '公演、開始♪','古華剣・画雨籠山','名称未設定','水中幻願','海月の誓い','魔王武装・狂瀾'])
  assert.deepEqual(['C038','C039','C040'].map(id=>engine.getCard(id).elementalBurst.energyCost),[3,3,4])
  assert.equal(engine.getCard('C030').implementationStatus,'playable')
})

test('C034 バーバラ：ターン終了で味方全員1回復、本人の通常攻撃は水',()=>{
  const state=startedGame()
  const barbara=place(state,0,'C034',2,4)
  barbara.maxHealth=5
  const ally=place(state,0,'C001',1,1);ally.maxHealth=4
  const next=engine.endTurn(state)
  assert.equal(next.players[0].field[0].health,5)
  assert.equal(next.players[0].field[1].health,2)
  assert.equal(engine.getCard('C034').normalAttackElement,'hydro')
})

test('C034 歌声の環：スキルPP2・EN+1、クレスト3ターンで自リーダー3回復と水付着',()=>{
  let state=startedGame()
  const barbara=place(state,0,'C034',2,5)
  state.players[0].pp=2;state.players[0].leaderHealth=8
  state=engine.activateAbility(state,barbara.instanceId,'skill')
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[0].crests[0].turnsRemaining,3)
  state=engine.endTurn(state)
  assert.equal(state.players[0].leaderHealth,11)
  assert.deepEqual(state.players[0].leaderAura,[{element:'hydro'}])
  assert.equal(state.players[0].crests[0].turnsRemaining,2)
  state=engine.endTurn(state);state=engine.endTurn(state)
  state=engine.endTurn(state);state=engine.endTurn(state)
  assert.equal(state.players[0].leaderHealth,17)
  assert.deepEqual(state.players[0].crests,[])
})

test('C035 行秋：ファンファーレで1枚引き、手札の最大9枚を守る',()=>{
  let state=startedGame()
  state.players[0].pp=3;state.players[0].hand=['C035'];state.players[0].deck=['C001','C026']
  state=engine.playCard(state,'player1',0)
  assert.deepEqual(state.players[0].hand,['C001'])
  assert.deepEqual(state.players[0].deck,['C026'])
  const full=startedGame()
  full.players[0].pp=3
  full.players[0].hand=['C035',...Array(8).fill('C001')]
  full.players[0].deck=['C026']
  const next=engine.playCard(full,'player1',0)
  assert.equal(next.players[0].hand.length,9)
  assert.equal(next.players[0].hand.at(-1),'C026')
  assert.equal(next.players[0].deck.length,0)
})

test('C035 行秋：デッキ切れのファンファーレは即敗北',()=>{
  let state=startedGame()
  state.players[0].pp=3;state.players[0].hand=['C035'];state.players[0].deck=[]
  state=engine.playCard(state,'player1',0)
  assert.equal(state.winnerId,'player2')
})

test('C035 行秋：スキルで2回攻撃・突進・水攻撃、登場ターンの敵リーダーは攻撃不可',()=>{
  let state=startedGame()
  state.players[0].pp=4;state.players[0].hand=['C035'];state.players[0].deck=['C001']
  state=engine.playCard(state,'player1',0)
  const xing=state.players[0].field[0]
  state=engine.activateAbility(state,xing.instanceId,'skill')
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  assert.equal(engine.attackLeader(state,xing.instanceId),state)
  let enemy=place(state,1,'C001',0,12)
  state=engine.attackFollower(state,xing.instanceId,enemy.instanceId)
  assert.equal(state.players[1].field[0].health,10)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'hydro'}])
  assert.equal(engine.canFollowerAttack(state.players[0].field[0]),true)
  enemy=state.players[1].field[0]
  state=engine.attackFollower(state,xing.instanceId,enemy.instanceId)
  assert.equal(state.players[1].field[0].health,8)
  assert.equal(engine.canFollowerAttack(state.players[0].field[0]),false)
})

test('C035 行秋：次ターンは2回攻撃でリーダーに攻撃可能',()=>{
  let state=startedGame()
  const xing=place(state,0,'C035',2,3)
  state.players[0].pp=1
  state=engine.activateAbility(state,xing.instanceId,'skill')
  state=engine.endTurn(state);state=engine.endTurn(state)
  state=engine.attackLeader(state,xing.instanceId)
  state=engine.attackLeader(state,xing.instanceId)
  assert.equal(state.players[1].leaderHealth,16)
  assert.equal(state.players[0].field[0].attacksThisTurn,2)
})

test('C037 アイノ：登場時に水圧装置を出し場の5枠を共有する',()=>{
  let state=startedGame()
  state.players[0].pp=3;state.players[0].hand=['C037']
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].field.length,1)
  assert.equal(state.players[0].amulets[0].cardId,'token-hydro-pressure-device')
  assert.equal(state.players[0].amulets[0].turnsRemaining,2)
  const full=startedGame()
  full.players[0].pp=3;full.players[0].hand=['C037']
  for(let i=0;i<4;i++)place(full,0,'C001',1,2)
  const next=engine.playCard(full,'player1',0)
  assert.equal(next.players[0].field.length,5)
  assert.equal(next.players[0].amulets?.length??0,0)
})

test('C037 アイノ：スキルPP1で水2ダメージと全水圧装置カウント+1',()=>{
  let state=startedGame()
  const aino=place(state,0,'C037',2,4)
  state.players[0].amulets=[{instanceId:'device1',cardId:'token-hydro-pressure-device',turnsRemaining:2}]
  state.players[0].pp=1
  const target=place(state,1,'C001',0,7)
  state=engine.activateAbility(state,aino.instanceId,'skill',target.instanceId)
  assert.equal(state.players[1].field[0].health,5)
  assert.equal(state.players[0].amulets[0].turnsRemaining,3)
  assert.equal(state.players[0].energy,1)
})

test('水圧装置：ターン終了で敵一体に水1・カウント減少、0で消滅',()=>{
  let state=startedGame()
  state.players[0].amulets=[{instanceId:'d1',cardId:'token-hydro-pressure-device',turnsRemaining:2}]
  place(state,1,'C001',0,7)
  state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,6)
  assert.equal(state.players[0].amulets[0].turnsRemaining,1)
  state=engine.endTurn(state);state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,5)
  assert.deepEqual(state.players[0].amulets,[])
})

test('C038 モナ：スキルPP1で守護0/2の虚影を召喚',()=>{
  let state=startedGame()
  const mona=place(state,0,'C038',2,4)
  state.players[0].pp=1
  state=engine.activateAbility(state,mona.instanceId,'skill')
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  const phantom=state.players[0].field[1]
  assert.deepEqual([phantom.cardId,phantom.attack,phantom.health],['token-hydro-phantom',0,2])
  assert.ok(phantom.keywords.includes('guard'))
})

test('虚影：破壊時にランダムな敵フォロワーへ水2ダメージ',()=>{
  let state=startedGame()
  const phantom=place(state,0,'token-hydro-phantom',0,1)
  phantom.keywords=['guard']
  const enemy=place(state,1,'C001',2,8)
  state=engine.attackFollower(state,phantom.instanceId,enemy.instanceId)
  assert.equal(state.players[0].field.length,0)
  assert.equal(state.players[1].field[0].health,6)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'hydro'}])
})

test('C038 モナ：爆発EN3で敵全体水2・残存敵に次のダメージ+2',()=>{
  let state=startedGame()
  const mona=place(state,0,'C038',2,4)
  state.players[0].energy=3
  const enemy=place(state,1,'C001',0,9)
  const enemy2=place(state,1,'C001',0,1)
  state=engine.activateAbility(state,mona.instanceId,'burst')
  assert.equal(state.players[0].energy,0)
  assert.equal(state.players[1].field.length,1)
  assert.equal(state.players[1].field[0].health,7)
  assert.ok(state.players[1].field[0].keywords.includes('next_damage_plus_2'))
  assert.ok(state.players[1].graveyard.includes(enemy2.cardId))
  assert.equal(state.players[1].field[0].instanceId,enemy.instanceId)
})

test('モナの「次に受けるダメージ+2」は一度のみ、シールドにも適用',async()=>{
  const {resolveElementalDamage}=await vite.ssrLoadModule('/src/game/elemental.ts')
  const f=place(startedGame(),1,'C001',0,10)
  f.keywords=['next_damage_plus_2']
  f.shield.normal=2
  const first=resolveElementalDamage(f,1,'hydro').follower
  assert.equal(first.shield.normal,0)
  assert.equal(first.health,9)
  assert.ok(!first.keywords.includes('next_damage_plus_2'))
  const second=resolveElementalDamage(first,1,'hydro').follower
  assert.equal(second.health,8)
})

test('C039 心海：ターン終了時に自リーダーを2回復',()=>{
  let state=startedGame()
  state.players[0].leaderHealth=12
  place(state,0,'C039',2,6)
  state=engine.endTurn(state)
  assert.equal(state.players[0].leaderHealth,14)
})

test('C039 心海：スキルPP1で化海月0/4を召喚、ターン終了で回復と水1',()=>{
  let state=startedGame()
  const kokomi=place(state,0,'C039',2,6)
  state.players[0].leaderHealth=12
  state.players[0].pp=1
  const ally=place(state,0,'C001',1,1);ally.maxHealth=3
  place(state,1,'C001',0,6)
  state=engine.activateAbility(state,kokomi.instanceId,'skill')
  assert.deepEqual([state.players[0].field[2].cardId,state.players[0].field[2].health],
    ['token-hydro-jellyfish',4])
  state=engine.endTurn(state)
  assert.equal(state.players[0].leaderHealth,15)
  assert.equal(state.players[0].field.find(f=>f.instanceId===ally.instanceId).health,2)
  assert.equal(state.players[1].field[0].health,5)
})

test('C039 心海：爆発EN3で自身+2/0・守護・突進・攻撃時自リーダー2回復',()=>{
  let state=startedGame()
  const kokomi=place(state,0,'C039',2,6)
  kokomi.canAttack=false
  state.players[0].energy=3
  state.players[0].leaderHealth=12
  state=engine.activateAbility(state,kokomi.instanceId,'burst')
  const boosted=state.players[0].field[0]
  assert.equal(boosted.attack,4)
  assert.ok(boosted.keywords.includes('guard'))
  assert.ok(boosted.keywords.includes('rush'))
  assert.equal(boosted.canAttack,true)
  assert.equal(engine.attackLeader(state,kokomi.instanceId),state)
  const target=place(state,1,'C001',0,9)
  state=engine.attackFollower(state,kokomi.instanceId,target.instanceId)
  assert.equal(state.players[0].leaderHealth,14)
  assert.equal(state.players[1].field[0].health,5)
})

test('C040 タルタリヤ：スキルで2回攻撃・突進・水攻撃、PP1とEN+1',()=>{
  let state=startedGame()
  const childe=place(state,0,'C040',4,5)
  childe.canAttack=false
  state.players[0].pp=1
  const enemy=place(state,1,'C001',0,12)
  state=engine.activateAbility(state,childe.instanceId,'skill')
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  assert.equal(engine.attackLeader(state,childe.instanceId),state)
  state=engine.attackFollower(state,childe.instanceId,enemy.instanceId)
  state=engine.attackFollower(state,childe.instanceId,enemy.instanceId)
  assert.equal(state.players[1].field[0].health,4)
  assert.equal(engine.canFollowerAttack(state.players[0].field[0]),false)
})

test('C040 タルタリヤ：爆発EN4で未攻撃なら敵全体・リーダー水3',()=>{
  let state=startedGame()
  const childe=place(state,0,'C040',4,5)
  state.players[0].energy=4
  place(state,1,'C001',0,8)
  state=engine.activateAbility(state,childe.instanceId,'burst')
  assert.equal(state.players[1].field[0].health,5)
  assert.equal(state.players[1].leaderHealth,17)
  assert.equal(state.players[0].energy,0)
})

test('C040 タルタリヤ：攻撃済みなら爆発のダメージが5',()=>{
  let state=startedGame()
  const childe=place(state,0,'C040',4,5)
  const enemy=place(state,1,'C001',0,12)
  state=engine.attackFollower(state,childe.instanceId,enemy.instanceId)
  assert.equal(state.players[0].field[0].hasAttacked,true)
  state.players[0].energy=4
  state=engine.activateAbility(state,childe.instanceId,'burst')
  assert.equal(state.players[1].field[0].health,3)
  assert.equal(state.players[1].leaderHealth,15)
})

test('トークン3種とカードレジストリ：水圧装置はアミュレット、虚影・化海月はデッキ除外',()=>{
  const ids=['token-hydro-pressure-device','token-hydro-phantom','token-hydro-jellyfish']
  assert.deepEqual(ids.map(id=>engine.getCard(id).type),['amulet','follower','follower'])
  const status=ids.map(id=>engine.getCard(id).token)
  assert.deepEqual(status,[true,true,true])
})


test('STEP32 氷元素15枚のID、名前、コスト、レアリティは確定資料どおり',async()=>{
  const { cryoCards }=await vite.ssrLoadModule('/src/data/cards/cryo.ts')
  assert.deepEqual(cryoCards.map(c=>c.id),
    Array.from({length:15},(_,i)=>'C'+String(41+i).padStart(3,'0')))
  assert.deepEqual(cryoCards.map(c=>c.name),[
    '氷スライム','ヒルチャール射手・氷','イクトミ仔竜','霜の精',
    '凛冽なる輪舞','星流揺籠の夢','ファデュイ・氷蛍術師','ヒルチャール・霜鎧の王',
    'キャッツテールの看板娘・ディオナ','西風騎兵隊長・ガイア',
    '夢遊する星詠み・レイラ','スチームバードの記者・シャルロット',
    '月海亭の秘書・甘雨','黒曜石の老婆・シトラリ','神里家令嬢・神里綾華',
  ])
  assert.deepEqual(cryoCards.map(c=>c.cost),[1,2,2,3,3,4,4,7,3,3,3,4,5,5,5])
  assert.deepEqual(cryoCards.map(c=>c.rarity),[
    ...Array(4).fill('bronze'),...Array(4).fill('silver'),
    ...Array(4).fill('gold'),...Array(3).fill('legendary')
  ])
  assert.ok(cryoCards.every(c=>c.element==='cryo'))
})

test('STEP32 氷15枚のタイプ・ステータス・地域と対戦対応状況を照合',async()=>{
  const { cryoCards }=await vite.ssrLoadModule('/src/data/cards/cryo.ts')
  assert.deepEqual(cryoCards.map(c=>c.type),[
    'follower','follower','follower','follower','spell','spell',
    'follower','follower','follower','follower','follower','follower',
    'follower','follower','follower'
  ])
  assert.deepEqual(cryoCards.filter(c=>c.type==='follower').map(c=>[c.attack,c.health]),[
    [2,2],[2,2],[2,2],[2,2],[2,4],[5,7],
    [2,4],[3,3],[1,5],[2,4],[3,5],[2,5],[4,5],
  ])
  assert.deepEqual(cryoCards.filter(c=>c.implementationStatus==='playable').map(c=>c.id),
    Array.from({length:15},(_,i)=>'C'+String(41+i).padStart(3,'0')))
  assert.deepEqual(cryoCards.find(c=>c.id==='C051').traits,['教令院'])
  assert.deepEqual(cryoCards.find(c=>c.id==='C054').traits,['謎煙の主'])
})

test('STEP32 旧実装に加え雷・風15枚登録済み・残り30枚',async()=>{
  const { productionCards }=await vite.ssrLoadModule('/src/data/productionCards.ts')
  const { validateProductionCards }=await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const result=validateProductionCards(productionCards)
  assert.deepEqual(result.errors,[])
  assert.equal(result.total,115)
  assert.equal(result.slots.filter(x=>x.element==='cryo').reduce((n,x)=>n+x.remaining,0),0)
  assert.equal(result.slots.reduce((n,x)=>n+x.remaining,0),0)
})

test('STEP33 氷15枚は全て登録済みかつデッキ候補として対戦可能',async()=>{
  const { getDeckCardPool }=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const { cryoCards }=await vite.ssrLoadModule('/src/data/cards/cryo.ts')
  const pool=new Set(getDeckCardPool().map(c=>c.id))
  for(const c of cryoCards) assert.equal(pool.has(c.id),c.implementationStatus==='playable')
  const state=startedGame()
  state.players[0].pp=10;state.players[0].hand=['C044','C045','C046','C049','C051','C052','C053','C054','C055']
  assert.ok(state.players[0].hand.every(id=>engine.getCard(id)?.description?.length))
  assert.ok(state.players[0].hand.every(id=>engine.getCard(id).implementationStatus==='playable'))
  assert.equal(engine.canPlayCard(state,1),true)
  assert.equal(engine.canPlayCard(state,2),true)
})

test('C041 氷スライムは初期付着に氷元素を持ち、常時付着を維持',()=>{
  let state=startedGame()
  state.players[0].pp=1;state.players[0].hand=['C041']
  state=engine.playCard(state,'player1',0)
  const slime=state.players[0].field[0]
  assert.deepEqual(slime.aura,[{element:'cryo'}])
  assert.equal(slime.health,2)
})

test('C042 氷射手のファンファーレは敵一体に氷1と付着を付与',()=>{
  let state=startedGame()
  state.players[0].pp=2;state.players[0].hand=['C042']
  const target=place(state,1,'C001',1,6)
  state=engine.playCard(state,'player1',0,target.instanceId)
  assert.equal(state.players[0].field[0].cardId,'C042')
  assert.equal(state.players[1].field[0].health,5)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'cryo'}])
})

test('C042 氷射手は水付着した敵に凍結を発生させる',()=>{
  let state=startedGame()
  state.players[0].pp=2;state.players[0].hand=['C042']
  const target=place(state,1,'C001',1,6)
  target.aura=[{element:'hydro'}]
  state=engine.playCard(state,'player1',0,target.instanceId)
  assert.equal(state.players[1].field[0].health,5)
  assert.ok(state.players[1].field[0].keywords.includes('frozen'))
})

test('C043 イクトミ仔竜は突進で登場ターンは敵フォロワーのみ攻撃できる',()=>{
  let state=startedGame()
  state.players[0].pp=2;state.players[0].hand=['C043']
  state=engine.playCard(state,'player1',0)
  const dragon=state.players[0].field[0]
  assert.equal(engine.attackLeader(state,dragon.instanceId),state)
  const victim=place(state,1,'C001',0,6)
  state=engine.attackFollower(state,dragon.instanceId,victim.instanceId)
  assert.equal(state.players[1].field[0].health,4)
})

test('C047 氷蛍術師はファンファーレで氷蛍1/1を2体召喚',()=>{
  let state=startedGame()
  state.players[0].pp=4;state.players[0].hand=['C047']
  state=engine.playCard(state,'player1',0)
  assert.deepEqual(state.players[0].field.map(f=>f.cardId),
    ['C047','token-cryo-cicin','token-cryo-cicin'])
  assert.deepEqual(state.players[0].field.filter(f=>f.cardId==='token-cryo-cicin')
    .map(f=>[f.attack,f.health]),[[1,1],[1,1]])
  assert.equal(engine.getCard('token-cryo-cicin').normalAttackElement,'cryo')
})

test('C047 氷蛍術師のシールドは氷蛍が存在するターン終了時のみ付与',()=>{
  let state=startedGame()
  const mage=place(state,0,'C047',2,4)
  state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].shield.normal,0)
  place(state,0,'token-cryo-cicin',1,1)
  state=engine.endTurn(state);state=engine.endTurn(state)
  assert.equal(state.players[0].field.find(f=>f.instanceId===mage.instanceId).shield.normal,2)
})

test('C047 氷蛍の召喚は場の最大5枠を超えない',()=>{
  let state=startedGame()
  state.players[0].pp=4;state.players[0].hand=['C047']
  for(let i=0;i<3;i++)place(state,0,'C001',1,2)
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].field.length,5)
  assert.equal(state.players[0].field.filter(f=>f.cardId==='token-cryo-cicin').length,1)
})

test('C048 霜鎧の王は守護、ターン終了時自身に通常シールド3',()=>{
  let state=startedGame()
  state.players[0].pp=7;state.players[0].hand=['C048']
  state=engine.playCard(state,'player1',0)
  assert.ok(state.players[0].field[0].keywords.includes('guard'))
  state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].shield.normal,3)
  state=engine.endTurn(state);state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].shield.normal,6)
})

test('C050 ガイアは突進・PP0スキル氷2・EN1、ターン内1回',()=>{
  let state=startedGame()
  state.players[0].pp=3;state.players[0].hand=['C050']
  state=engine.playCard(state,'player1',0)
  const kaeya=state.players[0].field[0]
  const enemy=place(state,1,'C001',0,7)
  assert.equal(engine.attackLeader(state,kaeya.instanceId),state)
  assert.equal(engine.canUseAbility(state,kaeya.instanceId,'skill'),true)
  state=engine.activateAbility(state,kaeya.instanceId,'skill',enemy.instanceId)
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[1].field[0].health,5)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'cryo'}])
  assert.equal(engine.canUseAbility(state,kaeya.instanceId,'skill'),false)
})

test('氷蛍はトークンカードであり通常のデッキに登録されない',async()=>{
  const { getDeckCardPool }=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const cicin=engine.getCard('token-cryo-cicin')
  assert.deepEqual([cicin.cost,cicin.attack,cicin.health],[1,1,1])
  assert.equal(cicin.token,true)
  assert.equal(getDeckCardPool().some(c=>c.id===cicin.id),false)
})

test('STEP33 氷9枚の実装状態とスキル・爆発コストを原本照合', async()=>{
  const {cryoCards}=await vite.ssrLoadModule('/src/data/cards/cryo.ts')
  assert.equal(cryoCards.length,15)
  assert.equal(cryoCards.filter(c=>c.implementationStatus==='playable').length,15)
  const ids=['C049','C051','C052','C053','C054','C055']
  assert.deepEqual(ids.map(id=>engine.getCard(id).elementalSkill.ppCost),[2,1,1,1,1,1])
  assert.deepEqual(['C053','C054','C055'].map(id=>engine.getCard(id).elementalBurst.energyCost),[3,3,3])
})

test('C044 霜の精：味方を選び+2攻撃、本人も指定可能、無指定不可',()=>{
  let state=startedGame()
  state.players[0].hand=['C044'];state.players[0].pp=3
  const ally=place(state,0,'C001',1,2)
  assert.equal(engine.needsFriendlyPlayTarget(engine.getCard('C044')),true)
  assert.equal(engine.playCard(state,'player1',0),state)
  let next=engine.playCard(state,'player1',0,ally.instanceId)
  assert.equal(next.players[0].field[0].attack,3)
  assert.equal(next.players[0].field[1].attack,2)
  next=engine.playCard(state,'player1',0,'self')
  assert.equal(next.players[0].field[0].attack,1)
  assert.equal(next.players[0].field[1].attack,4)
})

test('C045 凛冽なる輪舞：カウント3、毎自ターン終了で氷2を2回',()=>{
  let state=startedGame()
  state.players[0].hand=['C045'];state.players[0].pp=3
  place(state,1,'C001',1,18)
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].crests[0].turnsRemaining,3)
  state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,14)
  assert.equal(state.players[0].crests[0].turnsRemaining,2)
  state=engine.endTurn(state);state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,10)
  state=engine.endTurn(state);state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,6)
  assert.deepEqual(state.players[0].crests,[])
})

test('C045 クレストは対象が無い時もカウントダウンし消滅',()=>{
  let state=startedGame()
  state.players[0].hand=['C045'];state.players[0].pp=3
  state=engine.playCard(state,'player1',0)
  for(let i=0;i<5;i++)state=engine.endTurn(state)
  assert.deepEqual(state.players[0].crests,[])
  assert.equal(state.players[1].leaderHealth,20)
})

test('C046 星流揺籠の夢：全味方＋リーダーにシールド2、敵全員に氷1',()=>{
  let state=startedGame()
  state.players[0].hand=['C046'];state.players[0].pp=4
  place(state,0,'C001',1,3)
  place(state,1,'C001',1,8)
  place(state,1,'C001',1,7)
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].leaderShield.normal,2)
  assert.equal(state.players[0].field[0].shield.normal,2)
  assert.deepEqual(state.players[1].field.map(f=>f.health),[7,6])
  assert.deepEqual(state.players[0].graveyard,['C046'])
})

test('共通リーダーシールドは通常攻撃を先に軽減し、残りのみHPへ',()=>{
  const state=startedGame()
  const attacker=place(state,0,'C001',4,3)
  state.players[1].leaderShield={normal:2,crystallize:1}
  const next=engine.attackLeader(state,attacker.instanceId)
  assert.equal(next.players[1].leaderHealth,19)
  assert.deepEqual(next.players[1].leaderShield,{normal:0,crystallize:0})
})

test('C049 ディオナ：登場時リーダーへ通常シールド2',()=>{
  let state=startedGame()
  state.players[0].hand=['C049'];state.players[0].pp=3
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].leaderShield.normal,2)
})

test('C049 ディオナ：スキルは選択した敵＋もう1体へ氷2、シールド2',()=>{
  let state=startedGame()
  const diona=place(state,0,'C049',2,4)
  const a=place(state,1,'C001',1,7)
  const b=place(state,1,'C001',1,6)
  state.players[0].pp=2
  assert.equal(engine.needsAbilityTarget(engine.getCard('C049'),'skill'),true)
  assert.equal(engine.activateAbility(state,diona.instanceId,'skill',b.instanceId),state)
  state=engine.activateAbility(state,diona.instanceId,'skill',
    b.instanceId + '|' + a.instanceId)
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  assert.deepEqual(state.players[1].field.map(f=>f.health),[5,4])
  assert.equal(state.players[0].leaderShield.normal,2)
  assert.equal(state.players[1].field[0].instanceId,a.instanceId)
})

test('C051 レイラ：守護、ターン終了時氷1・PP1スキル盾3',()=>{
  let state=startedGame()
  state.players[0].hand=['C051'];state.players[0].pp=4
  place(state,1,'C001',1,7)
  state=engine.playCard(state,'player1',0)
  const layla=state.players[0].field[0]
  assert.ok(layla.keywords.includes('guard'))
  state=engine.activateAbility(state,layla.instanceId,'skill')
  assert.equal(state.players[0].leaderShield.normal,3)
  state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,6)
  assert.equal(state.players[0].energy,1)
})

test('C052 シャルロット：登場時1枚引き、スキル氷2＋攻撃-1',()=>{
  let state=startedGame()
  state.players[0].pp=5;state.players[0].hand=['C052'];state.players[0].deck=['C001']
  state=engine.playCard(state,'player1',0)
  assert.deepEqual(state.players[0].hand,['C001'])
  const charlotte=state.players[0].field[0]
  assert.equal(engine.getCard('C052').normalAttackElement,'cryo')
  const foe=place(state,1,'C001',3,8)
  state=engine.activateAbility(state,charlotte.instanceId,'skill',foe.instanceId)
  assert.equal(state.players[1].field[0].health,6)
  assert.equal(state.players[1].field[0].attack,2)
  assert.equal(state.players[0].energy,1)
})

test('C052 シャルロット：空デッキのファンファーレはデッキ切れ敗北',()=>{
  let state=startedGame()
  state.players[0].pp=4;state.players[0].hand=['C052'];state.players[0].deck=[]
  state=engine.playCard(state,'player1',0)
  assert.equal(state.winnerId,'player2')
})

test('C053 甘雨：攻撃時に相手リーダーへ1、通常攻撃は別に解決',()=>{
  let state=startedGame()
  const ganyu=place(state,0,'C053',3,5)
  const foe=place(state,1,'C001',0,8)
  state=engine.attackFollower(state,ganyu.instanceId,foe.instanceId)
  assert.equal(state.players[1].leaderHealth,19)
  assert.equal(state.players[1].field[0].health,5)
})

test('C053 甘雨：スキルは守護0/3の氷蓮を召喚',()=>{
  let state=startedGame()
  const ganyu=place(state,0,'C053',3,5)
  state.players[0].pp=1
  state=engine.activateAbility(state,ganyu.instanceId,'skill')
  assert.equal(state.players[0].energy,1)
  const lotus=state.players[0].field[1]
  assert.equal(lotus.cardId,'token-cryo-ice-lotus')
  assert.deepEqual([lotus.attack,lotus.health],[0,3])
  assert.ok(lotus.keywords.includes('guard'))
})

test('氷蓮は破壊時に敵フォロワー全員へ氷1を与える',()=>{
  let state=startedGame()
  const lotus=place(state,0,'token-cryo-ice-lotus',0,1)
  lotus.keywords=['guard']
  const foe=place(state,1,'C001',2,7)
  place(state,1,'C001',1,6)
  state=engine.attackFollower(state,lotus.instanceId,foe.instanceId)
  assert.equal(state.players[0].field.length,0)
  assert.deepEqual(state.players[1].field.map(f=>f.health),[6,5])
  assert.deepEqual(state.players[1].field[0].aura,[{element:'cryo'}])
})

test('C053 甘雨：爆発は敵全体に氷2＋3ターン×2回クレスト',()=>{
  let state=startedGame()
  const ganyu=place(state,0,'C053',3,5)
  state.players[0].energy=3
  place(state,1,'C001',0,18)
  state=engine.activateAbility(state,ganyu.instanceId,'burst')
  assert.equal(state.players[0].energy,0)
  assert.equal(state.players[1].field[0].health,16)
  assert.equal(state.players[0].crests[0].id,'C053')
  state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,12)
  assert.equal(state.players[0].crests[0].turnsRemaining,2)
})

test('C054 シトラリ：潜伏＋氷通常攻撃、自ターン終了でリーダー盾2',()=>{
  let state=startedGame()
  state.players[0].hand=['C054'];state.players[0].pp=5
  state=engine.playCard(state,'player1',0)
  assert.ok(state.players[0].field[0].keywords.includes('stealth'))
  assert.equal(engine.getCard('C054').normalAttackElement,'cryo')
  state=engine.endTurn(state)
  assert.equal(state.players[0].leaderShield.normal,2)
})

test('C054 シトラリ：PP1スキルでイツパパ1/3を召喚',()=>{
  let state=startedGame()
  const citlali=place(state,0,'C054',2,5)
  state.players[0].pp=1
  state=engine.activateAbility(state,citlali.instanceId,'skill')
  assert.equal(state.players[0].field[1].cardId,'token-cryo-itzpapa')
  assert.deepEqual([state.players[0].field[1].attack,state.players[0].field[1].health],[1,3])
})

test('イツパパ：ターン終了時のランダム氷1とリーダー盾1',()=>{
  let state=startedGame()
  place(state,0,'token-cryo-itzpapa',1,3)
  place(state,1,'C001',0,7)
  state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,6)
  assert.equal(state.players[0].leaderShield.normal,1)
})

test('C054 シトラリ：爆発EN3で敵全員氷3＋リーダー盾3',()=>{
  let state=startedGame()
  const citlali=place(state,0,'C054',2,5)
  state.players[0].energy=3
  place(state,1,'C001',0,9)
  state=engine.activateAbility(state,citlali.instanceId,'burst')
  assert.equal(state.players[0].energy,0)
  assert.equal(state.players[1].field[0].health,6)
  assert.equal(state.players[0].leaderShield.normal,3)
})

test('C055 神里綾華：突進・スキル全敵氷1・自身に氷通常攻撃',()=>{
  let state=startedGame()
  state.players[0].pp=6;state.players[0].hand=['C055']
  state=engine.playCard(state,'player1',0)
  const ayaka=state.players[0].field[0]
  place(state,1,'C001',0,9)
  place(state,1,'C001',0,8)
  assert.equal(engine.attackLeader(state,ayaka.instanceId),state)
  state=engine.activateAbility(state,ayaka.instanceId,'skill')
  assert.deepEqual(state.players[1].field.map(f=>f.health),[8,7])
  assert.ok(state.players[0].field[0].keywords.includes('normal_attack_cryo'))
})

test('C055 神里綾華：爆発EN3で敵一体に氷2×5回（対象を毎回再抽選）',()=>{
  let state=startedGame()
  const ayaka=place(state,0,'C055',4,5)
  state.players[0].energy=3
  place(state,1,'C001',0,12)
  state=engine.activateAbility(state,ayaka.instanceId,'burst')
  assert.equal(state.players[0].energy,0)
  assert.equal(state.players[1].field[0].health,2)
})

test('リーダーシールドは最大10で止まり、ダメージで通常シールドから減る',async()=>{
  const {addLeaderShield,damageLeader}=await vite.ssrLoadModule('/src/game/leaderShield.ts')
  let p=startedGame().players[0]
  p=addLeaderShield(p,8)
  p=addLeaderShield(p,8)
  assert.equal(p.leaderShield.normal,10)
  p=damageLeader(p,12)
  assert.equal(p.leaderShield.normal,0)
  assert.equal(p.leaderHealth,18)
})

test('C049 ディオナ：同じ敵を2回選択できず、敵1体なら1体を選択できる',()=>{
  let state=startedGame()
  const diona=place(state,0,'C049',2,4)
  state.players[0].pp=2
  const a=place(state,1,'C001',1,8)
  const b=place(state,1,'C001',1,8)
  assert.equal(engine.activateAbility(state,diona.instanceId,'skill',
    a.instanceId + '|' + a.instanceId),state)
  assert.equal(engine.activateAbility(state,diona.instanceId,'skill',a.instanceId),state)
  state.players[1].field=state.players[1].field.filter(f=>f.instanceId!==b.instanceId)
  const next=engine.activateAbility(state,diona.instanceId,'skill',a.instanceId)
  assert.equal(next.players[1].field[0].health,6)
})

test('STEP34 雷元素15枚のカードID・二つ名・PP・レアリティを原本に照合',async()=>{
  const {electroCards}=await vite.ssrLoadModule('/src/data/cards/electro.ts')
  assert.deepEqual(electroCards.map(c=>c.id),
    Array.from({length:15},(_,i)=>'C'+String(i+56).padStart(3,'0')))
  assert.deepEqual(electroCards.map(c=>c.name),[
    '雷スライム','グルグル雷キノコン','ライノ仔竜','雷フライム',
    '夜の幻現','御詠鳴神刈山祭','ファデュイ・雷蛍術師','獣域ハウンド・雷',
    '断罪の皇女・フィッシュル','荒瀧派の二番手・久岐忍',
    '天領奉行の大将・九条裟羅','謎煙の主の青年・オロルン',
    '大マハマトラ・セノ','鳴神大社の宮司・八重神子',
    'のんびり屋の力自慢・ヴァレサ',
  ])
  assert.deepEqual(electroCards.map(c=>c.cost),[1,2,2,3,4,3,4,4,3,3,4,3,5,5,5])
  assert.deepEqual(electroCards.map(c=>c.rarity),[
    ...Array(4).fill('bronze'),...Array(4).fill('silver'),
    ...Array(4).fill('gold'),...Array(3).fill('legendary')])
  assert.ok(electroCards.every(c=>c.element==='electro'))
})

test('STEP34 雷15枚ステータス・地域・タイプ・対戦実装区分',async()=>{
  const {electroCards}=await vite.ssrLoadModule('/src/data/cards/electro.ts')
  assert.deepEqual(electroCards.map(c=>c.type),[
    'follower','follower','follower','follower','spell','spell',
    'follower','follower','follower','follower','follower','follower',
    'follower','follower','follower'])
  assert.deepEqual(electroCards.filter(c=>c.type==='follower').map(c=>[c.attack,c.health]),[
    [2,2],[1,3],[2,2],[2,3],[2,4],[3,3],
    [2,3],[2,4],[3,4],[2,4],[4,5],[3,5],[5,5]])
  assert.deepEqual(electroCards.filter(c=>c.implementationStatus==='playable').map(c=>c.id),
    electroCards.map(c=>c.id))
  assert.deepEqual(electroCards.find(c=>c.id==='C067').traits,['謎煙の主'])
  assert.deepEqual(electroCards.find(c=>c.id==='C070').traits,['豊穣の邦'])
})

test('STEP34 正式85/115、雷15枚の予定枠充足、残り30枚',async()=>{
  const {productionCards}=await vite.ssrLoadModule('/src/data/productionCards.ts')
  const {validateProductionCards}=await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const validation=validateProductionCards(productionCards)
  assert.deepEqual(validation.errors,[])
  assert.equal(validation.total,115)
  assert.equal(validation.slots.filter(s=>s.element==='electro').reduce((n,s)=>n+s.remaining,0),0)
  assert.equal(validation.slots.reduce((n,s)=>n+s.remaining,0),0)
})

test('STEP35 雷元素15枚すべて対戦対応しデッキに含める',async()=>{
  const {getDeckCardPool}=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const pool=new Set(getDeckCardPool().map(c=>c.id))
  for(let i=56;i<=70;i++){
    const id='C'+String(i).padStart(3,'0')
    assert.equal(pool.has(id),engine.getCard(id).implementationStatus==='playable')
  }
  const state=startedGame()
  state.players[0].pp=10
  state.players[0].hand=['C061','C064','C065','C066','C067','C068','C069','C070']
  assert.ok(state.players[0].hand.every((_,i)=>engine.canPlayCard(state,i)))
})

test('C056 雷スライムは元素生物として初期雷付着を維持',()=>{
  let state=startedGame()
  state.players[0].hand=['C056'];state.players[0].pp=1
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].field[0].health,2)
  assert.deepEqual(state.players[0].field[0].aura,[{element:'electro'}])
})

test('C057 雷キノコン：ラストワードでランダムな敵1体へ雷2・付着',()=>{
  let state=startedGame()
  const mushroom=place(state,0,'C057',1,1)
  const victim=place(state,1,'C001',2,8)
  state=engine.attackFollower(state,mushroom.instanceId,victim.instanceId)
  assert.ok(state.players[0].graveyard.includes('C057'))
  assert.equal(state.players[1].field[0].health,5)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'electro'}])
})

test('C057 雷キノコン：相手フォロワー不在のラストワードはリーダーを攻撃しない',()=>{
  let state=startedGame()
  const mushroom=place(state,0,'C057',1,1)
  const attacker=place(state,1,'C001',2,8)
  const enemyTurn={...state,currentPlayerId:'player2'}
  state=engine.attackFollower(enemyTurn,attacker.instanceId,mushroom.instanceId)
  assert.equal(state.players[0].field.length,0)
  assert.equal(state.players[1].leaderHealth,20)
})

test('C058 ライノ仔竜：突進で登場ターンはリーダーに攻撃不可',()=>{
  let state=startedGame()
  state.players[0].hand=['C058'];state.players[0].pp=2
  state=engine.playCard(state,'player1',0)
  const rhino=state.players[0].field[0]
  assert.equal(engine.attackLeader(state,rhino.instanceId),state)
  const foe=place(state,1,'C001',1,8)
  state=engine.attackFollower(state,rhino.instanceId,foe.instanceId)
  assert.equal(state.players[1].field[0].health,6)
})

test('C059 雷フライム：常時雷付着、破壊時相手リーダーに雷2',()=>{
  let state=startedGame()
  state.players[0].hand=['C059'];state.players[0].pp=3
  state=engine.playCard(state,'player1',0)
  const float=state.players[0].field[0]
  assert.deepEqual(float.aura,[{element:'electro'}])
  float.health=1
  const attacker=place(state,1,'C001',3,8)
  state=engine.attackFollower({...state,currentPlayerId:'player2'},attacker.instanceId,float.instanceId)
  assert.equal(state.players[1].leaderHealth,18)
  assert.ok(state.players[0].graveyard.includes('C059'))
})

test('C059 雷フライムのラストワードはリーダーシールドを先に消費',()=>{
  let state=startedGame()
  const float=place(state,0,'C059',2,1)
  const attacker=place(state,1,'C001',3,8)
  state.players[1].leaderShield={normal:2,crystallize:0}
  state=engine.attackFollower({...state,currentPlayerId:'player2'},attacker.instanceId,float.instanceId)
  assert.equal(state.players[1].leaderHealth,20)
  assert.equal(state.players[1].leaderShield.normal,0)
})

test('C060 夜の幻現：選択した敵に雷3、その後オズ3/3召喚',()=>{
  let state=startedGame()
  state.players[0].hand=['C060'];state.players[0].pp=4
  const enemy=place(state,1,'C001',1,8)
  assert.equal(engine.needsPlayTarget(engine.getCard('C060')),true)
  state=engine.playCard(state,'player1',0,enemy.instanceId)
  assert.equal(state.players[1].field[0].health,5)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'electro'}])
  assert.deepEqual(state.players[0].field.map(f=>[f.cardId,f.attack,f.health]),
    [['token-oz',3,3]])
  assert.deepEqual(state.players[0].graveyard,['C060'])
})

test('C060 夜の幻現：敵無しではプレイ不可、場満員ならオズ召喚なし',()=>{
  let state=startedGame()
  state.players[0].hand=['C060'];state.players[0].pp=4
  assert.equal(engine.canPlayCard(state,0),false)
  for(let i=0;i<5;i++)place(state,0,'C001',1,2)
  const enemy=place(state,1,'C001',1,8)
  state=engine.playCard(state,'player1',0,enemy.instanceId)
  assert.equal(state.players[0].field.length,5)
  assert.equal(state.players[1].field[0].health,5)
})

test('オズは毎自ターン終了時にランダムな敵1体へ雷3',()=>{
  let state=startedGame()
  place(state,0,'token-oz',3,3)
  place(state,1,'C001',1,10)
  state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,7)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'electro'}])
})

test('C062 雷蛍術師：登場時に雷蛍1/1を2体召喚',()=>{
  let state=startedGame()
  state.players[0].hand=['C062'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0)
  assert.deepEqual(state.players[0].field.map(f=>f.cardId),
    ['C062','token-electro-cicin','token-electro-cicin'])
  assert.deepEqual(state.players[0].field.slice(1).map(f=>[f.attack,f.health]),[[1,1],[1,1]])
  assert.equal(engine.getCard('token-electro-cicin').normalAttackElement,'electro')
})

test('C062 雷蛍術師：雷蛍がいるターン終了時のみシールド2を得る',()=>{
  let state=startedGame()
  const mage=place(state,0,'C062',2,4)
  state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].shield.normal,0)
  place(state,0,'token-electro-cicin',1,1)
  state=engine.endTurn(state);state=engine.endTurn(state)
  assert.equal(state.players[0].field.find(f=>f.instanceId===mage.instanceId).shield.normal,2)
})

test('C062 雷蛍術師は最大5枠を超えて雷蛍を召喚しない',()=>{
  let state=startedGame()
  state.players[0].hand=['C062'];state.players[0].pp=4
  for(let i=0;i<3;i++)place(state,0,'C001',1,2)
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].field.length,5)
  assert.equal(state.players[0].field.filter(f=>f.cardId==='token-electro-cicin').length,1)
})

test('C063 雷ハウンド：通常攻撃は雷、攻撃宣言時に敵リーダーへ非元素1',()=>{
  let state=startedGame()
  const hound=place(state,0,'C063',3,3)
  const enemy=place(state,1,'C001',0,10)
  state=engine.attackFollower(state,hound.instanceId,enemy.instanceId)
  assert.equal(state.players[1].leaderHealth,19)
  assert.equal(state.players[1].field[0].health,7)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'electro'}])
})

test('C063 雷ハウンドは敵リーダー攻撃で本体3＋追加1ダメージ',()=>{
  let state=startedGame()
  const hound=place(state,0,'C063',3,3)
  state=engine.attackLeader(state,hound.instanceId)
  assert.equal(state.players[1].leaderHealth,16)
})

test('雷蛍とオズは正式15枚に含まずデッキに入らない',async()=>{
  const {getDeckCardPool}=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  assert.equal(engine.getCard('token-electro-cicin').token,true)
  assert.equal(engine.getCard('token-oz').token,true)
  assert.equal(getDeckCardPool().some(c=>c.id==='token-oz' || c.id==='token-electro-cicin'),false)
})

test('STEP35 雷元素全15枚がplayable・ゴールドとレジェンドのPP/ENは確定値',async()=>{
  const {electroCards}=await vite.ssrLoadModule('/src/data/cards/electro.ts')
  assert.equal(electroCards.length,15)
  assert.ok(electroCards.every(c=>c.implementationStatus==='playable'))
  const ids=['C064','C065','C066','C067','C068','C069','C070']
  assert.deepEqual(ids.map(id=>engine.getCard(id).elementalSkill.ppCost),[2,1,1,1,1,1,1])
  assert.deepEqual(['C068','C069','C070'].map(id=>engine.getCard(id).elementalBurst.energyCost),[3,3,3])
})

test('C061 御詠鳴神刈山祭：リーダーHP11ならランダム雷1を3回',()=>{
  let state=startedGame()
  state.players[0].hand=['C061'];state.players[0].pp=3
  state.players[0].leaderHealth=11
  place(state,1,'C001',0,10)
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[1].field[0].health,7)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'electro'}])
  assert.ok(state.players[0].graveyard.includes('C061'))
})

test('C061 御詠鳴神刈山祭：リーダーHP10以下なら雷1を5回',()=>{
  let state=startedGame()
  state.players[0].hand=['C061'];state.players[0].pp=3
  state.players[0].leaderHealth=10
  place(state,1,'C001',0,12)
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[1].field[0].health,7)
})

test('C061 御詠鳴神刈山祭：敵が存在しない場合は相手リーダーを傷つけない',()=>{
  let state=startedGame()
  state.players[0].hand=['C061'];state.players[0].pp=3
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[1].leaderHealth,20)
  assert.deepEqual(state.players[0].graveyard,['C061'])
})

test('C064 フィッシュル：スキルPP2でオズを召喚、EN1獲得',()=>{
  let state=startedGame()
  const fischl=place(state,0,'C064',2,3)
  state.players[0].pp=2
  state=engine.activateAbility(state,fischl.instanceId,'skill')
  assert.deepEqual(state.players[0].field.map(f=>f.cardId),['C064','token-oz'])
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
})

test('C064 フィッシュル：終了時にオズへ潜伏を付ける',()=>{
  let state=startedGame()
  place(state,0,'C064',2,3)
  place(state,0,'token-oz',3,3)
  state=engine.endTurn(state)
  assert.ok(state.players[0].field[1].keywords.includes('stealth'))
})

test('C065 久岐忍：ターン終了時リーダーを1回復',()=>{
  let state=startedGame()
  state.players[0].leaderHealth=16
  place(state,0,'C065',2,4)
  state=engine.endTurn(state)
  assert.equal(state.players[0].leaderHealth,17)
})

test('C065 久岐忍：スキルPP1で自身1ダメージ・リーダー2回復・敵雷1',()=>{
  let state=startedGame()
  const kuki=place(state,0,'C065',2,4)
  state.players[0].pp=1;state.players[0].leaderHealth=10
  place(state,1,'C001',0,7)
  state=engine.activateAbility(state,kuki.instanceId,'skill')
  assert.equal(state.players[0].field[0].health,3)
  assert.equal(state.players[0].leaderHealth,12)
  assert.equal(state.players[1].field[0].health,6)
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[0].pp,0)
})

test('C066 九条裟羅：ファンファーレは他の雷フォロワー+1攻撃',()=>{
  let state=startedGame()
  const other=place(state,0,'C056',2,2)
  const unrelated=place(state,0,'C001',1,2)
  state.players[0].hand=['C066'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0,other.instanceId)
  assert.equal(state.players[0].field[0].attack,3)
  assert.equal(state.players[0].field[1].attack,1)
  assert.equal(state.players[0].field[2].attack,3)
  assert.equal(state.players[0].field[1].instanceId,unrelated.instanceId)
})

test('C066 九条裟羅：スキル対象の雷フォロワー+2攻撃、敵ランダム雷1',()=>{
  let state=startedGame()
  const sara=place(state,0,'C066',3,4)
  const ally=place(state,0,'C056',2,2)
  place(state,1,'C001',0,6)
  state.players[0].pp=1
  assert.equal(engine.activateAbility(state,sara.instanceId,'skill','invalid'),state)
  state=engine.activateAbility(state,sara.instanceId,'skill',ally.instanceId)
  assert.equal(state.players[0].field[1].attack,4)
  assert.equal(state.players[1].field[0].health,5)
  assert.equal(state.players[0].energy,1)
})

test('C067 オロルン：スキルで指定敵雷2、別の敵に雷1',()=>{
  let state=startedGame()
  const ororon=place(state,0,'C067',2,4)
  const one=place(state,1,'C001',0,9)
  const two=place(state,1,'C001',0,9)
  state.players[0].pp=1
  state=engine.activateAbility(state,ororon.instanceId,'skill',one.instanceId)
  assert.equal(state.players[1].field[0].health,7)
  assert.equal(state.players[1].field[1].health,8)
  assert.equal(state.players[1].field[1].instanceId,two.instanceId)
})

test('C067 オロルン：別対象がいなければ指定敵のみ雷2',()=>{
  let state=startedGame()
  const ororon=place(state,0,'C067',2,4)
  const one=place(state,1,'C001',0,9)
  state.players[0].pp=1
  state=engine.activateAbility(state,ororon.instanceId,'skill',one.instanceId)
  assert.equal(state.players[1].field[0].health,7)
})

test('C067 オロルン：自ターン感電で追加雷1、回数は最大2',async()=>{
  const {resolveElementalDamage,resolveReactionConsequence}=await vite.ssrLoadModule('/src/game/elemental.ts')
  let state=startedGame()
  const ororon=place(state,0,'C067',2,4)
  const enemy=place(state,1,'C001',0,15)
  const other=place(state,1,'C001',0,12)
  for(let n=0;n<3;n++){
    state.players[1].field.find(f=>f.instanceId===enemy.instanceId).aura=[{element:'hydro'}]
    const victim=state.players[1].field.find(f=>f.instanceId===enemy.instanceId)
    const r=resolveElementalDamage(victim,1,'electro')
    state.players[1].field=state.players[1].field.map(f=>f.instanceId===enemy.instanceId?r.follower:f)
    state=resolveReactionConsequence(state,1,enemy.instanceId,r.reaction,r.reactedElement,0)
  }
  assert.equal(state.players[0].field.find(f=>f.instanceId===ororon.instanceId).electroChargedTriggersThisTurn,2)
  assert.ok(state.players[1].field.find(f=>f.instanceId===other.instanceId).health<=9)
})

test('C068 セノ：スキル敵雷2、爆発EN3で自身+2/+2と2回攻撃・雷攻撃',()=>{
  let state=startedGame()
  const cyno=place(state,0,'C068',4,5)
  const enemy=place(state,1,'C001',0,12)
  state.players[0].pp=1;state.players[0].energy=3
  state=engine.activateAbility(state,cyno.instanceId,'skill',enemy.instanceId)
  assert.equal(state.players[1].field[0].health,10)
  state=engine.activateAbility(state,cyno.instanceId,'burst')
  const result=state.players[0].field[0]
  assert.deepEqual([result.attack,result.health,result.maxHealth],[6,7,7])
  assert.ok(result.keywords.includes('double_attack'))
  assert.ok(result.keywords.includes('normal_attack_electro'))
  assert.equal(state.players[0].energy,1)
})

test('C069 八重神子：PP1スキルを1ターン3回、殺生櫻を3個設置',()=>{
  let state=startedGame()
  const yae=place(state,0,'C069',3,5)
  state.players[0].pp=3
  for(let i=0;i<3;i++){
    assert.equal(engine.canUseAbility(state,yae.instanceId,'skill'),true)
    state=engine.activateAbility(state,yae.instanceId,'skill')
  }
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,3)
  assert.equal(state.players[0].field[0].skillUsesThisTurn,3)
  assert.equal(state.players[0].amulets.length,3)
  assert.equal(engine.canUseAbility(state,yae.instanceId,'skill'),false)
})

test('殺生櫻：ターン終了でランダム雷2、カウント3から0で消滅',()=>{
  let state=startedGame()
  state.players[0].amulets=[{instanceId:'sakura-1',cardId:'token-sesshou-sakura',turnsRemaining:3}]
  place(state,1,'C001',0,12)
  state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,10)
  assert.equal(state.players[0].amulets[0].turnsRemaining,2)
  for(let i=0;i<4;i++)state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,6)
  assert.deepEqual(state.players[0].amulets,[])
})

test('C069 八重神子：爆発で敵全体雷3後、殺生櫻を破壊して雷2を個数分',()=>{
  let state=startedGame()
  const yae=place(state,0,'C069',3,5)
  state.players[0].energy=3
  state.players[0].amulets=[
    {instanceId:'a',cardId:'token-sesshou-sakura',turnsRemaining:3},
    {instanceId:'b',cardId:'token-sesshou-sakura',turnsRemaining:2},
  ]
  state=engine.activateAbility(state,yae.instanceId,'burst')
  assert.equal(state.players[0].energy,0)
  assert.equal(state.players[0].amulets.length,0)
  assert.equal(state.players[1].leaderHealth,16)
})

test('C070 ヴァレサ：攻撃時自身+1、スキルPP1で雷攻撃・落下攻撃を付与',()=>{
  let state=startedGame()
  const varesa=place(state,0,'C070',5,5)
  state.players[0].pp=1
  state=engine.activateAbility(state,varesa.instanceId,'skill')
  assert.ok(state.players[0].field[0].keywords.includes('plunge_attack'))
  assert.ok(state.players[0].field[0].keywords.includes('normal_attack_electro'))
  place(state,1,'C001',0,12)
  state=engine.attackFollower(state,varesa.instanceId,state.players[1].field[0].instanceId)
  assert.equal(state.players[0].field[0].attack,6)
  assert.equal(state.players[1].field[0].health,5)
})

test('C070 ヴァレサ：落下攻撃は守護を無視して攻撃し攻撃後に敵全体へ雷1',()=>{
  let state=startedGame()
  const varesa=place(state,0,'C070',5,5)
  varesa.keywords=['normal_attack_electro','plunge_attack']
  const guard=place(state,1,'C003',0,9)
  guard.keywords=['guard']
  const other=place(state,1,'C001',0,10)
  state=engine.attackFollower(state,varesa.instanceId,other.instanceId)
  assert.equal(state.players[1].field.find(f=>f.instanceId===guard.instanceId).health,8)
  assert.equal(state.players[1].field.find(f=>f.instanceId===other.instanceId).health,3)
})

test('C070 ヴァレサ：爆発EN3で敵全体雷3＋自身攻撃+2',()=>{
  let state=startedGame()
  const varesa=place(state,0,'C070',5,5)
  state.players[0].energy=3
  place(state,1,'C001',0,9)
  state=engine.activateAbility(state,varesa.instanceId,'burst')
  assert.equal(state.players[1].field[0].health,6)
  assert.equal(state.players[0].field[0].attack,7)
  assert.equal(state.players[0].energy,0)
})

test('殺生櫻はトークンであり通常デッキへ混入しない',async()=>{
  const {getDeckCardPool}=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const sakura=engine.getCard('token-sesshou-sakura')
  assert.equal(sakura.type,'amulet')
  assert.equal(sakura.token,true)
  assert.equal(getDeckCardPool().some(c=>c.id===sakura.id),false)
})

test('C066 九条裟羅：他に雷フォロワーがいない場合はファンファーレをスキップして召喚可能',()=>{
  let state=startedGame()
  state.players[0].hand=['C066'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].field[0].cardId,'C066')
  assert.equal(state.players[0].field[0].attack,3)
})

test('C069 八重神子：場が5枠埋まっている場合はスキル不発でPPとENを保持',()=>{
  let state=startedGame()
  const yae=place(state,0,'C069',3,5)
  for(let i=0;i<4;i++)place(state,0,'C001',1,2)
  state.players[0].pp=5
  assert.equal(engine.canUseAbility(state,yae.instanceId,'skill'),false)
  assert.equal(engine.activateAbility(state,yae.instanceId,'skill'),state)
  assert.equal(state.players[0].energy,0)
  assert.equal(state.players[0].pp,5)
})

test('C069 八重神子：次の自分のターンにはスキル使用回数がリセットされる',()=>{
  let state=startedGame()
  const yae=place(state,0,'C069',3,5)
  state.players[0].pp=2
  state=engine.activateAbility(state,yae.instanceId,'skill')
  assert.equal(state.players[0].field[0].skillUsesThisTurn,1)
  state=engine.endTurn(state);state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].skillUsesThisTurn,0)
  assert.equal(engine.canUseAbility(state,yae.instanceId,'skill'),true)
})

test('C067 オロルン：次の自分ターンに感電回数制限がリセットされる',()=>{
  let state=startedGame()
  const ororon=place(state,0,'C067',2,4)
  ororon.electroChargedTriggersThisTurn=2
  state=engine.endTurn(state);state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].electroChargedTriggersThisTurn,0)
})

test('STEP36 風元素C071-C085のカード名・コスト・レアリティを原本と照合',async()=>{
  const {anemoCards}=await vite.ssrLoadModule('/src/data/cards/anemo.ts')
  assert.deepEqual(anemoCards.map(c=>c.id),Array.from({length:15},(_,i)=>'C'+String(i+71).padStart(3,'0')))
  assert.deepEqual(anemoCards.map(c=>c.name),[
    '風スライム','モンド城','クク仔竜','風フライム',
    '魔術・アストニシングシフト','禁・風霊作成・七五同構弐型',
    'ヒルチャールレンジャー・風','ファデュイ・烈風の従者',
    '生物錬金術師・スクロース','終末番の忍者・早柚',
    '百年の先輩・ファルザン','綺影のエレガンス・リネット',
    '北風騎士・ファルカ','護法夜叉・魈','久世浮傾・放浪者',
  ])
  assert.deepEqual(anemoCards.map(c=>c.cost),[1,2,2,3,4,4,5,6,3,3,4,3,8,5,5])
  assert.deepEqual(anemoCards.map(c=>c.rarity),[
    ...Array(4).fill('bronze'),...Array(4).fill('silver'),
    ...Array(4).fill('gold'),...Array(3).fill('legendary')])
  assert.ok(anemoCards.every(c=>c.element==='anemo'))
})

test('STEP36 風15枚のカードタイプ・ステータス・地域・対戦対応状況',async()=>{
  const {anemoCards}=await vite.ssrLoadModule('/src/data/cards/anemo.ts')
  assert.deepEqual(anemoCards.map(c=>c.type),[
    'follower','amulet','follower','follower','spell','amulet',
    'follower','follower','follower','follower','follower','follower',
    'follower','follower','follower'])
  assert.deepEqual(anemoCards.filter(c=>c.type==='follower').map(c=>[c.attack,c.health]),[
    [2,2],[2,2],[2,3],[4,4],[5,5],[2,3],[2,4],[2,4],[2,3],
    [4,7],[4,5],[3,5]])
  assert.deepEqual(anemoCards.find(c=>c.id==='C083').traits,['西風騎士団'])
  assert.deepEqual(anemoCards.find(c=>c.id==='C084').traits,['仙人'])
  assert.deepEqual(anemoCards.filter(c=>c.implementationStatus==='playable').map(c=>c.id),
    anemoCards.map(c=>c.id))
})

test('STEP36 登録は100/115・風元素15枚の枠を充足・残り15枚',async()=>{
  const {productionCards}=await vite.ssrLoadModule('/src/data/productionCards.ts')
  const {validateProductionCards}=await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const report=validateProductionCards(productionCards)
  assert.deepEqual(report.errors,[])
  assert.equal(report.total,115)
  assert.equal(report.slots.filter(s=>s.element==='anemo').reduce((n,s)=>n+s.remaining,0),0)
  assert.equal(report.slots.reduce((n,s)=>n+s.remaining,0),0)
})

test('STEP37 風元素15枚すべてデッキ候補へ',async()=>{
  const {getDeckCardPool}=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const {anemoCards}=await vite.ssrLoadModule('/src/data/cards/anemo.ts')
  const pool=new Set(getDeckCardPool().map(c=>c.id))
  for(const c of anemoCards)assert.equal(pool.has(c.id),c.implementationStatus==='playable')
  const state=startedGame()
  state.players[0].pp=10
  state.players[0].hand=['C075','C076','C078','C079','C081','C083','C084','C085']
  assert.ok(state.players[0].hand.every(id=>engine.getCard(id).implementationStatus==='playable'))
})

test('C071 風スライムは風元素生物として常時付着状態で出る',()=>{
  let state=startedGame()
  state.players[0].pp=1;state.players[0].hand=['C071']
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].field[0].health,2)
  assert.deepEqual(state.players[0].field[0].aura,[{element:'anemo'}])
})

test('C072 モンド城は2PPで場のアミュレット枠を1つ占有し、カウント3',()=>{
  let state=startedGame()
  state.players[0].hand=['C072'];state.players[0].pp=2
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].amulets.length,1)
  assert.equal(state.players[0].amulets[0].cardId,'C072')
  assert.equal(state.players[0].amulets[0].turnsRemaining,3)
  assert.deepEqual(state.players[0].hand,[])
})

test('C072 モンド城は自分のターン終了時に地域モンドのカードをランダム1枚サーチ',()=>{
  let state=startedGame()
  state.players[0].pp=2;state.players[0].hand=['C072']
  state.players[0].deck=['C001','C027','C019','C073']
  state=engine.playCard(state,'player1',0)
  state=engine.endTurn(state)
  assert.deepEqual(state.players[0].hand,['C019'])
  assert.deepEqual(state.players[0].deck,['C001','C027','C073'])
  assert.equal(state.players[0].amulets[0].turnsRemaining,2)
})

test('C072 モンド城は3回ターン終了で消滅・サーチ対象無しでも減少する',()=>{
  let state=startedGame()
  state.players[0].pp=2;state.players[0].hand=['C072']
  state.players[0].deck=Array(10).fill('C001')
  state=engine.playCard(state,'player1',0)
  for(let i=0;i<5;i++)state=engine.endTurn(state)
  assert.deepEqual(state.players[0].amulets,[])
  // 通常ドロー2回分は手札に入る。モンド城によるサーチは0回。
  assert.deepEqual(state.players[0].hand,['C001','C001'])
  assert.equal(state.players[0].deck.length,8)
})

test('C072 モンド城は場が埋まっていればプレイ不可',()=>{
  const state=startedGame()
  state.players[0].pp=2;state.players[0].hand=['C072']
  for(let i=0;i<5;i++)place(state,0,'C001',1,2)
  assert.equal(engine.canPlayCard(state,0),false)
  assert.equal(engine.playCard(state,'player1',0),state)
})

test('C073 クク仔竜の突進は登場ターンのフォロワー攻撃のみ可能',()=>{
  let state=startedGame()
  state.players[0].pp=2;state.players[0].hand=['C073']
  state=engine.playCard(state,'player1',0)
  const kuku=state.players[0].field[0]
  assert.equal(engine.attackLeader(state,kuku.instanceId),state)
  const enemy=place(state,1,'C001',0,7)
  state=engine.attackFollower(state,kuku.instanceId,enemy.instanceId)
  assert.equal(state.players[1].field[0].health,5)
})

test('C074 風フライムは風元素常時付着・破壊時リーダー2ダメージ',()=>{
  let state=startedGame()
  state.players[0].pp=3;state.players[0].hand=['C074']
  state=engine.playCard(state,'player1',0)
  const specter=state.players[0].field[0]
  assert.deepEqual(specter.aura,[{element:'anemo'}])
  specter.health=1
  const enemy=place(state,1,'C001',3,8)
  state=engine.attackFollower({...state,currentPlayerId:'player2'},enemy.instanceId,specter.instanceId)
  assert.equal(state.players[1].leaderHealth,18)
  assert.ok(state.players[0].graveyard.includes('C074'))
})

test('C074 風フライムのラストワードはリーダーシールドを先に消費',()=>{
  let state=startedGame()
  const specter=place(state,0,'C074',2,1)
  const enemy=place(state,1,'C001',3,8)
  state.players[1].leaderShield={normal:2,crystallize:0}
  state=engine.attackFollower({...state,currentPlayerId:'player2'},enemy.instanceId,specter.instanceId)
  assert.equal(state.players[1].leaderHealth,20)
  assert.equal(state.players[1].leaderShield.normal,0)
})

test('C077 風レンジャーは突進し攻撃時にヒルチャールを1体召喚',()=>{
  let state=startedGame()
  state.players[0].pp=5;state.players[0].hand=['C077']
  state=engine.playCard(state,'player1',0)
  const ranger=state.players[0].field[0]
  assert.equal(engine.attackLeader(state,ranger.instanceId),state)
  const enemy=place(state,1,'C001',0,10)
  state=engine.attackFollower(state,ranger.instanceId,enemy.instanceId)
  assert.deepEqual(state.players[0].field.map(f=>f.cardId),['C077','C001'])
  assert.equal(state.players[1].field[0].health,6)
})

test('C077 風レンジャーは場が5枠でも攻撃できるが追加召喚しない',()=>{
  let state=startedGame()
  const ranger=place(state,0,'C077',4,4)
  for(let i=0;i<4;i++)place(state,0,'C001',1,2)
  const foe=place(state,1,'C001',0,10)
  state=engine.attackFollower(state,ranger.instanceId,foe.instanceId)
  assert.equal(state.players[0].field.length,5)
  assert.equal(state.players[1].field[0].health,6)
})

test('C080 早柚は潜伏を持ちスキルPP1で風2・自身攻撃+1',()=>{
  let state=startedGame()
  state.players[0].pp=3;state.players[0].hand=['C080']
  state=engine.playCard(state,'player1',0)
  const sayu=state.players[0].field[0]
  assert.ok(sayu.keywords.includes('stealth'))
  const foe=place(state,1,'C001',0,8)
  state.players[0].pp=1
  state=engine.activateAbility(state,sayu.instanceId,'skill',foe.instanceId)
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[1].field[0].health,6)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'anemo'}].filter(()=>false))
  assert.equal(state.players[0].field[0].attack,3)
  assert.ok(state.players[0].field[0].keywords.includes('stealth'))
})

test('C082 リネットは突進・登場時デッキから風元素スペル1枚サーチ',()=>{
  let state=startedGame()
  state.players[0].pp=3;state.players[0].hand=['C082']
  state.players[0].deck=['C001','C045','C075','C060']
  state=engine.playCard(state,'player1',0)
  assert.ok(state.players[0].field[0].keywords.includes('rush'))
  assert.deepEqual(state.players[0].hand,['C075'])
  assert.deepEqual(state.players[0].deck,['C001','C045','C060'])
})

test('C082 リネットの元素スキルはPP1・風2ダメージ・自身1回復',()=>{
  let state=startedGame()
  const lynette=place(state,0,'C082',2,2)
  lynette.maxHealth=3
  state.players[0].pp=1
  const enemy=place(state,1,'C001',0,8)
  state=engine.activateAbility(state,lynette.instanceId,'skill',enemy.instanceId)
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[0].field[0].health,3)
  assert.equal(state.players[1].field[0].health,6)
})

test('C082 リネットはデッキに風スペルが無くてもプレイ可能でデッキ切れ敗北しない',()=>{
  let state=startedGame()
  state.players[0].pp=3;state.players[0].hand=['C082'];state.players[0].deck=[]
  state=engine.playCard(state,'player1',0)
  assert.equal(state.winnerId,null)
  assert.equal(state.players[0].field[0].cardId,'C082')
})

test('STEP37 風15枚の対戦実装とレジェンドのスキル・爆発コスト',async()=>{
  const {anemoCards}=await vite.ssrLoadModule('/src/data/cards/anemo.ts')
  assert.equal(anemoCards.length,15)
  assert.ok(anemoCards.every(c=>c.implementationStatus==='playable'))
  assert.deepEqual(['C079','C081','C083','C084','C085'].map(id=>engine.getCard(id).elementalSkill.ppCost),[1,1,0,1,1])
  assert.deepEqual(['C083','C084','C085'].map(id=>engine.getCard(id).elementalBurst.energyCost),[3,4,3])
})

test('C075 魔術・アストニシングシフトは守護0/8の猫ボックストークンを召喚',()=>{
  let state=startedGame()
  state.players[0].hand=['C075'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0)
  assert.deepEqual(state.players[0].field.map(f=>[f.cardId,f.attack,f.health]),
    [['token-surprising-cat-box',0,8]])
  assert.ok(state.players[0].field[0].keywords.includes('guard'))
  assert.ok(state.players[0].graveyard.includes('C075'))
})

test('ビックラキャット・ボックスは自ターン終了時にランダムな敵に風2',()=>{
  let state=startedGame()
  place(state,0,'token-surprising-cat-box',0,8)
  place(state,1,'C001',1,9)
  state=engine.endTurn(state)
  assert.equal(state.players[1].field[0].health,7)
})

test('C076 禁・風霊作成・七五同構弐型は4PP、カウント3の風アミュレット',()=>{
  let state=startedGame()
  state.players[0].hand=['C076'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].amulets.length,1)
  assert.equal(state.players[0].amulets[0].cardId,'C076')
  assert.equal(state.players[0].amulets[0].turnsRemaining,3)
  assert.equal(state.players[0].pp,0)
})

test('C076 初回拡散元素を記録し、風1と記録元素1の全体ダメージ',()=>{
  let state=startedGame()
  state.players[0].hand=['C076'];state.players[0].pp=4
  const enemy=place(state,1,'C001',0,12)
  enemy.aura=[{element:'pyro'}]
  state=engine.playCard(state,'player1',0)
  state=engine.endTurn(state)
  assert.equal(state.players[0].amulets[0].recordedElement,'pyro')
  assert.equal(state.players[1].field[0].health,10)
})

test('C076 初回拡散が無い場合は付加元素を記録しない',()=>{
  let state=startedGame()
  state.players[0].hand=['C076'];state.players[0].pp=4
  place(state,1,'C001',0,12)
  state=engine.playCard(state,'player1',0)
  state=engine.endTurn(state)
  assert.equal(state.players[0].amulets[0].recordedElement,undefined)
  assert.equal(state.players[1].field[0].health,11)
})

test('C078 ファデュイ烈風の従者は登場時に敵リーダー命の契約3',()=>{
  let state=startedGame()
  state.players[0].hand=['C078'];state.players[0].pp=6
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[1].bondOfLife,3)
  assert.equal(engine.getCard('C078').normalAttackElement,'anemo')
})

test('命の契約3は回復を先に吸収し、残りでリーダー回復',async()=>{
  const {healLeader}=await vite.ssrLoadModule('/src/game/leaderShield.ts')
  let player=startedGame().players[0]
  player.leaderHealth=10
  player.bondOfLife=3
  player=healLeader(player,2)
  assert.equal(player.leaderHealth,10)
  assert.equal(player.bondOfLife,1)
  player=healLeader(player,3)
  assert.equal(player.bondOfLife,0)
  assert.equal(player.leaderHealth,12)
})

test('C078 烈風の従者：双方ターン終了時に契約が残る敵リーダーへ1',()=>{
  let state=startedGame()
  place(state,0,'C078',5,5)
  state.players[1].bondOfLife=3
  state=engine.endTurn(state)
  assert.equal(state.players[1].leaderHealth,19)
  state=engine.endTurn(state)
  assert.equal(state.players[1].leaderHealth,18)
})

test('C079 スクロース：スキルPP1で敵全体に風1',()=>{
  let state=startedGame()
  const sucrose=place(state,0,'C079',2,3)
  state.players[0].pp=1
  place(state,1,'C001',0,9)
  place(state,1,'C001',0,8)
  state=engine.activateAbility(state,sucrose.instanceId,'skill')
  assert.deepEqual(state.players[1].field.map(f=>f.health),[8,7])
  assert.equal(state.players[0].energy,1)
})

test('C079 スクロース：拡散時に自ターン1回ドロー',()=>{
  let state=startedGame()
  const sucrose=place(state,0,'C079',2,3)
  const enemy=place(state,1,'C001',0,12)
  enemy.aura=[{element:'pyro'}]
  state.players[0].deck=['C001','C071']
  state.players[0].hand=[]
  state.players[0].pp=1
  state=engine.activateAbility(state,sucrose.instanceId,'skill')
  assert.deepEqual(state.players[0].hand,['C001'])
  assert.equal(state.players[0].field[0].swirlDrawsThisTurn,1)
  assert.deepEqual(state.players[0].deck,['C071'])
})

test('C081 ファルザンのファンファーレは他の風元素味方を+1攻撃',()=>{
  let state=startedGame()
  const other=place(state,0,'C071',2,2)
  state.players[0].hand=['C081'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0,other.instanceId)
  assert.equal(state.players[0].field[0].attack,3)
  assert.equal(state.players[0].field[1].attack,2)
})

test('C081 ファルザンは他の風元素味方がいなければファンファーレ無しで召喚',()=>{
  let state=startedGame()
  state.players[0].hand=['C081'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].field[0].cardId,'C081')
})

test('C081 ファルザンのスキルは風2＋味方風元素全体攻撃+1',()=>{
  let state=startedGame()
  const faruzan=place(state,0,'C081',2,4)
  place(state,0,'C071',2,2)
  place(state,0,'C001',1,2)
  state.players[0].pp=1
  const foe=place(state,1,'C001',0,10)
  state=engine.activateAbility(state,faruzan.instanceId,'skill',foe.instanceId)
  assert.deepEqual(state.players[0].field.map(f=>f.attack),[3,3,1])
  assert.equal(state.players[1].field[0].health,8)
})

test('C083 ファルカは疾走・2回攻撃・登場時に西風騎士団フォロワー探索',()=>{
  let state=startedGame()
  state.players[0].hand=['C083'];state.players[0].pp=8
  state.players[0].deck=['C001','C079']
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].field[0].cardId,'C083')
  assert.ok(state.players[0].field[0].keywords.includes('double_attack'))
  assert.equal(state.players[0].field[0].canAttack,true)
  assert.deepEqual(state.players[0].hand,['C079'])
})

test('C083 ファルカのスキルは指定した手札の炎カードを捨て通常攻撃属性を炎に',()=>{
  let state=startedGame()
  const varka=place(state,0,'C083',4,7)
  state.players[0].pp=0
  state.players[0].hand=['C012','C001']
  state=engine.activateAbility(state,varka.instanceId,'skill','hand:0')
  assert.deepEqual(state.players[0].hand,['C001'])
  assert.ok(state.players[0].graveyard.includes('C012'))
  assert.ok(state.players[0].field[0].keywords.includes('normal_attack_pyro'))
  assert.equal(state.players[0].energy,1)
})

test('C083 ファルカは攻撃時に西風騎士団全体を+1/+1、攻撃後に風へ属性変更',()=>{
  let state=startedGame()
  const varka=place(state,0,'C083',4,7)
  const knight=place(state,0,'C079',2,3)
  state.players[0].hand=['C012']
  state=engine.activateAbility(state,varka.instanceId,'skill','hand:0')
  const foe=place(state,1,'C001',0,15)
  state=engine.attackFollower(state,varka.instanceId,foe.instanceId)
  assert.equal(state.players[0].field[0].attack,5)
  assert.deepEqual([state.players[0].field[0].health,state.players[0].field[0].maxHealth],[8,8])
  assert.equal(state.players[0].field.find(f=>f.instanceId===knight.instanceId).attack,3)
  assert.ok(state.players[0].field[0].keywords.includes('normal_attack_anemo'))
  assert.equal(state.players[1].field[0].health,10)
})

test('C083 ファルカの爆発EN3は敵フォロワー全体風2',()=>{
  let state=startedGame()
  const varka=place(state,0,'C083',4,7)
  state.players[0].energy=3
  place(state,1,'C001',0,8)
  state=engine.activateAbility(state,varka.instanceId,'burst')
  assert.equal(state.players[0].energy,0)
  assert.equal(state.players[1].field[0].health,6)
})

test('C084 魈のスキルはPP1で1ターン2回まで、敵に風2',()=>{
  let state=startedGame()
  const xiao=place(state,0,'C084',4,5)
  state.players[0].pp=3
  place(state,1,'C001',0,12)
  for(let i=0;i<2;i++)state=engine.activateAbility(state,xiao.instanceId,'skill',state.players[1].field[0].instanceId)
  assert.equal(state.players[1].field[0].health,8)
  assert.equal(state.players[0].field[0].skillUsesThisTurn,2)
  assert.equal(engine.canUseAbility(state,xiao.instanceId,'skill'),false)
})

test('C084 魈の爆発はEN4で+2/+2・疾走・落下攻撃・風元素攻撃',()=>{
  let state=startedGame()
  const xiao=place(state,0,'C084',4,5)
  state.players[0].energy=4
  state=engine.activateAbility(state,xiao.instanceId,'burst')
  const x=state.players[0].field[0]
  assert.deepEqual([x.attack,x.health,x.maxHealth],[6,7,7])
  assert.ok(x.keywords.includes('storm'))
  assert.ok(x.keywords.includes('plunge_attack'))
  assert.ok(x.keywords.includes('normal_attack_anemo'))
  assert.equal(state.players[0].energy,0)
})

test('C084 魈の爆発後は自ターン終了時に自身とリーダーへ1ダメージ',()=>{
  let state=startedGame()
  const xiao=place(state,0,'C084',4,5)
  state.players[0].energy=4
  state=engine.activateAbility(state,xiao.instanceId,'burst')
  state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].health,6)
  assert.equal(state.players[0].leaderHealth,19)
})

test('C085 放浪者は元素攻撃風とオーラを持つ',()=>{
  const card=engine.getCard('C085')
  assert.equal(card.normalAttackElement,'anemo')
  assert.ok(card.keywords.includes('aura'))
})

test('C085 放浪者：PP1スキルは自身+2攻撃とそのターン疾走を付与',()=>{
  let state=startedGame()
  const wanderer=place(state,0,'C085',3,5)
  state.players[0].pp=1
  state=engine.activateAbility(state,wanderer.instanceId,'skill')
  assert.equal(state.players[0].field[0].attack,5)
  assert.ok(state.players[0].field[0].keywords.includes('storm'))
})

test('C085 放浪者：爆発EN3でランダム敵フォロワーまたはリーダーへ風2を5回',()=>{
  let state=startedGame()
  const wanderer=place(state,0,'C085',3,5)
  state.players[0].energy=3
  state=engine.activateAbility(state,wanderer.instanceId,'burst')
  assert.equal(state.players[1].leaderHealth,10)
  assert.equal(state.players[0].energy,0)
})

test('C085 放浪者のスキル疾走はターン終了時に消える',()=>{
  let state=startedGame()
  const wanderer=place(state,0,'C085',3,5)
  state.players[0].pp=1
  state=engine.activateAbility(state,wanderer.instanceId,'skill')
  state=engine.endTurn(state)
  assert.equal(state.players[0].field[0].keywords.includes('storm'),false)
})

test('ビックラキャット・ボックス交戦時：炎元素カードとの戦闘前に相手へ炎2',()=>{
  let state=startedGame()
  const cat=place(state,0,'token-surprising-cat-box',0,8)
  cat.keywords=['guard']
  const attacker=place(state,1,'C012',3,7)
  state=engine.attackFollower({...state,currentPlayerId:'player2'},attacker.instanceId,cat.instanceId)
  assert.equal(state.players[0].field[0].health,5)
  assert.equal(state.players[1].field[0].health,5)
  assert.deepEqual(state.players[1].field[0].aura,[{element:'pyro'}])
})

test('ビックラキャット・ボックス交戦時：無元素カードには属性追加ダメージを与えない',()=>{
  let state=startedGame()
  const cat=place(state,0,'token-surprising-cat-box',0,8)
  cat.keywords=['guard']
  const attacker=place(state,1,'C001',2,6)
  state=engine.attackFollower({...state,currentPlayerId:'player2'},attacker.instanceId,cat.instanceId)
  assert.equal(state.players[0].field[0].health,6)
  assert.equal(state.players[1].field[0].health,6)
})

test('ファルカのスキルは捨てる対象が手札の指定4元素以外なら使用不可',()=>{
  let state=startedGame()
  const varka=place(state,0,'C083',4,7)
  state.players[0].hand=['C001','C071']
  assert.equal(engine.canUseAbility(state,varka.instanceId,'skill'),false)
  state.players[0].hand=['C001','C012']
  assert.equal(engine.canUseAbility(state,varka.instanceId,'skill'),true)
  assert.equal(engine.activateAbility(state,varka.instanceId,'skill','hand:0'),state)
  const next=engine.activateAbility(state,varka.instanceId,'skill','hand:1')
  assert.deepEqual(next.players[0].hand,['C001'])
  assert.equal(next.players[0].energy,1)
})

test('ファルカの属性上書きはターン終了時にスキルで得た元素へ戻る',()=>{
  let state=startedGame()
  const varka=place(state,0,'C083',4,7)
  state.players[0].hand=['C012']
  state=engine.activateAbility(state,varka.instanceId,'skill','hand:0')
  const foe=place(state,1,'C001',0,18)
  state=engine.attackFollower(state,varka.instanceId,foe.instanceId)
  assert.ok(state.players[0].field[0].keywords.includes('normal_attack_anemo'))
  state=engine.endTurn(state)
  assert.ok(state.players[0].field[0].keywords.includes('normal_attack_pyro'))
  assert.ok(!state.players[0].field[0].keywords.includes('normal_attack_anemo'))
})

test('スクロースの拡散カードドローは複数対象に拡散してもターン1回まで',()=>{
  let state=startedGame()
  const sucrose=place(state,0,'C079',2,3)
  state.players[0].hand=[]
  state.players[0].deck=['C001','C071','C073']
  const a=place(state,1,'C001',0,12)
  const b=place(state,1,'C001',0,12)
  a.aura=[{element:'pyro'}]
  b.aura=[{element:'hydro'}]
  state.players[0].pp=1
  state=engine.activateAbility(state,sucrose.instanceId,'skill')
  assert.equal(state.players[0].hand.length,1)
  assert.equal(state.players[0].field[0].swirlDrawsThisTurn,1)
})

test('命の契約はカード効果による回復にも適用される',()=>{
  let state=startedGame()
  state.players[0].bondOfLife=3
  state.players[0].leaderHealth=9
  state.players[0].hand=['C031']
  state.players[0].deck=['C001']
  state.players[0].pp=3
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].leaderHealth,9)
  assert.equal(state.players[0].bondOfLife,1)
})

test('放浪者の元素爆発は敵フォロワー不在でリーダーシールドから先に削る',()=>{
  let state=startedGame()
  const wanderer=place(state,0,'C085',3,5)
  state.players[0].energy=3
  state.players[1].leaderShield={normal:4,crystallize:0}
  state=engine.activateAbility(state,wanderer.instanceId,'burst')
  assert.equal(state.players[1].leaderShield.normal,0)
  assert.equal(state.players[1].leaderHealth,14)
})

test('風元素専用トークン猫ボックスはデッキの初期候補から除外',async()=>{
  const {getDeckCardPool}=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const card=engine.getCard('token-surprising-cat-box')
  assert.deepEqual([card.attack,card.health],[0,8])
  assert.equal(card.token,true)
  assert.equal(getDeckCardPool().some(c=>c.id===card.id),false)
})

test('STEP38 岩元素15枚のID・カード名・コスト・レアリティは確定資料どおり',async()=>{
  const {geoCards}=await vite.ssrLoadModule('/src/data/cards/geo.ts')
  assert.deepEqual(geoCards.map(c=>c.id),
    Array.from({length:15},(_,i)=>'C'+String(i+86).padStart(3,'0')))
  assert.deepEqual(geoCards.map(c=>c.name),[
    '岩スライム','璃月港','テペトル仔竜','ベビーヴィシャップ',
    '天権崩玉','大掃除','獣域ハウンド・岩','ヴィシャップ・岩',
    '騎士を夢見るメイド・ノエル','月を覆う天権・凝光',
    '海祇軍の大将・ゴロー','不屈の勇士・カチーナ',
    '千織屋の店主・千織','棘薔薇の会会長・ナヴィア','白亜の申し子・アルベド'
  ])
  assert.deepEqual(geoCards.map(c=>c.cost),[1,2,2,4,4,3,4,7,4,4,3,3,5,5,5])
  assert.deepEqual(geoCards.map(c=>c.rarity),[
    ...Array(4).fill('bronze'),...Array(4).fill('silver'),
    ...Array(4).fill('gold'),...Array(3).fill('legendary')])
  assert.ok(geoCards.every(c=>c.element==='geo'))
})

test('STEP39 岩15枚のタイプ・ステータス・地域と対戦実装区分',async()=>{
  const {geoCards}=await vite.ssrLoadModule('/src/data/cards/geo.ts')
  assert.deepEqual(geoCards.map(c=>c.type),[
    'follower','amulet','follower','follower','spell','spell',
    'follower','follower','follower','follower','follower','follower',
    'follower','follower','follower'])
  assert.deepEqual(geoCards.filter(c=>c.type==='follower').map(c=>[c.attack,c.health]),[
    [2,2],[2,2],[3,4],[3,3],[6,7],[2,5],[3,4],[2,4],[2,4],[3,5],[4,5],[3,5]])
  assert.deepEqual(geoCards.find(c=>c.id==='C098').region,['フォンテーヌ','稲妻'])
  assert.deepEqual(geoCards.find(c=>c.id==='C100').traits,['西風騎士団'])
  assert.deepEqual(geoCards.filter(c=>c.implementationStatus==='playable').map(c=>c.id),
    ['C086','C087','C088','C089','C090','C091','C092','C093','C094','C095','C096','C097','C098','C099','C100'])
})

test('STEP38 正式100/115・岩15枚の枠を充足・残り15枚',async()=>{
  const {productionCards}=await vite.ssrLoadModule('/src/data/productionCards.ts')
  const {validateProductionCards}=await vite.ssrLoadModule('/src/data/cardValidation.ts')
  const report=validateProductionCards(productionCards)
  assert.deepEqual(report.errors,[])
  assert.equal(report.total,115)
  assert.equal(report.slots.filter(s=>s.element==='geo').reduce((n,s)=>n+s.remaining,0),0)
  assert.equal(report.slots.reduce((n,s)=>n+s.remaining,0),0)
})

test('STEP39 岩元素15枚すべてがデッキ候補として対戦使用可能',async()=>{
  const {geoCards}=await vite.ssrLoadModule('/src/data/cards/geo.ts')
  const {getDeckCardPool}=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const pool=new Set(getDeckCardPool().map(c=>c.id))
  for(const c of geoCards)assert.equal(pool.has(c.id),c.implementationStatus==='playable')
  const state=startedGame()
  state.players[0].pp=10
  state.players[0].hand=['C098']
  assert.equal(engine.canPlayCard(state,0),true)
})

test('C086 岩スライムは岩元素生物として岩を常時付着',()=>{
  let state=startedGame()
  state.players[0].pp=1;state.players[0].hand=['C086']
  state=engine.playCard(state,'player1',0)
  assert.deepEqual(state.players[0].field[0].aura,[{element:'geo'}])
  assert.equal(state.players[0].field[0].health,2)
})

test('C087 璃月港は2PP・カウント3のアミュレット',()=>{
  let state=startedGame()
  state.players[0].hand=['C087'];state.players[0].pp=2
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].amulets[0].cardId,'C087')
  assert.equal(state.players[0].amulets[0].turnsRemaining,3)
  assert.equal(state.players[0].amulets.length,1)
})

test('C087 璃月港は自ターン終了時にデッキから璃月地域の1枚を探索',()=>{
  let state=startedGame()
  state.players[0].hand=['C087'];state.players[0].pp=2
  state.players[0].deck=['C001','C019','C089','C080']
  state=engine.playCard(state,'player1',0)
  state=engine.endTurn(state)
  assert.deepEqual(state.players[0].hand,['C089'])
  assert.deepEqual(state.players[0].deck,['C001','C019','C080'])
  assert.equal(state.players[0].amulets[0].turnsRemaining,2)
})

test('C087 璃月港の探索候補無しでもカウントダウンし3回で消滅',()=>{
  let state=startedGame()
  state.players[0].hand=['C087'];state.players[0].pp=2
  state.players[0].deck=Array(10).fill('C001')
  state=engine.playCard(state,'player1',0)
  for(let i=0;i<5;i++)state=engine.endTurn(state)
  assert.deepEqual(state.players[0].amulets,[])
  assert.equal(state.players[0].deck.length,8)
})

test('C087 璃月港は場の5枠が埋まっていると使用できない',()=>{
  const state=startedGame()
  state.players[0].hand=['C087'];state.players[0].pp=2
  for(let i=0;i<5;i++)place(state,0,'C001',1,2)
  assert.equal(engine.canPlayCard(state,0),false)
})

test('C088 テペトル仔竜は突進で登場ターンは敵フォロワーのみ攻撃可能',()=>{
  let state=startedGame()
  state.players[0].hand=['C088'];state.players[0].pp=2
  state=engine.playCard(state,'player1',0)
  const dragon=state.players[0].field[0]
  assert.equal(engine.attackLeader(state,dragon.instanceId),state)
  const foe=place(state,1,'C001',0,7)
  state=engine.attackFollower(state,dragon.instanceId,foe.instanceId)
  assert.equal(state.players[1].field[0].health,5)
})

test('C089 ベビーヴィシャップは突進、攻撃時に自リーダー結晶シールド1',()=>{
  let state=startedGame()
  state.players[0].hand=['C089'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0)
  const baby=state.players[0].field[0]
  const foe=place(state,1,'C001',0,8)
  state=engine.attackFollower(state,baby.instanceId,foe.instanceId)
  assert.equal(state.players[0].leaderShield.crystallize,1)
  assert.equal(state.players[1].field[0].health,5)
})

test('C092 岩ハウンドは岩元素通常攻撃＋敵リーダーへの追加非元素1',()=>{
  let state=startedGame()
  const hound=place(state,0,'C092',3,3)
  const foe=place(state,1,'C001',0,10)
  state=engine.attackFollower(state,hound.instanceId,foe.instanceId)
  assert.equal(state.players[1].leaderHealth,19)
  assert.equal(state.players[1].field[0].health,7)
  assert.deepEqual(state.players[1].field[0].aura,[])
  assert.equal(engine.getCard('C092').normalAttackElement,'geo')
})

test('C092 岩ハウンドがリーダーを攻撃すると本体3＋追加1ダメージ',()=>{
  let state=startedGame()
  const hound=place(state,0,'C092',3,3)
  state=engine.attackLeader(state,hound.instanceId)
  assert.equal(state.players[1].leaderHealth,16)
})

test('C093 岩ヴィシャップは守護、交戦時に自リーダー結晶シールド2',()=>{
  let state=startedGame()
  state.players[0].hand=['C093'];state.players[0].pp=7
  state=engine.playCard(state,'player1',0)
  assert.ok(state.players[0].field[0].keywords.includes('guard'))
  const vishap=state.players[0].field[0]
  vishap.canAttack=true // 次の自分ターン以降の交戦を再現
  const foe=place(state,1,'C001',2,9)
  state=engine.attackFollower(state,vishap.instanceId,foe.instanceId)
  assert.equal(state.players[0].leaderShield.crystallize,2)
})

test('C093 岩ヴィシャップは敵に攻撃されても交戦時シールド2',()=>{
  let state=startedGame()
  const vishap=place(state,0,'C093',6,7)
  vishap.keywords=['guard']
  const enemy=place(state,1,'C001',2,9)
  state=engine.attackFollower({...state,currentPlayerId:'player2'},enemy.instanceId,vishap.instanceId)
  assert.equal(state.players[0].leaderShield.crystallize,2)
})

test('C094 ノエルは守護、PP1スキルで自身とリーダーへ通常シールド3',()=>{
  let state=startedGame()
  const noelle=place(state,0,'C094',2,5)
  noelle.keywords=['guard']
  state.players[0].pp=1
  state=engine.activateAbility(state,noelle.instanceId,'skill')
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[0].leaderShield.normal,3)
  assert.equal(state.players[0].field[0].shield.normal,3)
})

test('C094 ノエルは攻撃時リーダーを2回復',()=>{
  let state=startedGame()
  const noelle=place(state,0,'C094',2,5)
  state.players[0].leaderHealth=15
  const enemy=place(state,1,'C001',0,8)
  state=engine.attackFollower(state,noelle.instanceId,enemy.instanceId)
  assert.equal(state.players[0].leaderHealth,17)
})

test('C094 ノエルの回復は命の契約を先に吸収する',()=>{
  let state=startedGame()
  const noelle=place(state,0,'C094',2,5)
  state.players[0].leaderHealth=10
  state.players[0].bondOfLife=2
  const enemy=place(state,1,'C001',0,8)
  state=engine.attackFollower(state,noelle.instanceId,enemy.instanceId)
  assert.equal(state.players[0].leaderHealth,10)
  assert.equal(state.players[0].bondOfLife,0)
})

test('C096 ゴローのファンファーレは自身を含む味方岩フォロワー全体+0/+1',()=>{
  let state=startedGame()
  place(state,0,'C086',2,2)
  place(state,0,'C001',1,3)
  state.players[0].hand=['C096'];state.players[0].pp=3
  state=engine.playCard(state,'player1',0)
  assert.deepEqual(state.players[0].field.map(f=>[f.health,f.maxHealth]),[[3,3],[3,3],[5,5]])
})

test('C096 ゴローのPP1スキルは自分の岩フォロワーすべて+1/+1',()=>{
  let state=startedGame()
  const gorou=place(state,0,'C096',2,4)
  place(state,0,'C086',2,2)
  place(state,0,'C001',1,3)
  state.players[0].pp=1
  state=engine.activateAbility(state,gorou.instanceId,'skill')
  assert.deepEqual(state.players[0].field.map(f=>[f.attack,f.health]),[[3,5],[3,3],[1,3]])
  assert.equal(state.players[0].energy,1)
})


test('C090 天権崩玉は敵リーダーのみなら岩元素1を4回与える',()=>{
  let state=startedGame()
  state.players[0].hand=['C090']; state.players[0].pp=4
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[1].leaderHealth,16)
  assert.equal(state.players[0].pp,0)
  assert.deepEqual(state.players[0].graveyard.slice(-1),['C090'])
})

test('C090 天権崩玉は岩創造物があると8回攻撃する',()=>{
  let state=startedGame()
  const construct=place(state,0,'C086',2,2)
  construct.cardId='token-jade-screen'
  state.players[0].hand=['C090'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[1].leaderHealth,12)
})

test('C090 天権崩玉は相手リーダーのシールドを先に削る',()=>{
  let state=startedGame()
  state.players[1].leaderShield={normal:2,crystallize:1}
  state.players[0].hand=['C090'];state.players[0].pp=4
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[1].leaderHealth,19)
  assert.deepEqual(state.players[1].leaderShield,{normal:0,crystallize:0})
})


test('C095 凝光のファンファーレは結晶シールド2を付与し岩通常攻撃を持つ',()=>{
  let state=startedGame()
  state.players[0].pp=4;state.players[0].hand=['C095']
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].leaderShield.crystallize,2)
  assert.equal(engine.getCard('C095').normalAttackElement,'geo')
})

test('C095 凝光のPP1スキルは璇璣屏を場へ追加しENを1得る',()=>{
  let state=startedGame()
  const ning=place(state,0,'C095',3,4)
  state.players[0].pp=1
  state=engine.activateAbility(state,ning.instanceId,'skill')
  assert.equal(state.players[0].pp,0)
  assert.equal(state.players[0].energy,1)
  assert.equal(state.players[0].amulets.length,1)
  assert.equal(state.players[0].amulets[0].cardId,'token-jade-screen')
  assert.equal(state.players[0].amulets[0].turnsRemaining,3)
  assert.equal(engine.getCard('token-jade-screen').token,true)
})

test('C097 カチーナのファンファーレは結晶シールド2を付与',()=>{
  let state=startedGame()
  state.players[0].pp=3;state.players[0].hand=['C097']
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[0].leaderShield.crystallize,2)
})

test('C097 カチーナのPP1スキルはぐるぐるコマちゃんを場へ追加する',()=>{
  let state=startedGame()
  const kachina=place(state,0,'C097',2,4)
  state.players[0].pp=1
  state=engine.activateAbility(state,kachina.instanceId,'skill')
  assert.equal(state.players[0].amulets.length,1)
  assert.equal(state.players[0].amulets[0].cardId,'token-spinning-turbo')
  assert.equal(state.players[0].energy,1)
})

test('岩創造物召喚スキルは盤面5枠満杯では使用不可',()=>{
  let state=startedGame()
  const ning=place(state,0,'C095',3,4)
  for(let i=0;i<4;i++)place(state,0,'C086',2,2)
  state.players[0].pp=1
  assert.equal(engine.canUseAbility(state,ning.instanceId,'skill'),false)
  assert.equal(engine.activateAbility(state,ning.instanceId,'skill'),state)
})

test('岩創造物は召喚後の天権崩玉を8ヒットにする',()=>{
  let state=startedGame()
  const ning=place(state,0,'C095',3,4)
  state.players[0].pp=5;state.players[0].hand=['C090']
  state=engine.activateAbility(state,ning.instanceId,'skill')
  state=engine.playCard(state,'player1',0)
  assert.equal(state.players[1].leaderHealth,12)
})

test('岩創造物は通常カードと同様に場の5枠を占有する',()=>{
  let state=startedGame()
  const kachina=place(state,0,'C097',2,4)
  state.players[0].pp=1
  state=engine.activateAbility(state,kachina.instanceId,'skill')
  for(let i=0;i<3;i++)place(state,0,'C086',2,2)
  state.players[0].hand=['C086'];state.players[0].pp=1
  assert.equal(engine.canPlayCard(state,0),false)
})

test('C100 アルベドのスキルは陽華を盤面に設置しEN+1',()=>{
  let s=startedGame();const a=place(s,0,'C100',3,5)
  s.players[0].pp=1
  s=engine.activateAbility(s,a.instanceId,'skill')
  assert.equal(s.players[0].amulets[0].cardId,'token-solar-isotoma')
  assert.equal(s.players[0].amulets[0].turnsRemaining,3)
  assert.equal(s.players[0].energy,1)
})
test('C100 アルベドの爆発は岩創造物があると岩2+2',()=>{
  let s=startedGame();const a=place(s,0,'C100',3,5)
  s.players[0].pp=1;s.players[0].energy=3
  s=engine.activateAbility(s,a.instanceId,'skill')
  const foe=place(s,1,'C001',0,8)
  s=engine.activateAbility(s,a.instanceId,'burst')
  assert.equal(s.players[1].field.find(f=>f.instanceId===foe.instanceId).health,4)
  assert.equal(s.players[0].energy,1)
})
test('C100 アルベドは自ターン終了時結晶シールド1獲得',()=>{
  let s=startedGame();place(s,0,'C100',3,5)
  s=engine.endTurn(s)
  assert.equal(s.players[0].leaderShield.crystallize,1)
})

test('C091 大掃除は指定味方を強化し攻撃時敵全体へ岩1',()=>{
  let s=startedGame();const ally=place(s,0,'C001',2,5)
  s.players[0].hand=['C091'];s.players[0].pp=3
  s=engine.playCard(s,'player1',0,ally.instanceId)
  assert.equal(s.players[0].field[0].attack,4)
  assert.ok(s.players[0].field[0].keywords.includes('normal_attack_geo'))
  const e=place(s,1,'C001',0,8), other=place(s,1,'C001',0,8)
  s=engine.attackFollower(s,ally.instanceId,e.instanceId)
  assert.equal(s.players[1].field.find(f=>f.instanceId===other.instanceId).health,7)
})
test('C091 大掃除は対象指定なしではPPも手札も変化しない',()=>{
  let s=startedGame();place(s,0,'C001',2,4);s.players[0].pp=3;s.players[0].hand=['C091']
  assert.equal(engine.playCard(s,'player1',0),s)
})

test('C099 ナヴィアのスキルは結晶3消費して岩7、PP0、EN+1',()=>{
  let s=startedGame(); const n=place(s,0,'C099',4,5)
  s.players[0].leaderShield={normal:0,crystallize:3}
  const e=place(s,1,'C001',0,10)
  s=engine.activateAbility(s,n.instanceId,'skill',e.instanceId)
  assert.equal(s.players[0].leaderShield.crystallize,0)
  assert.equal(s.players[0].energy,1)
  assert.equal(s.players[1].field[0].health,3)
})
test('C099 ナヴィアは自ターン中結晶獲得のたび最大3回攻撃+1',()=>{
  let s=startedGame();const n=place(s,0,'C099',4,5)
  const v=place(s,0,'C089',3,5)
  for(let i=0;i<4;i++){
    s.players[0].field.find(f=>f.instanceId===v.instanceId).hasAttacked=false
    const enemy=place(s,1,'C001',0,100)
    s=engine.attackFollower(s,v.instanceId,enemy.instanceId)
  }
  const navia=s.players[0].field.find(f=>f.instanceId===n.instanceId)
  assert.equal(navia.attack,7)
  assert.equal(navia.geoShieldTriggersThisTurn,3)
})
test('C099 ナヴィア爆発は岩1全体・結晶1・2回クレスト',()=>{
  let s=startedGame();const n=place(s,0,'C099',4,5)
  const e=place(s,1,'C001',0,10)
  s.players[0].energy=3
  s=engine.activateAbility(s,n.instanceId,'burst')
  assert.equal(s.players[1].field[0].health,9)
  assert.equal(s.players[0].leaderShield.crystallize,1)
  assert.equal(s.players[0].crests[0].turnsRemaining,2)
  s=engine.endTurn(s)
  assert.equal(s.players[1].field.find(f=>f.instanceId===e.instanceId).health,8)
  assert.equal(s.players[0].crests[0].turnsRemaining,1)
})

test('C098 千織は岩創造物があれば登場時たもと1体を召喚する',()=>{
  let s=startedGame()
  s.players[0].amulets=[{instanceId:'jade',cardId:'token-jade-screen',turnsRemaining:0}]
  s.players[0].pp=5;s.players[0].hand=['C098']
  s=engine.playCard(s,'player1',0)
  assert.deepEqual(s.players[0].field.map(f=>f.cardId),['C098','token-tamoto'])
})
test('C098 千織のスキルはPP1でたもと召喚とEN+1',()=>{
  let s=startedGame();const c=place(s,0,'C098',3,5)
  s.players[0].pp=1
  s=engine.activateAbility(s,c.instanceId,'skill')
  assert.equal(s.players[0].energy,1)
  assert.equal(s.players[0].field[1].cardId,'token-tamoto')
})
test('C098 千織爆発は全体岩3とたもと数の岩2追加',()=>{
  let s=startedGame();const c=place(s,0,'C098',3,5)
  place(s,0,'token-tamoto',1,3)
  place(s,1,'C001',0,3)
  s.players[0].energy=3
  s=engine.activateAbility(s,c.instanceId,'burst')
  assert.equal(s.players[1].field.length,0)
  assert.equal(s.players[1].leaderHealth,18)
})
test('たもとの終了時効果は敵フォロワーに岩2',()=>{
  let s=startedGame();place(s,0,'token-tamoto',1,3)
  place(s,1,'C001',0,5)
  s=engine.endTurn(s)
  assert.equal(s.players[1].field[0].health,3)
})

test('C091 攻撃時全体岩ダメージで攻撃対象を倒しても攻撃回数を消費',()=>{
  let s=startedGame(); const attacker=place(s,0,'C001',2,5)
  s.players[0].pp=3;s.players[0].hand=['C091']
  s=engine.playCard(s,'player1',0,attacker.instanceId)
  const foe=place(s,1,'C001',0,1)
  s=engine.attackFollower(s,attacker.instanceId,foe.instanceId)
  assert.equal(s.players[1].field.length,0)
  assert.equal(s.players[0].field[0].hasAttacked,true)
  assert.equal(engine.canFollowerAttack(s.players[0].field[0]),false)
})

test('STEP40 草元素15枚は原本どおりB4/S4/G4/L3の構成', async()=>{
  const {dendroCards}=await vite.ssrLoadModule('/src/data/cards/dendro.ts')
  const {productionCards}=await vite.ssrLoadModule('/src/data/productionCards.ts')
  const {validateProductionCards}=await vite.ssrLoadModule('/src/data/cardValidation.ts')
  assert.equal(dendroCards.length,15)
  assert.deepEqual(dendroCards.map(c=>c.id),Array.from({length:15},(_,i)=>'C'+String(i+101)))
  assert.deepEqual(dendroCards.map(c=>c.rarity),[
    ...Array(4).fill('bronze'),...Array(4).fill('silver'),
    ...Array(4).fill('gold'),...Array(3).fill('legendary')])
  const report=validateProductionCards(productionCards)
  assert.equal(report.total,115)
  assert.deepEqual(report.errors,[])
  assert.equal(report.ready,true)
})
test('STEP41 草元素15枚が対戦対応、残り0枚は正式データのみ',async()=>{
  const {dendroCards}=await vite.ssrLoadModule('/src/data/cards/dendro.ts')
  assert.deepEqual(dendroCards.filter(c=>c.implementationStatus==='playable').map(c=>c.id),
    ['C101','C102','C103','C104','C105','C106','C107','C108','C109','C110','C111','C112','C113','C114','C115'])
  const {getDeckCardPool}=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const pool=new Set(getDeckCardPool().map(c=>c.id))
  for(const c of dendroCards)assert.equal(pool.has(c.id),c.implementationStatus==='playable')
})
test('C101 草スライムは常時草付着の2/2',()=>{
  let s=startedGame();s.players[0].hand=['C101'];s.players[0].pp=1
  s=engine.playCard(s,'player1',0)
  assert.equal(s.players[0].field[0].health,2)
  assert.deepEqual(s.players[0].field[0].aura,[{element:'dendro'}])
})
test('C103 ユムカ仔竜は突進し登場ターンにリーダーへ攻撃不可',()=>{
  let s=startedGame();s.players[0].hand=['C103'];s.players[0].pp=2
  s=engine.playCard(s,'player1',0)
  assert.equal(s.players[0].field[0].canAttack,true)
  assert.equal(s.players[0].field[0].keywords.includes('rush_only'),true)
  assert.equal(engine.attackLeader(s,s.players[0].field[0].instanceId),s)
})
test('C102 スメールの知恵は草カードを探索してから1枚引く',()=>{
  let s=startedGame()
  s.players[0].hand=['C102'];s.players[0].pp=2
  s.players[0].deck=['C001','C101','C003']
  s=engine.playCard(s,'player1',0)
  assert.deepEqual(s.players[0].hand,['C101','C001'])
  assert.deepEqual(s.players[0].deck,['C003'])
  assert.deepEqual(s.players[0].graveyard.slice(-1),['C102'])
})
test('C102 スメールの知恵で探索後にデッキ切れドローなら即敗北',()=>{
  let s=startedGame();s.players[0].hand=['C102'];s.players[0].pp=2;s.players[0].deck=['C101']
  s=engine.playCard(s,'player1',0)
  assert.equal(s.winnerId,'player2')
})
test('C104 草フライムのラストワードは相手リーダーへ草2',()=>{
  let s=startedGame();const a=place(s,0,'C104',2,1)
  const foe=place(s,1,'C001',2,5)
  s=engine.attackFollower(s,a.instanceId,foe.instanceId)
  assert.equal(s.players[1].leaderHealth,18)
  assert.equal(s.players[0].graveyard.includes('C104'),true)
})
test('C107 ヴァナラーナは3ターン終了時回復とドローして消滅',()=>{
  let s=startedGame();s.players[0].hand=['C107'];s.players[0].pp=2
  s.players[0].leaderHealth=15
  s=engine.playCard(s,'player1',0)
  assert.equal(s.players[0].amulets[0].turnsRemaining,3)
  s=engine.endTurn(s)
  assert.equal(s.players[0].leaderHealth,16)
  assert.equal(s.players[0].amulets[0].turnsRemaining,2)
  s=engine.endTurn(s)
  s=engine.endTurn(s)
  s=engine.endTurn(s)
  s=engine.endTurn(s)
  assert.equal(s.players[0].amulets?.length??0,0)
  assert.equal(s.players[0].leaderHealth,18)
})
test('C107 ヴァナラーナのドローはデッキ切れ即敗北',()=>{
  let s=startedGame();s.players[0].hand=['C107'];s.players[0].pp=2;s.players[0].deck=[]
  s=engine.playCard(s,'player1',0)
  s=engine.endTurn(s)
  assert.equal(s.winnerId,'player2')
})

test('C105 玉顆珊々月中落は月桂・跳躍型2体召喚とリーダー／味方2回復',()=>{
  let s=startedGame()
  const f=place(s,0,'C001',2,5);f.health=2;s.players[0].leaderHealth=12
  s.players[0].hand=['C105'];s.players[0].pp=4
  s=engine.playCard(s,'player1',0)
  assert.equal(s.players[0].field.filter(x=>x.cardId==='token-yuegui-jumping').length,2)
  assert.equal(s.players[0].field[0].health,4)
  assert.equal(s.players[0].leaderHealth,14)
})
test('月桂・跳躍型のターン終了効果は敵に草2・自リーダー回復1',()=>{
  let s=startedGame();place(s,0,'token-yuegui-jumping',0,3)
  const e=place(s,1,'C001',0,8)
  s.players[0].leaderHealth=12
  s=engine.endTurn(s)
  assert.equal(s.players[1].field.find(x=>x.instanceId===e.instanceId).health,6)
  assert.equal(s.players[0].leaderHealth,13)
})
test('C106 ニャンコトレジャーは敵全体草1と2ターンのコレアンバー',()=>{
  let s=startedGame()
  const e=place(s,1,'C001',0,8)
  s.players[0].hand=['C106'];s.players[0].pp=3
  s=engine.playCard(s,'player1',0)
  assert.equal(s.players[1].field[0].health,7)
  assert.equal(s.players[0].amulets[0].cardId,'token-collei-amber')
  assert.equal(s.players[0].amulets[0].turnsRemaining,2)
  s=engine.endTurn(s)
  assert.equal(s.players[1].field.find(x=>x.instanceId===e.instanceId).health,6)
  assert.equal(s.players[0].amulets[0].turnsRemaining,1)
  s=engine.endTurn(s)
  s=engine.endTurn(s)
  assert.equal(s.players[1].field.find(x=>x.instanceId===e.instanceId).health,5)
  assert.equal(s.players[0].amulets.length,0)
})

test('C108 フローラルリングダンサーは登場時草霊を1体召喚',()=>{
  let s=startedGame()
  s.players[0].pp=5;s.players[0].hand=['C108']
  s=engine.playCard(s,'player1',0)
  assert.deepEqual(s.players[0].field.map(f=>f.cardId),['C108','token-dendro-spirit'])
  assert.equal(engine.getCard('token-dendro-spirit').normalAttackElement,'dendro')
})
test('C108 フローラルリングダンサーは草霊がいれば攻撃時+2/+0',()=>{
  let s=startedGame()
  const attacker=place(s,0,'C108',3,4)
  place(s,0,'token-dendro-spirit',2,2)
  const foe=place(s,1,'C001',0,9)
  s=engine.attackFollower(s,attacker.instanceId,foe.instanceId)
  assert.equal(s.players[0].field[0].attack,5)
  assert.equal(s.players[1].field[0].health,4)
})
test('C108 フローラルリングダンサーは草霊がなければ攻撃力そのまま',()=>{
  let s=startedGame()
  const attacker=place(s,0,'C108',3,4)
  const foe=place(s,1,'C001',0,9)
  s=engine.attackFollower(s,attacker.instanceId,foe.instanceId)
  assert.equal(s.players[0].field[0].attack,3)
})

test('C109 ヨォーヨのスキルは月桂・投擲型を召喚し終了時回復',()=>{
 let s=startedGame(); const y=place(s,0,'C109',2,4);s.players[0].pp=1;s.players[0].leaderHealth=10
 s=engine.activateAbility(s,y.instanceId,'skill')
 assert.equal(s.players[0].field[1].cardId,'token-yuegui-throwing')
 s=engine.endTurn(s)
 assert.equal(s.players[0].leaderHealth,12)
})
test('C110 綺良々の登場時シールド2とスキルの自盾3＋敵草1',()=>{
 let s=startedGame();s.players[0].pp=3;s.players[0].hand=['C110']
 const e=place(s,1,'C001',0,6)
 s=engine.playCard(s,'player1',0)
 assert.equal(s.players[0].leaderShield.normal,2)
 s.players[0].pp=1
 s=engine.activateAbility(s,s.players[0].field[0].instanceId,'skill')
 assert.equal(s.players[0].field[0].shield.normal,3)
 assert.equal(s.players[1].field.find(f=>f.instanceId===e.instanceId).health,5)
})
test('C111 コレイは草元素スペルを探索し敵1体草2と別体草1',()=>{
 let s=startedGame();s.players[0].pp=3;s.players[0].hand=['C111'];s.players[0].deck=['C001','C105']
 const e=place(s,1,'C001',0,6),other=place(s,1,'C001',0,6)
 s=engine.playCard(s,'player1',0)
 assert.ok(s.players[0].hand.includes('C105'))
 s.players[0].pp=1
 s=engine.activateAbility(s,s.players[0].field[0].instanceId,'skill',e.instanceId)
 assert.equal(s.players[1].field.find(f=>f.instanceId===e.instanceId).health,4)
 assert.equal(s.players[1].field.find(f=>f.instanceId===other.instanceId).health,5)
})
test('C112 カーヴェは敵草原核+0/+1、スキル草2とHP準拠リーダーダメージ',()=>{
 let s=startedGame();s.players[0].pp=4;s.players[0].hand=['C112']
 const core=place(s,1,'dendro-core',0,1),enemy=place(s,1,'C001',0,6)
 s=engine.playCard(s,'player1',0)
 assert.equal(s.players[1].field.find(f=>f.instanceId===core.instanceId).health,2)
 s.players[0].pp=1
 s=engine.activateAbility(s,s.players[0].field[0].instanceId,'skill',enemy.instanceId)
 assert.equal(s.players[1].field.find(f=>f.instanceId===enemy.instanceId).health,4)
 assert.equal(s.players[1].leaderHealth,18)
})

test('C113 ティナリのスキルは草2＋攻撃力-1',()=>{
 let s=startedGame(), t=place(s,0,'C113',3,5)
 const e=place(s,1,'C001',3,7)
 s.players[0].pp=1
 s=engine.activateAbility(s,t.instanceId,'skill',e.instanceId)
 assert.equal(s.players[1].field[0].health,5)
 assert.equal(s.players[1].field[0].attack,2)
})
test('C113 ティナリの爆発は敵リーダーのみなら草2を4回',()=>{
 let s=startedGame(), t=place(s,0,'C113',3,5)
 s.players[0].energy=3
 s=engine.activateAbility(s,t.instanceId,'burst')
 assert.equal(s.players[1].leaderHealth,12)
})
test('C113 ティナリの攻撃時はランダム敵フォロワーに草1',()=>{
 let s=startedGame(), t=place(s,0,'C113',3,5)
 const e=place(s,1,'C001',0,8)
 s=engine.attackFollower(s,t.instanceId,e.instanceId)
 assert.equal(s.players[1].field[0].health,4)
})
test('C114 エミリエのスキルは3ターンのルミドゥースの瓶',()=>{
 let s=startedGame(), e=place(s,0,'C114',3,5)
 s.players[0].pp=1
 s=engine.activateAbility(s,e.instanceId,'skill')
 assert.equal(s.players[0].amulets[0].cardId,'token-lumidouce-vial')
 assert.equal(s.players[0].amulets[0].turnsRemaining,3)
})
test('C114 エミリエの爆発は燃焼状態があれば敵全体に草2を2回',()=>{
 let s=startedGame(), e=place(s,0,'C114',3,5)
 const foe=place(s,1,'C001',0,9)
 foe.keywords.push('burning:2')
 s.players[0].energy=3
 s=engine.activateAbility(s,e.instanceId,'burst')
 assert.equal(s.players[1].field[0].health,5)
})
test('C115 キィニチは突進・スキル草3・爆発敵全体草2＋リーダー草3',()=>{
 let s=startedGame();s.players[0].hand=['C115'];s.players[0].pp=5
 const e=place(s,1,'C001',0,10)
 s=engine.playCard(s,'player1',0)
 let k=s.players[0].field[0]
 assert.ok(k.keywords.includes('rush_only'))
 s.players[0].pp=1
 s=engine.activateAbility(s,k.instanceId,'skill',e.instanceId)
 assert.equal(s.players[1].field[0].health,7)
 s.players[0].energy=3
 s=engine.activateAbility(s,k.instanceId,'burst')
 assert.equal(s.players[1].field[0].health,5)
 assert.equal(s.players[1].leaderHealth,17)
})
test('C115 キィニチの燃焼反応による強化は自ターン最大2回',async()=>{
 const {resolveReactionConsequence}=await vite.ssrLoadModule('/src/game/elemental.ts')
 let s=startedGame();place(s,0,'C115',4,5)
 for(let i=0;i<3;i++)s=resolveReactionConsequence(s,1,'missing','burning',undefined,0)
 assert.equal(s.players[0].field[0].attack,6)
 assert.equal(s.players[0].field[0].dendroBurningTriggersThisTurn,2)
})

test('C030の正式効果：味方指定で水1攻撃時能力を付与し対象未指定は拒否',()=>{
 let s=startedGame();const ally=place(s,0,'C001',2,4)
 s.players[0].pp=2;s.players[0].hand=['C030']
 assert.equal(engine.playCard(s,'player1',0),s)
 s=engine.playCard(s,'player1',0,ally.instanceId)
 assert.equal(s.players[0].pp,0)
 assert.ok(s.players[0].field[0].keywords.includes('raincutter_on_attack'))
 assert.ok(s.players[0].graveyard.includes('C030'))
})
test('C030攻撃時は通常戦闘より先に敵フォロワーに水1、通常攻撃も追加',()=>{
 let s=startedGame();const ally=place(s,0,'C001',2,4),foe=place(s,1,'C001',0,6)
 s.players[0].pp=2;s.players[0].hand=['C030']
 s=engine.playCard(s,'player1',0,ally.instanceId)
 s=engine.attackFollower(s,ally.instanceId,foe.instanceId)
 assert.equal(s.players[1].field[0].health,3)
})
test('C030攻撃時の水1で対象を破壊したら通常攻撃は行わず攻撃回数を消費',()=>{
 let s=startedGame();const ally=place(s,0,'C001',2,4),foe=place(s,1,'C001',0,1)
 s.players[0].pp=2;s.players[0].hand=['C030']
 s=engine.playCard(s,'player1',0,ally.instanceId)
 s=engine.attackFollower(s,ally.instanceId,foe.instanceId)
 assert.equal(s.players[1].field.length,0)
 assert.equal(s.players[0].field[0].hasAttacked,true)
 assert.equal(s.players[0].field[0].health,4)
})
test('C030リーダー攻撃でも先に水1、通常攻撃を加算',()=>{
 let s=startedGame();const ally=place(s,0,'C001',2,4)
 s.players[0].pp=2;s.players[0].hand=['C030']
 s=engine.playCard(s,'player1',0,ally.instanceId)
 s=engine.attackLeader(s,ally.instanceId)
 assert.equal(s.players[1].leaderHealth,17)
})
test('C030は同じフォロワーへ複数回付与しても追加効果は1回分',()=>{
 let s=startedGame();const ally=place(s,0,'C001',2,4)
 s.players[0].pp=4;s.players[0].hand=['C030','C030']
 s=engine.playCard(s,'player1',0,ally.instanceId)
 s=engine.playCard(s,'player1',0,ally.instanceId)
 const e=place(s,1,'C001',0,8)
 s=engine.attackFollower(s,ally.instanceId,e.instanceId)
 assert.equal(s.players[1].field[0].health,5)
})

test('岩創造物3種は3ターン継続、各ターン固有の効果が発動',()=>{
 let s=startedGame()
 s.players[0].amulets=[
  {instanceId:'jade-audit',cardId:'token-jade-screen',turnsRemaining:3},
  {instanceId:'turbo-audit',cardId:'token-spinning-turbo',turnsRemaining:3},
  {instanceId:'solar-audit',cardId:'token-solar-isotoma',turnsRemaining:3},
 ]
 const e=place(s,1,'C001',0,10)
 s=engine.endTurn(s)
 assert.equal(s.players[0].leaderShield.crystallize,3)
 assert.equal(s.players[1].field.find(f=>f.instanceId===e.instanceId).health,7)
 assert.deepEqual(s.players[0].amulets.map(a=>a.turnsRemaining),[2,2,2])
 for(let i=0;i<4;i++)s=engine.endTurn(s)
 assert.equal(s.players[0].amulets.length,0)
})
test('岩創造物のターン終了効果はナヴィアの結晶シールド獲得時能力と連動',()=>{
 let s=startedGame()
 const navia=place(s,0,'C099',4,5)
 s.players[0].amulets=[{instanceId:'jade-navia',cardId:'token-jade-screen',turnsRemaining:3}]
 s=engine.endTurn(s)
 assert.equal(s.players[0].field.find(f=>f.instanceId===navia.instanceId).attack,5)
})

test('Ver.1.0.1 草原核は反応を起こした側の相手の場へ生成、両方向を検証', async()=>{
  const {resolveReactionConsequence}=await vite.ssrLoadModule('/src/game/elemental.ts')
  const s=startedGame()
  const a=resolveReactionConsequence(s,1,'dummy','bloom','hydro',0)
  assert.equal(a.players[0].field.some(f=>f.cardId==='dendro-core'),false)
  assert.equal(a.players[1].field.filter(f=>f.cardId==='dendro-core').length,1)
  const b=resolveReactionConsequence(s,0,'dummy','bloom','hydro',1)
  assert.equal(b.players[1].field.some(f=>f.cardId==='dendro-core'),false)
  assert.equal(b.players[0].field.filter(f=>f.cardId==='dendro-core').length,1)
})

test('テスト用カードデータは正式台帳から完全削除されている',async()=>{
  const {getAllCards,getDeckCardPool,getCard}=await vite.ssrLoadModule('/src/data/cardRegistry.ts')
  const {productionCards}=await vite.ssrLoadModule('/src/data/productionCards.ts')
  const {productionTokens}=await vite.ssrLoadModule('/src/data/productionTokens.ts')
  const registry=getAllCards()
  assert.equal(productionCards.length,115)
  assert.equal(productionTokens.length,24)
  assert.equal(registry.length,139)
  assert.equal(getDeckCardPool().length,115)
  assert.ok(registry.every(card=>!card.id.startsWith('test-')))
  assert.equal(getCard('test-elemental-caster'),undefined)
  for(let i=0;i<30;i++){
    const state=engine.createInitialGameState()
    for(const player of state.players)
      assert.ok([...player.hand,...player.deck].every(id=>/^C\d{3}$/.test(id)))
  }
})

test('構築ルール: 40枚・同名最大3枚・元素は最大3種類・無元素自由',async()=>{
  const {createStarterDeck,validateDeck,getDeckCard}=await vite.ssrLoadModule('/src/data/deckRules.ts')
  for(const selected of [['pyro'],['pyro','hydro'],['pyro','hydro','cryo']]){
    const deck=createStarterDeck(selected)
    assert.equal(deck.cards.length,40)
    assert.deepEqual(validateDeck(deck),[])
    assert.ok(deck.cards.every(id=>{
      const card=getDeckCard(id)
      return card && (card.element==='none'||selected.includes(card.element))
    }))
    const counts=new Map()
    for(const id of deck.cards)counts.set(id,(counts.get(id)||0)+1)
    assert.ok([...counts.values()].every(n=>n<=3))
  }
})
test('構築ルール: 同名4枚・40枚未満・4元素・トークン・不正IDは拒否',async()=>{
  const {createStarterDeck,validateDeck}=await vite.ssrLoadModule('/src/data/deckRules.ts')
  const base=createStarterDeck(['pyro','hydro','cryo'])
  assert.ok(validateDeck({...base,cards:base.cards.slice(1)}).some(x=>x.includes('40枚')))
  assert.ok(validateDeck({...base,cards:[...Array(4).fill('C011'),...base.cards.slice(4)]})
    .some(x=>x.includes('最大3枚')))
  assert.ok(validateDeck({...base,elements:['pyro','hydro','cryo','geo']})
    .some(x=>x.includes('最大3種類')))
  assert.ok(validateDeck({...base,cards:['token-baron-bunny',...base.cards.slice(1)]})
    .some(x=>x.includes('正式カードではありません')))
  assert.ok(validateDeck({...base,cards:['test-elemental-caster',...base.cards.slice(1)]})
    .some(x=>x.includes('正式カードではありません')))
  assert.ok(validateDeck({...base,elements:['hydro','cryo']})
    .some(x=>x.includes('元素が選択されていません')))
})
test('対戦開始: 2人分の別々の正式40枚デッキをシャッフルして4枚ドロー',async()=>{
  const {createStarterDeck}=await vite.ssrLoadModule('/src/data/deckRules.ts')
  const decks=[createStarterDeck(['pyro']),createStarterDeck(['geo','anemo'])]
  const game=engine.createInitialGameState(decks)
  assert.equal(game.phase,'mulligan')
  for(let i=0;i<2;i++){
    const expected=[...decks[i].cards].sort()
    const actual=[...game.players[i].deck,...game.players[i].hand].sort()
    assert.deepEqual(actual,expected)
    assert.equal(game.players[i].hand.length,4)
    assert.equal(game.players[i].deck.length,36)
  }
  assert.notDeepEqual(decks[0].cards,decks[1].cards)
})
test('不正デッキを渡した対戦開始は拒否され、ランダムデッキにすり替わらない',async()=>{
  const {createStarterDeck}=await vite.ssrLoadModule('/src/data/deckRules.ts')
  const first=createStarterDeck(['pyro'])
  const second=createStarterDeck(['hydro'])
  assert.throws(()=>engine.createInitialGameState([{...first,cards:first.cards.slice(1)},second]),/不正/)
})

test('対象指定ファンファーレは敵不在なら本体のみ出し、敵がいれば対象選択を要求',()=>{
 for(const cardId of ['C012','C019','C042']){
  const state=startedGame()
  state.players[0].pp=10
  state.players[0].hand=[cardId]
  assert.equal(engine.canPlayCard(state,0),true)
  const played=engine.playCard(state,'player1',0)
  assert.equal(played.players[0].field.length,1)
  assert.equal(played.players[0].field[0].cardId,cardId)
  assert.equal(played.players[0].pp,10-engine.getCard(cardId).cost)
  const withEnemy=startedGame()
  withEnemy.players[0].pp=10
  withEnemy.players[0].hand=[cardId]
  place(withEnemy,1,'C001',1,5)
  assert.equal(engine.playCard(withEnemy,'player1',0),withEnemy)
 }
})
test('アミュレットとフォロワーの共有場枠：4+1で満員、残り0枠では双方プレイ不可',()=>{
 let state=startedGame()
 state.players[0].pp=10
 state.players[0].hand=['C016','C001']
 for(let i=0;i<4;i++)place(state,0,'C001',1,2)
 assert.equal(engine.canPlayCard(state,0),true)
 state=engine.playCard(state,'player1',0)
 assert.equal(state.players[0].field.length,4)
 assert.equal(state.players[0].amulets.length,1)
 assert.equal(state.players[0].field.length+state.players[0].amulets.length,5)
 assert.equal(engine.canPlayCard(state,0),false)
 assert.equal(engine.playCard(state,'player1',0),state)
})
test('共有場枠：アミュレット4枚＋フォロワー1枚で満員',()=>{
 let state=startedGame()
 state.players[0].pp=10
 state.players[0].hand=['C001','C016']
 state.players[0].amulets=Array.from({length:4},(_,i)=>({
  instanceId:'test-amulet-'+i,cardId:'C016',turnsRemaining:3,
 }))
 assert.equal(engine.canPlayCard(state,0),true)
 state=engine.playCard(state,'player1',0)
 assert.equal(state.players[0].field.length,1)
 assert.equal(state.players[0].amulets.length,4)
 assert.equal(engine.canPlayCard(state,0),false)
})
test('対象指定を要する敵破壊スペルは敵不在では使用できないまま',()=>{
 const state=startedGame()
 state.players[0].pp=10
 state.players[0].hand=['C018']
 assert.equal(engine.canPlayCard(state,0),false)
 assert.equal(engine.playCard(state,'player1',0),state)
})

test('演出トレース：ランダム雷元素3連撃のHP変化を1撃ずつ記録して再生できる',async()=>{
  const {beginPresentation,compactPresentationFrames,withoutPresentation}=
    await vite.ssrLoadModule('/src/game/presentation.ts')
  const state=startedGame()
  state.players[0].pp=3
  state.players[0].hand=['C061']
  state.players[0].leaderHealth=11
  place(state,1,'C001',0,10)
  const traced=engine.playCard(beginPresentation(state),'player1',0)
  const frames=compactPresentationFrames(state,traced.presentationFrames||[])
  const hp=frames.map(frame=>frame.state.players[1].field[0]?.health).filter(n=>n!==undefined)
  assert.deepEqual(hp,[9,8,7])
  assert.equal(withoutPresentation(traced).players[1].field[0].health,7)
  assert.ok(frames.every(frame=>frame.label.includes('雷')))
})
test('演出トレース：ターン終了時のランダム2連撃と次ターン開始を別フレームで記録',async()=>{
  const {beginPresentation,compactPresentationFrames,withoutPresentation}=
    await vite.ssrLoadModule('/src/game/presentation.ts')
  const state=startedGame()
  place(state,0,'token-guoba',1,3)
  const traced=engine.endTurn(beginPresentation(state))
  const frames=compactPresentationFrames(state,traced.presentationFrames||[])
  const hp=frames.map(frame=>frame.state.players[1].leaderHealth)
  assert.ok(hp.includes(18))
  assert.ok(hp.includes(16))
  assert.ok(hp.indexOf(18)<hp.indexOf(16))
  assert.equal(withoutPresentation(traced).players[1].leaderHealth,16)
  assert.ok(frames.some(frame=>frame.state.currentPlayerId==='player2'))
})
test('演出トレースは任意：無効化した通常のゲーム処理には記録が残らない',async()=>{
  const {beginPresentation,captureFrame,withoutPresentation}=
    await vite.ssrLoadModule('/src/game/presentation.ts')
  const initial=startedGame()
  assert.equal(captureFrame(initial,'test'),initial)
  const traced=beginPresentation(initial)
  const frame=captureFrame(traced,'step')
  assert.equal(frame.presentationFrames.length,1)
  assert.equal(frame.presentationFrames[0].state.presentationFrames,undefined)
  assert.equal(withoutPresentation(frame).presentationFrames,undefined)
})

test('演出トレース：元素反応名が実際の解決結果から記録される',async()=>{
  const {beginPresentation}=await vite.ssrLoadModule('/src/game/presentation.ts')
  const {resolveReactionConsequence}=await vite.ssrLoadModule('/src/game/elemental.ts')
  const state=startedGame()
  const traced=resolveReactionConsequence(beginPresentation(state),1,'dummy','vaporize','pyro',0)
  assert.ok(traced.presentationFrames.some(f=>f.label.includes('蒸発')))
  assert.equal(traced.players[1].leaderHealth,state.players[1].leaderHealth)
})
