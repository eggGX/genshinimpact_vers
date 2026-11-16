
import { useEffect, useRef, useState } from 'react'
import {
  attackFollower,
  attackLeader,
  canFollowerAttack,
  canPlayCard,
  canUseAbility,
  confirmMulligan,
  createInitialGameState,
  endTurn,
  getCard,
  needsPlayTarget,
  needsFriendlyPlayTarget,
  needsAbilityTarget,
  needsFriendlyAbilityTarget,
  activateAbility,
  playCard,
} from './game/engine'
import type { Follower, GameState } from './game/types'
import { beginPresentation, captureFrame, compactPresentationFrames, withoutPresentation, type PresentationFrame } from './game/presentation'
import type { AbilityKind } from './game/engine'
import './App.css'
import { CardLibrary } from './components/CardLibrary'
import { CardArtwork } from './components/CardArtwork'
import { BattleCardTooltip } from './components/BattleCardTooltip'
import { ElementIcon } from './components/ElementIcon'
import { DeckBuilder } from './components/DeckBuilder'
import { FriendRoomLobby } from './components/FriendRoomLobby'
import { createStarterDeck, validateDeck, type DeckDefinition } from './data/deckRules'
import { isGuarded } from './game/neutralRules'

type BothDecks = [DeckDefinition, DeckDefinition]
const STORAGE_KEY = 'genshin-decks-v1'

function loadDecks(): BothDecks {
  const defaults: BothDecks = [
    createStarterDeck(['pyro', 'hydro', 'cryo']),
    createStarterDeck(['electro', 'anemo', 'dendro']),
  ]
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return defaults
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed) || parsed.length !== 2) return defaults
    const normalize = (value: unknown, fallback: DeckDefinition): DeckDefinition => {
      if (!value || typeof value !== 'object') return fallback
      const input = value as Partial<DeckDefinition>
      if (!Array.isArray(input.cards) || !Array.isArray(input.elements) ||
          !input.cards.every(id => typeof id === 'string') ||
          !input.elements.every(id => typeof id === 'string')) return fallback
      // Preserve incomplete drafts for editing; rejected decks cannot start a game.
      return { cards: input.cards, elements: input.elements }
    }
    return [normalize(parsed[0], defaults[0]), normalize(parsed[1], defaults[1])]
  } catch {
    return defaults
  }
}

function App() {
  const [showCardLibrary, setShowCardLibrary] = useState(false)
  const [showFriendLobby, setShowFriendLobby] = useState(false)
  const [decks, setDecks] = useState<BothDecks>(loadDecks)
  const [editingPlayer, setEditingPlayer] = useState<0 | 1 | null>(null)
  const [matchStarted, setMatchStarted] = useState(false)
  const [playback, setPlayback] = useState<{ frames: PresentationFrame[], index: number } | null>(null)
  const [playbackDelay, setPlaybackDelay] = useState<450 | 900 | 1500>(900)
  const playbackLock = useRef(false)

  useEffect(() => {
    if (!playback) return
    const timer = window.setTimeout(() => {
      setPlayback(previous => {
        if (!previous) return null
        if (previous.index + 1 >= previous.frames.length) {
          playbackLock.current = false
          return null
        }
        return { ...previous, index: previous.index + 1 }
      })
    }, playbackDelay)
    return () => window.clearTimeout(timer)
  }, [playback, playbackDelay])

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decks)) } catch { /* storage may be disabled */ }
  }, [decks])

  const updateDeck = (index: 0 | 1, deck: DeckDefinition) => {
    setDecks(previous => index === 0 ? [deck, previous[1]] : [previous[0], deck])
  }
  const beginMatch = () => {
    if (decks.some(deck => validateDeck(deck).length > 0)) return
    playbackLock.current = false
    setPlayback(null)
    setGame(createInitialGameState(decks))
    setMatchStarted(true)
    setMulliganSelection([])
    resetSelection()
  }
  const [game, setGame] = useState(createInitialGameState)
  const shownGame = playback ? playback.frames[playback.index].state : game
  const highlightedFollowers = new Set<string>()
  const highlightedLeaders = new Set<string>()
  if (playback && playback.index > 0) {
    const before = playback.frames[playback.index - 1].state
    const after = playback.frames[playback.index].state
    for (let i = 0; i < 2; i++) {
      const oldPlayer = before.players[i]
      const newPlayer = after.players[i]
      const oldFollowers = new Map(oldPlayer.field.map(f => [f.instanceId, f]))
      for (const follower of newPlayer.field) {
        const old = oldFollowers.get(follower.instanceId)
        if (!old || old.health !== follower.health || old.attack !== follower.attack ||
            old.shield.normal !== follower.shield.normal ||
            old.shield.crystallize !== follower.shield.crystallize ||
            old.aura.map(a => a.element).join() !== follower.aura.map(a => a.element).join()) {
          highlightedFollowers.add(follower.instanceId)
        }
      }
      if (oldPlayer.leaderHealth !== newPlayer.leaderHealth ||
          (oldPlayer.leaderAura ?? []).map(a=>a.element).join() !==
          (newPlayer.leaderAura ?? []).map(a=>a.element).join()) {
        highlightedLeaders.add(newPlayer.id)
      }
    }
  }

  const animateAction = (action: (state: GameState) => GameState, label: string) => {
    if (playbackLock.current) return
    const traced = beginPresentation(game)
    const next = action(traced)
    if (next === traced) return
    const last = captureFrame(next, label)
    const frames = compactPresentationFrames(game, last.presentationFrames ?? [])
    setGame(withoutPresentation(last))
    if (frames.length > 0) {
      playbackLock.current = true
      setPlayback({
        frames: [
          { label: label + '：効果を解決中', state: withoutPresentation(game) },
          ...frames,
        ],
        index: 0,
      })
    }
  }

  const skipPlayback = () => {
    playbackLock.current = false
    setPlayback(null)
  }
  const [inspectedCard, setInspectedCard] = useState<
    { kind: 'follower' | 'amulet'; instanceId: string } | { kind: 'hand'; cardId: string } | null
  >(null)
  const [selectedAttackerId, setSelectedAttackerId] =
    useState<string | null>(null)
  const [selectedHandIndex, setSelectedHandIndex] =
    useState<number | null>(null)
  const [selectedAbility, setSelectedAbility] = useState<{
    followerId: string
    kind: AbilityKind
    firstTargetId?: string
  } | null>(null)
  const [mulliganSelection, setMulliganSelection] =
    useState<number[]>([])

  const currentPlayer = shownGame.players.find(
    p => p.id === shownGame.currentPlayerId
  )!
  const opponent = shownGame.players.find(
    p => p.id !== shownGame.currentPlayerId
  )!
  const winner = shownGame.players.find(
    p => p.id === shownGame.winnerId
  )

  const inspectFollower = inspectedCard?.kind === 'follower'
    ? shownGame.players.flatMap(p => p.field).find(f => f.instanceId === inspectedCard.instanceId)
    : undefined
  const inspectAmulet = inspectedCard?.kind === 'amulet'
    ? shownGame.players.flatMap(p => p.amulets ?? []).find(a => a.instanceId === inspectedCard.instanceId)
    : undefined
  const inspectCard = inspectedCard?.kind === 'hand'
    ? getCard(inspectedCard.cardId)
    : getCard(inspectFollower?.cardId ?? inspectAmulet?.cardId ?? '')
  const inspectOwner = inspectedCard?.kind === 'hand' ? '自分の手札'
    : inspectedCard?.kind === 'follower'
      ? shownGame.players.find(p => p.field.some(f => f.instanceId === inspectedCard.instanceId))?.name ?? '場'
      : inspectedCard?.kind === 'amulet'
        ? shownGame.players.find(p => p.amulets?.some(a => a.instanceId === inspectedCard.instanceId))?.name ?? '場'
        : '場'

  const selectedAttacker = currentPlayer.field.find(
    f => f.instanceId === selectedAttackerId
  )

  const resetSelection = () => {
    setSelectedAttackerId(null)
    setSelectedHandIndex(null)
    setSelectedAbility(null)
  }

  const handleReset = () => {
    skipPlayback()
    setGame(createInitialGameState(decks))
    resetSelection()
    setMulliganSelection([])
  }

  const handleToggleMulligan = (index: number) => {
    setMulliganSelection(previous =>
      previous.includes(index)
        ? previous.filter(i => i !== index)
        : [...previous, index]
    )
  }

  const handleConfirmMulligan = () => {
    const indices = [...mulliganSelection]
    setGame(previous =>
      confirmMulligan(previous, indices)
    )
    setMulliganSelection([])
  }

  const handleEndTurn = () => {
    animateAction(previous => endTurn(previous), 'ターン終了')
    resetSelection()
  }

  const handlePlayCard = (handIndex: number) => {
    const card = getCard(currentPlayer.hand[handIndex])
    if (!card) return

    const noBuffAlly = ['C066', 'C081'].includes(card.id) &&
      !currentPlayer.field.some(f => f.health > 0 &&
        getCard(f.cardId)?.element === (card.id === 'C066' ? 'electro' : 'anemo'))
    if (selectedAbility?.kind === 'skill' && currentPlayer.field.some(f =>
      f.instanceId === selectedAbility.followerId && f.cardId === 'C083')) {
      if (['pyro', 'hydro', 'cryo', 'electro'].includes(card.element)) {
        animateAction(previous => activateAbility(previous, selectedAbility.followerId, 'skill', `hand:${handIndex}`), 'ファルカ：元素付与')
        resetSelection()
      }
      return
    }
    if (!canPlayCard(game, handIndex)) return
    const hasEnemyTarget = opponent.field.some(f => f.health > 0 &&
      !f.keywords.includes('aura') && !f.keywords.includes('stealth'))
    if (!noBuffAlly &&
        ((needsPlayTarget(card) && (card.type === 'spell' || hasEnemyTarget)) ||
          needsFriendlyPlayTarget(card))) {
      setSelectedHandIndex(previous =>
        previous === handIndex ? null : handIndex
      )
      setSelectedAttackerId(null)
      return
    }

    animateAction(previous =>
      playCard(
        previous,
        previous.currentPlayerId,
        handIndex
      ), `${card.name} をプレイ`)
    resetSelection()
  }

  const handleUseAbility = (follower: Follower, kind: AbilityKind) => {
    if (!canUseAbility(game, follower.instanceId, kind)) return
    const card = getCard(follower.cardId)
    if (!card) return
    if ((card.id === 'C083' && kind === 'skill') ||
        needsAbilityTarget(card, kind) || needsFriendlyAbilityTarget(card, kind)) {
      setSelectedAbility({ followerId: follower.instanceId, kind })
      setSelectedAttackerId(null)
      setSelectedHandIndex(null)
      return
    }
    animateAction(previous => activateAbility(previous, follower.instanceId, kind), `${card.name}：${kind === 'skill' ? '元素スキル' : '元素爆発'}`)
    resetSelection()
  }

  const handleSelectAttacker = (follower: Follower) => {
    if (game.winnerId !== null) return
    if (!canFollowerAttack(follower)) return

    setSelectedHandIndex(null)
    setSelectedAttackerId(previous =>
      previous === follower.instanceId
        ? null
        : follower.instanceId
    )
  }

  const handleEnemyFollowerClick = (targetId: string) => {
    if (selectedHandIndex !== null) {
      const index = selectedHandIndex

      animateAction(previous =>
        playCard(
          previous,
          previous.currentPlayerId,
          index,
          targetId
        ), `${getCard(currentPlayer.hand[index])?.name ?? 'カード'} をプレイ`)
      resetSelection()
      return
    }

    if (selectedAbility) {
      const { followerId, kind, firstTargetId } = selectedAbility
      const cardId = currentPlayer.field.find(f => f.instanceId === followerId)?.cardId
      if (cardId === 'C049' && kind === 'skill') {
        const candidates = opponent.field.filter(f => f.health > 0 &&
          !f.keywords.includes('stealth') && !f.keywords.includes('aura'))
        if (candidates.length >= 2 && !firstTargetId) {
          setSelectedAbility({ followerId, kind, firstTargetId: targetId })
          return
        }
        if (firstTargetId === targetId) return
        animateAction(previous => activateAbility(
          previous, followerId, kind,
          firstTargetId ? `${firstTargetId}|${targetId}` : targetId
        ), '元素スキル：指定した対象に発動')
      } else {
        animateAction(previous => activateAbility(previous, followerId, kind, targetId), '元素スキル・爆発の対象効果')
      }
      resetSelection()
      return
    }

    if (!selectedAttackerId) return

    const attackerId = selectedAttackerId
    animateAction(previous =>
      attackFollower(previous, attackerId, targetId)
    , 'フォロワー攻撃')
    resetSelection()
  }

  const handleAttackLeader = () => {
    if (!selectedAttackerId) return

    const attackerId = selectedAttackerId

    animateAction(previous =>
      attackLeader(previous, attackerId)
    , 'リーダー攻撃')
    resetSelection()
  }

  const renderFollower = (
    follower: Follower,
    isOpponent: boolean
  ) => {
    const card = getCard(follower.cardId)

    const canAttack =
      !isOpponent &&
      game.winnerId === null &&
      canFollowerAttack(follower)

    const friendlyPlayId = selectedHandIndex === null
      ? undefined : currentPlayer.hand[selectedHandIndex]
    const friendlySkillId = selectedAbility
      ? currentPlayer.field.find(f => f.instanceId === selectedAbility.followerId)?.cardId
      : undefined
    const isFriendlyTarget = !isOpponent &&
      ((selectedHandIndex !== null &&
        ['C021', 'C044', 'C066', 'C081', 'C030'].includes(friendlyPlayId ?? '') &&
        (friendlyPlayId !== 'C066' || card?.element === 'electro') &&
        (friendlyPlayId !== 'C081' || card?.element === 'anemo')) ||
       (selectedAbility?.kind === 'skill' && friendlySkillId === 'C066' &&
        card?.element === 'electro'))

    const isSelected =
      follower.instanceId === selectedAttackerId

    const isTarget =
      isOpponent &&
      game.winnerId === null &&
      (selectedAttacker === undefined || !isGuarded(opponent) ||
        follower.keywords.includes('guard') ||
        selectedAttacker.keywords.includes('plunge_attack')) &&
      (selectedAttacker !== undefined
        ? !follower.keywords.includes('intimidate') && !follower.keywords.includes('stealth')
        : selectedHandIndex !== null || selectedAbility !== null
          ? !follower.keywords.includes('aura') && !follower.keywords.includes('stealth')
          : false)

    return (
      <div key={highlightedFollowers.has(follower.instanceId)
        ? `${follower.instanceId}-hit-${playback?.index}`
        : follower.instanceId}
        className={['follower-wrapper',
          highlightedFollowers.has(follower.instanceId) ? 'battle-hit' : '',
          follower.aura.length ? 'follower-has-aura' : ''].join(' ')}
        onMouseEnter={() => setInspectedCard({ kind: 'follower', instanceId: follower.instanceId })}
        onMouseLeave={() => setInspectedCard(null)}>
      {follower.aura.length > 0 && <div className="follower-aura-icons"
        aria-label={`元素付着：${follower.aura.map(a=>a.element).join('、')}`}>
        {follower.aura.map((a,i)=><span key={i} className="aura-icon-holder">
          <ElementIcon element={a.element} size="md" />
        </span>)}
      </div>}
      <button
        type="button"
        className={[
          'field-card',
          `card-element--${card?.element ?? 'none'}`,
          `card-rarity--${card?.rarity ?? 'bronze'}`,
          canAttack ? 'can-attack' : '',
          isSelected ? 'selected-card' : '',
          isTarget ? 'attack-target' : '',
        ].filter(Boolean).join(' ')}
        disabled={!canAttack && !isTarget && !isFriendlyTarget}
        onFocus={() => setInspectedCard({ kind: 'follower', instanceId: follower.instanceId })}
        onBlur={() => setInspectedCard(null)}
        onClick={() => {
          if (isOpponent) {
            handleEnemyFollowerClick(follower.instanceId)
          } else if (isFriendlyTarget && selectedHandIndex !== null) {
            animateAction(previous => playCard(
              previous, previous.currentPlayerId,
              selectedHandIndex, follower.instanceId
            ), '味方フォロワーを指定してプレイ')
            resetSelection()
          } else if (isFriendlyTarget && selectedAbility) {
            const { followerId, kind } = selectedAbility
            animateAction(previous => activateAbility(previous, followerId, kind, follower.instanceId), '味方フォロワーへの元素能力')
            resetSelection()
          } else {
            handleSelectAttacker(follower)
          }
        }}
      >
        {card && <CardArtwork cardId={card.id} name={card.name} className="card-artwork--field" />}
        <strong>
          {card?.name ?? '不明なカード'}
        </strong>
        {card && <ElementIcon element={card.element} size="xs" />}
        <span className="field-keywords" aria-label="カード状態">
          {follower.keywords.includes('guard') && <span title="守護" className="keyword-pill">守</span>}
          {follower.keywords.includes('storm') && <span title="疾走" className="keyword-pill">疾</span>}
          {follower.keywords.includes('rush_only') && <span title="突進" className="keyword-pill">突</span>}
          {follower.keywords.includes('aura') && <span title="オーラ" className="keyword-pill">護</span>}
          {follower.keywords.includes('frozen') && <span title="凍結" className="keyword-pill keyword-pill--cryo">氷</span>}
          {follower.shield.normal > 0 && <span title={`通常シールド ${follower.shield.normal}`} className="keyword-pill">盾{follower.shield.normal}</span>}
          {follower.shield.crystallize > 0 && <span title={`結晶シールド ${follower.shield.crystallize}`} className="keyword-pill">晶{follower.shield.crystallize}</span>}

        </span>

        <span className="follower-stats"><b className="stat-attack">{follower.attack}</b><b className="stat-health">{follower.health}</b></span>

        {follower.keywords.includes('double_attack') && (
          <small>【2回攻撃】このターンの攻撃：{follower.attacksThisTurn ?? (follower.hasAttacked ? 1 : 0)}/2回</small>
        )}
        {follower.keywords.includes('next_damage_plus_2') && (
          <small>次の被ダメージ+2（モナの星命定軌）</small>
        )}
        {follower.keywords.includes('normal_attack_electro') && (
          <small>【元素攻撃：雷】</small>
        )}
        {follower.keywords.includes('plunge_attack') && (
          <small>【落下攻撃】守護無視・攻撃後敵全体雷1</small>
        )}
        {follower.keywords.includes('normal_attack_cryo') && (
          <small>【元素攻撃：氷】</small>
        )}
        {follower.keywords.includes('normal_attack_hydro') && (
          <small>【元素攻撃：水】</small>
        )}
        {follower.keywords.includes('attack_heal_2') && (
          <small>【攻撃時】自分のリーダーを2回復</small>
        )}
        {follower.keywords.includes('guard') && (
          <small>【守護】他の味方とリーダーを守る</small>
        )}
        {follower.keywords.includes('rush') && (
          <small>【突進】登場ターンはフォロワーのみ攻撃可能</small>
        )}
        {follower.keywords.includes('storm') && (
          <small>【疾走】登場ターンから攻撃可能</small>
        )}
        {follower.keywords.includes('stealth') && (
          <small>【潜伏】攻撃・対象指定不可（攻撃時解除）</small>
        )}
        {follower.keywords.includes('aura') && (
          <small>【オーラ】効果の対象に選べない</small>
        )}
        {follower.keywords.includes('intimidate') && (
          <small>【威圧】フォロワーから攻撃されない</small>
        )}
        {follower.cardId === 'C025' && (
          <small>
            HP10以下：攻撃力+2
            （{(isOpponent ? opponent : currentPlayer).leaderHealth <= 10 ? '有効' : '無効'}）
          </small>
        )}
        {follower.keywords.includes('frozen') && (
          <small style={{ color: '#aee1ff', fontWeight: 'bold' }}>
            凍結中（攻撃不可）
          </small>
        )}
        {follower.keywords.includes('superconduct') && (
          <small>超電導：次の物理被ダメージ+2</small>
        )}
        {follower.keywords.filter(k => k.startsWith('burning:')).map(k => (
          <small key={k}>燃焼：残り{k.slice(8)}ターン</small>
        ))}
        {follower.keywords.filter(k => k.startsWith('quicken:')).map(k => (
          <small key={k}>原激化：残り{k.slice(8)}回</small>
        ))}
        {follower.cardId === 'dendro-core' && (
          <small style={{ color: '#b5ed91' }}>草原核（攻撃不可）</small>
        )}
        {follower.shield.normal > 0 && (
          <small>通常シールド：{follower.shield.normal}</small>
        )}
        {follower.shield.crystallize > 0 && (
          <small>結晶シールド：{follower.shield.crystallize}</small>
        )}

        <small className="follower-ready">{isOpponent ? 'ENEMY' : canAttack ? 'READY' : 'WAIT'}</small>
      </button>
      {!isOpponent && (card?.elementalSkill || card?.elementalBurst) && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {card.elementalSkill && (
            <button type="button"
              disabled={!canUseAbility(game, follower.instanceId, 'skill')}
              onClick={() => handleUseAbility(follower, 'skill')}
              title={card.elementalSkill.name}>
              スキル PP{card.elementalSkill.ppCost ?? 0}
              {card.id === 'C023'
                ? ` ${follower.skillUsesThisTurn ?? (follower.skillUsed ? 1 : 0)}/3回`
                : follower.skillUsed ? ' 済' : ''}
            </button>
          )}
          {card.elementalBurst && (
            <button type="button"
              disabled={!canUseAbility(game, follower.instanceId, 'burst')}
              onClick={() => handleUseAbility(follower, 'burst')}
              title={card.elementalBurst.name}>
              爆発 EN{card.elementalBurst.energyCost ?? 0}
            </button>
          )}
        </div>
      )}
      </div>
    )
  }

  const renderField = (
    player: typeof currentPlayer,
    isOpponent: boolean
  ) => {
    const followers = player.field
    const amulets = player.amulets ?? []
    return <div className="card-slot" aria-label={`場：フォロワー${followers.length}体・アミュレット${amulets.length}枚`}>
      {followers.length + amulets.length === 0
        ? 'カード配置エリア'
        : <>
          {followers.map(f => renderFollower(f, isOpponent))}
          {amulets.map(amulet => {
            const card = getCard(amulet.cardId)
            return <div className="follower-wrapper" key={amulet.instanceId}
              onMouseEnter={() => setInspectedCard({ kind: 'amulet', instanceId: amulet.instanceId })}
              onMouseLeave={() => setInspectedCard(null)}>
              <div className={['field-card','amulet-card',
                `card-element--${card?.element ?? 'none'}`,
                `card-rarity--${card?.rarity ?? 'bronze'}`].join(' ')}>
                <CardArtwork cardId={amulet.cardId} name={card?.name ?? amulet.cardId} className="card-artwork--field" />
                <strong>{card?.name ?? amulet.cardId}</strong>
                <ElementIcon element={card?.element ?? 'none'} size="xs" />
                <span className="amulet-type">アミュレット</span>
                <span className="amulet-countdown">残り {amulet.turnsRemaining} ターン</span>
              </div>
            </div>
          })}
        </>}
    </div>
  }

  if (showCardLibrary) {
    return <CardLibrary onBack={() => setShowCardLibrary(false)} />
  }

  // Keep the online lobby mounted while the deck editor is open.
  // Its room code, Firebase polling and participant role must survive navigation.
  if (showFriendLobby && !matchStarted) {
    return <>
      <div style={{ display: editingPlayer !== null ? 'none' : undefined }}>
        <FriendRoomLobby onBack={() => setShowFriendLobby(false)}
          deck={decks[0]} onEditDeck={() => setEditingPlayer(0)} />
      </div>
      {editingPlayer !== null && <DeckBuilder
        title="フレンド対戦：自分のデッキ"
        deck={decks[editingPlayer]}
        onChange={deck => updateDeck(editingPlayer, deck)}
        onBack={() => setEditingPlayer(null)}
      />}
    </>
  }

  if (editingPlayer !== null) {
    return <DeckBuilder title={editingPlayer === 0 ? 'プレイヤー1（自分）' : 'プレイヤー2（相手）'}
      deck={decks[editingPlayer]} onChange={deck => updateDeck(editingPlayer, deck)}
      onBack={() => setEditingPlayer(null)} />
  }

  if (!matchStarted) {
    const errors = decks.map(validateDeck)
    return <div className="game">
      <header className="game-header">
        <h1>原神カードゲーム</h1><span>対戦準備</span>
        <button type="button" onClick={() => setShowCardLibrary(true)}>カード一覧</button>
      </header>
      <main className="deck-setup">
        <h2>デッキを選択</h2>
        <p>各プレイヤーの40枚デッキを編集できます。使用元素は最大3種類、無元素は自由に採用可能、同じカードは3枚までです。</p>
        <div className="deck-setup-grid">
          {decks.map((deck, index) => <section key={index} className="deck-setup-card">
            <h3 className="deck-setup-player">
              <span className="deck-setup-avatar" aria-label={index === 0 ? '空' : '蛍'}>
                <img
                  src={`${import.meta.env.BASE_URL}images/travelers/${index === 0 ? 'aether-icon.webp' : 'lumine-icon.webp'}`}
                  alt={index === 0 ? '空' : '蛍'}
                  onError={event => { event.currentTarget.style.display = 'none' }}
                />
                <span aria-hidden="true">{index === 0 ? '空' : '蛍'}</span>
              </span>
              <span>プレイヤー{index + 1}（{index === 0 ? '自分' : '相手'}）</span>
            </h3>
            <strong>{deck.cards.length} / 40枚</strong>
            <div className="deck-setup-elements">
              <span>元素：</span>
              {deck.elements.length
                ? <span className="deck-setup-element-icons">
                    {deck.elements.map(element =>
                      <ElementIcon key={element} element={element} size="md" />
                    )}
                  </span>
                : <span>未選択</span>}
            </div>
            {errors[index].length === 0
              ? <p className="deck-setup-valid">構築完了</p>
              : <p className="deck-setup-warning">{errors[index][0]}</p>}
            <button type="button" onClick={() => setEditingPlayer(index as 0 | 1)}>
              デッキを編集
            </button>
          </section>)}
        </div>
        <button type="button" className="end-turn deck-start"
          disabled={errors.some(items => items.length > 0)} onClick={beginMatch}>
          この2つのデッキでローカル対戦開始
        </button>
        <button type="button" className="friend-match-entry" onClick={() => setShowFriendLobby(true)}>
          フレンド対戦（ルーム作成・参加）
        </button>
        <p className="deck-setup-note">編集内容はこのブラウザに保存されます。対戦開始後は再度デッキ選択画面に戻れます。</p>
      </main>
    </div>
  }

  if (game.phase === 'mulligan') {
    return (
      <div className="game">
        <header className="game-header">
          <h1>原神カードゲーム</h1>
          <span>ゲーム準備</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setShowCardLibrary(true)}>
              カード一覧
            </button>
            <button type="button" onClick={() => { setMatchStarted(false); resetSelection() }}>
              デッキ選択へ戻る
            </button>
            <button type="button" onClick={handleReset}>
              ゲームリセット
            </button>
          </div>
        </header>

        <main className="mulligan-scene">
          <h2>{currentPlayer.name} のマリガン</h2>

          <p>交換したいカードを選択してください。</p>
          <p>
            選択枚数：{mulliganSelection.length} / 4
          </p>

          <div className="mulligan-cards">
            {currentPlayer.hand.map((cardId, index) => {
              const card = getCard(cardId)
              if (!card) return null

              const selected =
                mulliganSelection.includes(index)

              return (
                <button
                  type="button"
                  key={index}
                  onClick={() =>
                    handleToggleMulligan(index)
                  }
                  className={[
                    'mulligan-card', `card-element--${card.element}`,
                    `card-rarity--${card.rarity}`, selected ? 'selected' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span>コスト {card.cost}</span>
                  <CardArtwork cardId={card.id} name={card.name} className="card-artwork--mulligan" />
                  <strong>{card.name}</strong>
                  <span>
                    {card.type === 'follower'
                      ? `${card.attack} / ${card.health}`
                      : card.type === 'spell' ? 'スペル' : 'アミュレット'}
                  </span>
                  <span>
                    {selected ? '交換する ✓' : 'キープ'}
                  </span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="end-turn mulligan-confirm"
            onClick={handleConfirmMulligan}
          >
            {mulliganSelection.length === 0
              ? 'すべてキープして確定'
              : `${mulliganSelection.length}枚交換して確定`}
          </button>

          <p style={{ marginTop: 25 }}>
            デッキ残数：{currentPlayer.deck.length}枚
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className={['game','game--battle',playback ? 'game--animating' : ''].join(' ')}>
      <header className="game-header game-header--battle">
        <div className="game-brand"><span className="brand-crest">✦</span><span><strong>原神カードゲーム</strong><small>ELEMENTAL DUEL</small></span></div>
        <span className="turn-counter"><small>ROUND</small><strong>{shownGame.turn}</strong></span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => setShowCardLibrary(true)}>
            カード一覧
          </button>
          <button type="button" onClick={() => { setMatchStarted(false); resetSelection() }}>
            デッキ選択へ戻る
          </button>
          <button type="button" onClick={handleReset}>
            ゲームリセット
          </button>
        </div>
      </header>

      {playback && <div className="battle-playback" role="status" aria-live="polite">
        <div className="battle-playback-heading"><span className="battle-playback-icon">✦</span>
          <span>戦闘演出 {playback.index + 1} / {playback.frames.length}</span>
        </div>
        <strong className="battle-playback-description">{playback.frames[playback.index].label}</strong>
        <div className="battle-playback-controls">
          <label>再生速度
            <select value={playbackDelay} onChange={e => setPlaybackDelay(Number(e.target.value) as 450 | 900 | 1500)}>
              <option value={1500}>ゆっくり</option>
              <option value={900}>標準</option>
              <option value={450}>速い</option>
            </select>
          </label>
          <button type="button" onClick={skipPlayback}>演出をスキップ</button>
        </div>
      </div>}

      {winner && (
        <div className="winner-banner">
          {winner.name} の勝利！
        </div>
      )}

      <section className="player opponent">
        <div className="player-side-label">
          <span className="side-label-dot" /> OPPONENT <strong>{opponent.name}</strong>
          <span className="leader-aura-status" aria-label={`リーダー元素付着：${opponent.leaderAura?.map(a => a.element).join('、') || 'なし'}`}>
            {(opponent.leaderAura?.length ?? 0) > 0
              ? opponent.leaderAura?.map((a, i) =>
                  <span key={i} className="aura-icon-holder">
                    <ElementIcon element={a.element} size="sm" />
                  </span>)
              : <span className="leader-aura-empty">付着なし</span>}
          </span>
        </div>
        <button
          type="button"
          key={highlightedLeaders.has(opponent.id) ? `opponent-hit-${playback?.index}` : 'opponent-leader'}
          className={[
            'leader',
            'leader-button',
            highlightedLeaders.has(opponent.id) ? 'leader-hit' : '',
            selectedAttacker ? 'attack-target' : '',
          ].filter(Boolean).join(' ')}
          disabled={
            !selectedAttacker ||
            game.winnerId !== null ||
            (isGuarded(opponent) && !selectedAttacker.keywords.includes('plunge_attack')) ||
            (selectedAttacker.keywords.includes('rush_only') && !selectedAttacker.keywords.includes('storm'))
          }
          onClick={handleAttackLeader}
        >
          <span className="leader-avatar" aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}images/travelers/${opponent.id === 'player1' ? 'aether-icon.webp' : 'lumine-icon.webp'}`} alt="" draggable={false} />
          </span>
          <span className="leader-caption">{opponent.name}</span>
          <span className="leader-health"><span className="leader-health-icon">♥</span><strong>{opponent.leaderHealth}</strong><small>/{opponent.leaderMaxHealth}</small></span>
        </button>

        <div className="player-resources">
          <div className="resource-head pp-resource-head">
            <span className="resource-caption">PLAY POINT</span>
            <span className="pp-values" aria-label={`現在PP ${opponent.pp}、最大PP ${opponent.maxPp}`}>
              <span className="pp-current"><small>現在</small><strong>{opponent.pp}</strong></span>
              <span className="pp-max"><small>最大</small><strong>{opponent.maxPp}</strong></span>
            </span>
          </div>
          <div className="pp-gems" aria-label={`現在PP ${opponent.pp}、最大PP ${opponent.maxPp}`}>
            {Array.from({length:10},(_,i)=><span key={i}
              className={`pp-gem ${i < opponent.pp ? 'active' : i < opponent.maxPp ? 'spent' : 'locked'}`}
              title={i < opponent.pp ? '使用可能PP' : i < opponent.maxPp ? '消費済みPP' : '未解放PP'}
            />)}
          </div>
          <div className="resource-head energy-head"><span className="resource-caption">ELEMENTAL ENERGY</span><strong>{opponent.energy}<small> / 5</small></strong></div>
          <div className="energy-gems">{Array.from({length:5},(_,i)=><span key={i} className={i<opponent.energy?'energy-gem active':'energy-gem'}/>)}</div>
        </div>
        <div className="player-counts"><span>山札 <strong>{opponent.deck.length}</strong></span><span>手札 <strong>{opponent.hand.length}</strong></span><span>墓場 <strong>{opponent.graveyard.length}</strong></span></div>
        <div className="player-effects">
        {(opponent.bondOfLife ?? 0) > 0 && <div>命の契約：{opponent.bondOfLife}</div>}
        {opponent.leaderShield && (
          <div>リーダーシールド：通常 {opponent.leaderShield.normal} ／ 結晶 {opponent.leaderShield.crystallize}</div>
        )}
        {(opponent.leaderBurningTurns ?? 0) > 0 && (
          <div>リーダー燃焼：残り{opponent.leaderBurningTurns}ターン</div>
        )}
        </div>
      </section>

      <section className="field">
        <div className="field-row">
          <p className="zone-label"><span>ENEMY FIELD</span><small>{opponent.field.length + (opponent.amulets?.length ?? 0)} / 5</small></p>
          {renderField(opponent, true)}
        </div>

        <div className="field-divider"><span className="field-divider-emblem">✦</span><span className="field-divider-text">ELEMENTAL BATTLE</span></div>

        <div className="field-row">
          <p className="zone-label"><span>YOUR FIELD</span><small>{currentPlayer.field.length + (currentPlayer.amulets?.length ?? 0)} / 5</small></p>
          {renderField(currentPlayer, false)}
        </div>
      </section>

      <section className="player self">
        <div className="player-side-label">
          <span className="side-label-dot" /> YOU <strong>{currentPlayer.name}</strong>
          <span className="leader-aura-status" aria-label={`リーダー元素付着：${currentPlayer.leaderAura?.map(a => a.element).join('、') || 'なし'}`}>
            {(currentPlayer.leaderAura?.length ?? 0) > 0
              ? currentPlayer.leaderAura?.map((a, i) =>
                  <span key={i} className="aura-icon-holder">
                    <ElementIcon element={a.element} size="sm" />
                  </span>)
              : <span className="leader-aura-empty">付着なし</span>}
          </span>
        </div>
        <div key={highlightedLeaders.has(currentPlayer.id) ? `self-hit-${playback?.index}` : 'self-leader'}
          className={highlightedLeaders.has(currentPlayer.id) ? 'leader leader-hit' : 'leader'}>
          <span className="leader-avatar" aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}images/travelers/${currentPlayer.id === 'player1' ? 'aether-icon.webp' : 'lumine-icon.webp'}`} alt="" draggable={false} />
          </span>
          <span className="leader-caption">{currentPlayer.name}</span>
          <span className="leader-health"><span className="leader-health-icon">♥</span><strong>{currentPlayer.leaderHealth}</strong><small>/{currentPlayer.leaderMaxHealth}</small></span>
        </div>

        <div className="player-resources">
          <div className="resource-head pp-resource-head">
            <span className="resource-caption">PLAY POINT</span>
            <span className="pp-values" aria-label={`現在PP ${currentPlayer.pp}、最大PP ${currentPlayer.maxPp}`}>
              <span className="pp-current"><small>現在</small><strong>{currentPlayer.pp}</strong></span>
              <span className="pp-max"><small>最大</small><strong>{currentPlayer.maxPp}</strong></span>
            </span>
          </div>
          <div className="pp-gems" aria-label={`現在PP ${currentPlayer.pp}、最大PP ${currentPlayer.maxPp}`}>
            {Array.from({length:10},(_,i)=><span key={i}
              className={`pp-gem ${i < currentPlayer.pp ? 'active' : i < currentPlayer.maxPp ? 'spent' : 'locked'}`}
              title={i < currentPlayer.pp ? '使用可能PP' : i < currentPlayer.maxPp ? '消費済みPP' : '未解放PP'}
            />)}
          </div>
          <div className="resource-head energy-head"><span className="resource-caption">ELEMENTAL ENERGY</span><strong>{currentPlayer.energy}<small> / 5</small></strong></div>
          <div className="energy-gems">{Array.from({length:5},(_,i)=><span key={i} className={i<currentPlayer.energy?'energy-gem active':'energy-gem'}/>)}</div>
        </div>
        <div className="player-counts"><span>山札 <strong>{currentPlayer.deck.length}</strong></span><span>手札 <strong>{currentPlayer.hand.length}</strong></span><span>墓場 <strong>{currentPlayer.graveyard.length}</strong></span></div>
        <div className="player-effects">
        {(currentPlayer.crests ?? []).map((crest, index) => (
          <div key={index}>
            クレスト【{crest.id === 'C034' ? '歌声の環' : getCard(crest.id)?.name ?? crest.id}】
            残り{crest.turnsRemaining}ターン
            {crest.id === 'C010' && `（発動済み：${crest.usedElements.join('・') || 'なし'}）`}
          </div>
        ))}
        {(currentPlayer.bondOfLife ?? 0) > 0 && <div>命の契約：{currentPlayer.bondOfLife}</div>}
        {currentPlayer.leaderShield && (
          <div>リーダーシールド：通常 {currentPlayer.leaderShield.normal} ／ 結晶 {currentPlayer.leaderShield.crystallize}</div>
        )}
        {(currentPlayer.leaderBurningTurns ?? 0) > 0 && (
          <div>リーダー燃焼：残り{currentPlayer.leaderBurningTurns}ターン</div>
        )}
        </div>

        <button
          type="button"
          className="end-turn"
          disabled={shownGame.winnerId !== null || Boolean(playback)}
          onClick={handleEndTurn}
        >
          <span>END TURN</span><strong>ターン終了</strong>
        </button>
      </section>

      <div className="battle-message" role="status" aria-live="polite"><span className="battle-message-icon">✧</span>
        {winner
          ? 'ゲーム終了'
          : selectedAbility !== null
            ? currentPlayer.field.find(f => f.instanceId === selectedAbility.followerId)?.cardId === 'C083'
              ? 'ファルカ：捨てる炎・水・氷・雷の手札カードを選択してください'
              : currentPlayer.field.find(f => f.instanceId === selectedAbility.followerId)?.cardId === 'C066'
              ? '九条裟羅：強化する味方雷元素フォロワーを選択してください'
              : selectedAbility.firstTargetId
              ? 'ディオナのスキル：2体目の敵フォロワーを選択してください'
              : '元素スキル・元素爆発の対象となる敵フォロワーを選択してください'
          : selectedHandIndex !== null
            ? ['C021', 'C044', 'C066', 'C081', 'C030'].includes(currentPlayer.hand[selectedHandIndex])
              ? currentPlayer.hand[selectedHandIndex] === 'C081'
                ? 'ファルザン：他の味方風元素フォロワーを選択してください'
                : currentPlayer.hand[selectedHandIndex] === 'C066'
                ? '九条裟羅：他の味方雷元素フォロワーを選択してください'
                : currentPlayer.hand[selectedHandIndex] === 'C030'
                ? '古華剣・裁雨留虹：効果を付与する味方フォロワーを選択してください'
                : '味方強化のファンファーレ：味方フォロワーか「自身」を選択してください'
              : 'ファンファーレの対象となる敵フォロワーを選択してください'
            : selectedAttacker
              ? '攻撃対象を選択してください'
              : 'カードをプレイするか、攻撃可能なフォロワーを選択してください'}
      </div>

      {selectedHandIndex !== null && ['C021', 'C044'].includes(currentPlayer.hand[selectedHandIndex]) && (
        <button type="button" onClick={() => {
          animateAction(previous => playCard(previous, previous.currentPlayerId,
            selectedHandIndex, 'self'), '自身を強化して召喚')
          resetSelection()
        }}>
          自身を強化して召喚
        </button>
      )}

      <footer className="hand">
        <div className="hand-label"><span>YOUR HAND</span><strong>{currentPlayer.hand.length} / 9</strong></div>
        <div className="hand-cards"
          onMouseMove={event => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.hand-card')
            const index = button ? Number(button.dataset.handIndex) : -1
            const cardId = currentPlayer.hand[index]
            if (cardId) setInspectedCard(previous =>
              previous?.kind === 'hand' && previous.cardId === cardId
                ? previous : { kind: 'hand', cardId })
          }}
          onMouseLeave={() => setInspectedCard(null)}>
        {currentPlayer.hand.map((cardId, index) => {
          const card = getCard(cardId)
          if (!card) return null

          const varkaChoice = selectedAbility?.kind === 'skill' &&
            currentPlayer.field.some(f => f.instanceId === selectedAbility.followerId && f.cardId === 'C083')
          const playable = varkaChoice
            ? ['pyro','hydro','cryo','electro'].includes(card.element)
            : canPlayCard(game, index)
          const selected = selectedHandIndex === index

          return (
            <button
              type="button"
              className={[
                'hand-card',
                `card-element--${card.element}`,
                `card-rarity--${card.rarity}`,
                selected ? 'selected-card' : '',
              ].filter(Boolean).join(' ')}
              key={`${cardId}-${index}`}
              disabled={!playable}
              data-hand-index={index}
              onMouseEnter={() => setInspectedCard({ kind: 'hand', cardId })}
              onFocus={() => setInspectedCard({ kind: 'hand', cardId })}
              onBlur={() => setInspectedCard(null)}
              onClick={() => handlePlayCard(index)}
            >
              <span className="card-cost">
                {card.cost}
              </span>
              <CardArtwork cardId={card.id} name={card.name} className="card-artwork--hand" />
              <strong>{card.name}</strong>
              <ElementIcon element={card.element} size="xs" />
              <span className="hand-card-stats">
                {card.type === 'follower'
                  ? `${card.attack} / ${card.health}`
                  : card.type === 'spell' ? 'スペル' : 'アミュレット'}
              </span>
            </button>
          )
        })}
        </div>
      </footer>
      {inspectCard && <BattleCardTooltip card={inspectCard} follower={inspectFollower}
        amulet={inspectAmulet} ownerLabel={inspectOwner} />}
    </div>
  )
}

export default App
