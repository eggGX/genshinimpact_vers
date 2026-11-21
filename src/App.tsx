
import { useEffect, useRef, useState, type ReactNode, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
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
import type { ElementType, Follower, GameState, Player } from './game/types'
import { beginPresentation, captureFrame, compactPresentationFrames, withoutPresentation, type PresentationFrame } from './game/presentation'
import type { AbilityKind } from './game/engine'
import './App.css'
import { CardLibrary } from './components/CardLibrary'
import { CardArtwork } from './components/CardArtwork'
import { BattleCardTooltip } from './components/BattleCardTooltip'
import { ElementIcon } from './components/ElementIcon'
import { CrestIcons } from './components/CrestIcons'
import { DeckBuilder } from './components/DeckBuilder'
import { DeckManager } from './components/DeckManager'
import { SavedDeckPicker } from './components/SavedDeckPicker'
import { loadSavedDecks, persistSavedDecks, type SavedDeck } from './data/savedDecks'
import { FriendRoomLobby } from './components/FriendRoomLobby'
import { createStarterDeck, validateDeck, type DeckDefinition } from './data/deckRules'
import { isGuarded } from './game/neutralRules'
import type { OnlineMatchView, OnlinePlayerView, OnlinePresentationEvent, OnlinePresentationSnapshot } from './online/matchClient'
import type { OnlineAction } from '../server/src/matchActions'

type BattleHistoryEvent = {
  id: string
  turn: number
  actorId: string
  title: string
  playedCardId?: string
  before: GameState
  after: GameState
  frames: PresentationFrame[]
}

type HistoryCardEntry = { id: string; cardId: string; ownerId: string; turn: number }

function historyDestroyedCards(event: BattleHistoryEvent): HistoryCardEntry[] {
  const steps = [event.before, ...event.frames.map(frame => frame.state), event.after]
  const seen = new Set<string>()
  const result: HistoryCardEntry[] = []
  for (let i=1;i<steps.length;i++) {
    const before=steps[i-1], after=steps[i]
    for (const player of before.players) {
      const next = after.players.find(p=>p.id===player.id)
      if (!next) continue
      const alive = new Set([...next.field.map(f=>f.instanceId),...(next.amulets??[]).map(a=>a.instanceId)])
      for (const piece of [...player.field, ...(player.amulets??[])]) {
        if (alive.has(piece.instanceId) || seen.has(piece.instanceId)) continue
        seen.add(piece.instanceId)
        result.push({id:event.id+'-'+piece.instanceId,cardId:piece.cardId,ownerId:player.id,turn:event.turn})
      }
    }
  }
  return result
}

type DrawFlight = {
  id: number
  cardId?: string
  isSelf: boolean
  x: number
  y: number
  dx: number
  dy: number
  delay: number
}

type BattleNotice = {
  key: string
  cardId: string
  actorId: string
  abilityKind?: AbilityKind
}
type HitElement = Exclude<ElementType, 'none'>

/** Infer the visual source from public attack/ability metadata and captured board state.
 * This is presentation-only: an unknown/physical hit gets no elemental particles.
 */
function hitElementForPlayback(
  frames: PresentationFrame[], index: number, affectedPlayerId: string,
  attackerId?: string, abilityCardId?: string,
): HitElement | null {
  if (index <= 0) return null
  const start = frames[0].state
  const actor = start.players.find(p => p.id === start.currentPlayerId)
  const label = frames[index].label
  const elementNames: Array<[string, HitElement]> = [
    ['炎', 'pyro'], ['水', 'hydro'], ['氷', 'cryo'], ['雷', 'electro'],
    ['風', 'anemo'], ['岩', 'geo'], ['草', 'dendro'],
  ]
  // Explicit elemental hit labels (and burning ticks) take priority.
  const named = elementNames.find(([name]) =>
    label.includes(`${name}元素`) || label.includes(`${name}ダメージ`) ||
    (name === '炎' && label.includes('燃焼ダメージ')))
  if (named) return named[1]
  if (actor && /攻撃/.test(frames[0].label)) {
    const source = attackerId
      ? actor.field.find(f => f.instanceId === attackerId)
      : actor.field.find(f => frames[0].label.includes(`${getCard(f.cardId)?.name ?? f.cardId}が`))
    if (!source) return null
    const opponent = start.players.find(p => p.id !== actor.id)
    const other = opponent?.field.find(f => {
      const card = getCard(f.cardId)
      return frames[0].label.includes(`${card?.name ?? f.cardId}を攻撃`)
    })
    const hitter = affectedPlayerId === actor.id ? other : source
    if (!hitter) return null
    const infused = hitter.keywords.find(k => k.startsWith('normal_attack_'))?.slice(14) as ElementType | undefined
    const element = infused ?? getCard(hitter.cardId)?.normalAttackElement ?? 'none'
    return element !== 'none' ? element : null
  }
  if (actor && affectedPlayerId !== actor.id && abilityCardId) {
    const element = getCard(abilityCardId)?.element ?? 'none'
    return element !== 'none' ? element : null
  }
  return null
}

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

/** Convert one public server projection to the shared battle UI's player shape.
 * Placeholder IDs preserve counts only; private opponent cards are never exposed.
 */
function projectOnlinePlayer(p: OnlinePlayerView, isSelf: boolean): Player {
  return {
    ...p,
    deck: Array<string>(p.deckCount).fill('hidden'),
    hand: isSelf ? (p.hand ?? []) : Array<string>(p.handCount).fill('hidden'),
    field: p.field.map(f => ({
      ...f,
      aura: f.aura ?? [],
      shield: f.shield ?? { normal: 0, crystallize: 0 },
    })),
    amulets: p.amulets ?? [],
    crests: p.crests ?? [],
    leaderAura: p.leaderAura ?? [],
    leaderShield: p.leaderShield ?? { normal: 0, crystallize: 0 },
    graveyard: p.graveyard,
  }
}

function projectOnlineSnapshot(snapshot: OnlinePresentationSnapshot, seat: 0 | 1): GameState {
  return {
    turn: snapshot.turn,
    phase: snapshot.phase,
    currentPlayerId: snapshot.currentPlayerId,
    winnerId: snapshot.winnerId,
    players: [
      projectOnlinePlayer(snapshot.players[0], seat === 0),
      projectOnlinePlayer(snapshot.players[1], seat === 1),
    ],
  }
}

type MulliganReveal = {
  playerName: string
  originalHand: string[]
  hand: string[]
  replacedIndices: number[]
}

/** Keep the original four card positions during the exchange animation. */
function MulliganSwapCards({ reveal }: { reveal: MulliganReveal }) {
  const replaced = new Set(reveal.replacedIndices)
  const replacementCards = reveal.hand.slice(reveal.originalHand.length - replaced.size)
  let replacementIndex = 0
  const slots = reveal.originalHand.map((oldId, index) => ({
    index, oldId,
    swapped: replaced.has(index),
    newId: replaced.has(index) ? replacementCards[replacementIndex++] : oldId,
  }))
  return <div className="mulligan-cards mulligan-result-cards">
    {slots.map(({ index, oldId, newId, swapped }) => {
      const oldCard = getCard(oldId)
      const newCard = getCard(newId)
      if (!oldCard || !newCard) return null
      const renderCard = (card: NonNullable<typeof oldCard>, role: 'out' | 'in' | 'keep') =>
        <div className={['mulligan-card', 'mulligan-result-card',
          `card-element--${card.element}`, `card-rarity--${card.rarity}`,
          `mulligan-swap--${role}`].join(' ')}>
          <span>コスト {card.cost}</span>
          <CardArtwork cardId={card.id} name={card.name} className="card-artwork--mulligan" />
          <strong>{card.name}</strong>
          <span>{card.type === 'follower' ? `${card.attack} / ${card.health}` :
            card.type === 'spell' ? 'スペル' : 'アミュレット'}</span>
        </div>
      return <div key={index} className="mulligan-swap-slot">
        {swapped ? <>
          {renderCard(oldCard, 'out')}
          {renderCard(newCard, 'in')}
        </> : renderCard(oldCard, 'keep')}
      </div>
    })}
  </div>
}

function App({ online }: { online?: {
  match: OnlineMatchView
  pending: boolean
  onAction: (action: OnlineAction) => void
  onMulligan: (indices: number[]) => void
  onLeave: () => void
} } = {}) {
  const [showCardLibrary, setShowCardLibrary] = useState(false)
  const battleScreenRef = useRef<HTMLDivElement>(null)
  const [battleFullscreen, setBattleFullscreen] = useState(false)
  useEffect(() => {
    const sync = () => setBattleFullscreen(document.fullscreenElement === battleScreenRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const toggleBattleFullscreen = async () => {
    try {
      if (document.fullscreenElement === battleScreenRef.current) {
        await document.exitFullscreen()
      } else if (battleScreenRef.current) {
        await battleScreenRef.current.requestFullscreen()
      }
    } catch {
      // Unsupported or denied by browser: keep the ordinary responsive layout.
    }
  }
  const [showFriendLobby, setShowFriendLobby] = useState(false)
  const [showDeckManager, setShowDeckManager] = useState(false)
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(loadSavedDecks)
  const [decks, setDecks] = useState<BothDecks>(loadDecks)
  const [editingPlayer, setEditingPlayer] = useState<0 | 1 | null>(null)
  const [matchStarted, setMatchStarted] = useState(false)
  const [playback, setPlayback] = useState<{ frames: PresentationFrame[], index: number, playedCard?: BattleNotice, attackerId?: string } | null>(null)
  const [playedCardNotice, setPlayedCardNotice] = useState<BattleNotice | null>(null)
  const [drawFlights, setDrawFlights] = useState<DrawFlight[]>([])
  const drawFlightSerial = useRef(0)
  const drawFlightTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const previousDrawState = useRef<Array<{id:string; deckSize:number; hand:string[]} > | null>(null)

  const [playbackDelay, setPlaybackDelay] = useState<450 | 900 | 1500>(900)
  const playbackLock = useRef(false)
  const [turnAnnouncement, setTurnAnnouncement] = useState<{ id: string; own: boolean; playerName: string } | null>(null)
  const [mulliganReveal, setMulliganReveal] = useState<MulliganReveal | null>(null)
  const previousOnlinePhase = useRef(online?.match.phase ?? null)
  const onlineMulliganDraft = useRef<{ originalHand: string[]; replacedIndices: number[] } | null>(null)
  const lastAnnouncedTurn = useRef<string | null>(null)
  const lastOnlineRevision = useRef<number | null>(null)
  const onlinePlaybackQueue = useRef<OnlinePresentationEvent[]>([])

  // Each successful play briefly reveals the public card to both seats.
  // The notice is independent of combat playback speed and does not block input.
  useEffect(() => {
    if (playback?.playedCard) setPlayedCardNotice(playback.playedCard)
  }, [playback?.playedCard?.key])
  useEffect(() => {
    if (!playedCardNotice) return
    const timer = window.setTimeout(() => setPlayedCardNotice(null), 2800)
    return () => window.clearTimeout(timer)
  }, [playedCardNotice?.key])

  useEffect(() => {
    if (!playback) return
    const timer = window.setTimeout(() => {
      setPlayback(previous => {
        if (!previous) return null
        if (previous.index + 1 >= previous.frames.length) {
          const nextEvent = online ? onlinePlaybackQueue.current.shift() : undefined
          if (nextEvent && online) {
            return {
              frames: nextEvent.frames.map(frame => ({
                label: frame.label,
                state: projectOnlineSnapshot(frame.state, online.match.seat),
              })),
              index: 0,
              ...((nextEvent.playedCardId || nextEvent.abilityCardId) ? { playedCard: {
                key: `online-${nextEvent.revision}`,
                cardId: nextEvent.playedCardId ?? nextEvent.abilityCardId!,
                actorId: nextEvent.actorId,
                ...(nextEvent.abilityKind ? { abilityKind: nextEvent.abilityKind } : {}),
              } } : {}),
            }
          }
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

  useEffect(() => {
    persistSavedDecks(savedDecks)
  }, [savedDecks])

  const updateDeck = (index: 0 | 1, deck: DeckDefinition) => {
    setDecks(previous => index === 0 ? [deck, previous[1]] : [previous[0], deck])
  }
  const beginMatch = () => {
    if (decks.some(deck => validateDeck(deck).length > 0)) return
    playbackLock.current = false
    setPlayback(null)
    setPlayedCardNotice(null)
    setMulliganReveal(null)
    setGame(createInitialGameState(decks))
    setLocalBattleLog([])
    setBattleLogOpen(false)
    setBattleLogTab('log')
    setMatchStarted(true)
    setMulliganSelection([])
    resetSelection()
  }
  const [localGame, setGame] = useState(createInitialGameState)
  // Online and local games share exactly the same battle scene.
  const game: GameState = online ? {
    turn: online.match.turn,
    phase: online.match.phase,
    currentPlayerId: online.match.currentPlayerId,
    winnerId: online.match.winnerId,
    players: [
      projectOnlinePlayer(online.match.players[0], online.match.seat === 0),
      projectOnlinePlayer(online.match.players[1], online.match.seat === 1),
    ],
  } : localGame
  // Reveal only the local seat's completed online mulligan when both players are ready.
  // Online state is already authoritative; no extra draw or gameplay action is performed.
  useEffect(() => {
    if (!online) return
    const previousPhase = previousOnlinePhase.current
    previousOnlinePhase.current = online.match.phase
    if (previousPhase !== 'mulligan' || online.match.phase !== 'main') return
    const self = online.match.players[online.match.seat]
    const finalHand = [...(self.hand ?? [])]
    const draft = onlineMulliganDraft.current
    setMulliganReveal({
      playerName: self.name,
      originalHand: draft?.originalHand ?? finalHand,
      hand: finalHand,
      replacedIndices: draft?.replacedIndices ?? [],
    })
    onlineMulliganDraft.current = null
  }, [online?.match.phase, online?.match.seat])

  useEffect(() => {
    if (!mulliganReveal) return
    const timer = window.setTimeout(() => setMulliganReveal(null), 3200)
    return () => window.clearTimeout(timer)
  }, [mulliganReveal])

  // Detect transitions from actual game state, not from polling frequency.
  // A new turn also includes the first turn immediately after both mulligans.
  useEffect(() => {
    if (game.phase !== 'main' || game.winnerId !== null || mulliganReveal) return
    const turnKey = `${game.turn}:${game.currentPlayerId}`
    if (lastAnnouncedTurn.current === turnKey) return
    lastAnnouncedTurn.current = turnKey
    const seatId = online ? online.match.players[online.match.seat].id : 'player1'
    const playerName = game.players.find(p => p.id === game.currentPlayerId)?.name ?? ''
    setTurnAnnouncement({ id: turnKey, own: game.currentPlayerId === seatId, playerName })
  }, [game.phase, game.turn, game.currentPlayerId, game.winnerId, online?.match.seat, mulliganReveal])
  // Separate dismissal effect also works under React StrictMode's effect replay.
  useEffect(() => {
    if (!turnAnnouncement) return
    const timer = window.setTimeout(() => setTurnAnnouncement(null), 1800)
    return () => window.clearTimeout(timer)
  }, [turnAnnouncement])
  const onlineCanAct = !online || (online.match.phase === 'main' &&
    online.match.currentPlayerId === online.match.players[online.match.seat].id &&
    !online.pending && !online.match.winnerId && !playbackLock.current && !playback)
  const onlineSend = (action: OnlineAction) => {
    if (online && onlineCanAct) online.onAction(action)
  }
  const shownGame = playback ? playback.frames[playback.index].state : game
  // Draws are detected from actual deck/hand state transitions, so both normal
  // turn draws and card-effect draws are represented without touching the rules.
  useEffect(() => {
    const next = shownGame.players.map(player=>({
      id:player.id, deckSize:player.deck.length, hand:[...player.hand],
    }))
    const previous = previousDrawState.current
    previousDrawState.current=next
    if (!previous || shownGame.phase==='mulligan') return
    const selfId=online ? shownGame.players[online.match.seat].id : shownGame.players[0].id
    for(const player of next) {
      const before=previous.find(item=>item.id===player.id)
      if(!before) continue
      const drawn=Math.min(before.deckSize-player.deckSize,player.hand.length-before.hand.length)
      if(drawn<=0)continue
      const isSelf=player.id===selfId
      const source=battleScreenRef.current?.querySelector<HTMLElement>(
        isSelf?'[data-draw-source="self"]':'[data-draw-source="opponent"]')
      const target=battleScreenRef.current?.querySelector<HTMLElement>(
        isSelf?'.hand-cards':'.battle-opponent-hand')
      if(!source||!target)continue
      const from=source.getBoundingClientRect()
      const to=target.getBoundingClientRect()
      const startX=from.left+from.width/2
      const startY=from.top+from.height/2
      const endX=to.left+to.width*(isSelf ? 0.7 : 0.72)
      const endY=to.top+to.height*.42
      const cards=player.hand.slice(-drawn)
      const flights=Array.from({length:Math.min(drawn,9)},(_,index)=>({
        id:++drawFlightSerial.current,
        cardId:isSelf&&getCard(cards[index])?cards[index]:undefined,
        isSelf,x:startX,y:startY,
        dx:endX-startX+(index-(drawn-1)/2)*16,
        dy:endY-startY,
        delay:index*125,
      }))
      setDrawFlights(current=>[...current,...flights].slice(-18))
      const timer=setTimeout(()=>{
        const ids=new Set(flights.map(flight=>flight.id))
        setDrawFlights(current=>current.filter(flight=>!ids.has(flight.id)))
        drawFlightTimers.current=drawFlightTimers.current.filter(item=>item!==timer)
      },1000+Math.max(0,flights.length-1)*125)
      drawFlightTimers.current.push(timer)
    }
  },[shownGame,online?.match.seat])
  useEffect(()=>()=>{drawFlightTimers.current.forEach(clearTimeout)},[])

  // The opponent can complete several actions between polls. Queue every
  // retained server event by revision and replay it with the local animation UI.
  useEffect(() => {
    if (!online) return
    const revision = online.match.revision
    const previouslySeen = lastOnlineRevision.current
    if (previouslySeen === null || revision < previouslySeen) {
      lastOnlineRevision.current = revision
      return
    }
    if (revision === previouslySeen) return
    lastOnlineRevision.current = revision
    const newEvents = (online.match.history ?? [])
      .filter(event => event.revision > previouslySeen && event.revision <= revision)
      .sort((a,b) => a.revision - b.revision)
    if (newEvents.length === 0) return
    const [first, ...remaining] = newEvents
    onlinePlaybackQueue.current.push(...remaining)
    if (playbackLock.current) {
      onlinePlaybackQueue.current.unshift(first)
      return
    }
    playbackLock.current = true
    setPlayback({
      frames: first.frames.map(frame => ({
        label: frame.label,
        state: projectOnlineSnapshot(frame.state, online.match.seat),
      })),
      index: 0,
      ...((first.playedCardId || first.abilityCardId) ? { playedCard: {
        key: `online-${first.revision}`,
        cardId: first.playedCardId ?? first.abilityCardId!,
        actorId: first.actorId,
        ...(first.abilityKind ? { abilityKind: first.abilityKind } : {}),
      } } : {}),
    })
  }, [online?.match.revision, online?.match.history, online?.match.seat])
  // All cues are derived from recorded snapshots; animations never affect rules.
  const highlightedFollowers = new Set<string>()
  const highlightedLeaders = new Set<string>()
  const damagedFollowers = new Map<string, { amount: number; kind: 'damage' | 'heal' | 'shield' }>()
  const damagedLeaders = new Map<string, { amount: number; kind: 'damage' | 'heal' | 'shield' }>()
  let attackingFollowerId: string | null = null
  if (playback && playback.index === 0 && /攻撃/.test(playback.frames[0].label)) {
    const start = playback.frames[0].state
    const end = playback.frames[playback.frames.length - 1].state
    const actor = start.players.find(p => p.id === start.currentPlayerId)
    const actorEnd = end.players.find(p => p.id === start.currentPlayerId)
    if (actor && actorEnd) {
      // Use the attack counter first. The title fallback also handles an attacker
      // destroyed by simultaneous counter-damage during the resolution.
      const source = actor.field.find(f => {
        const after = actorEnd.field.find(g => g.instanceId === f.instanceId)
        return after && (after.attacksThisTurn ?? (after.hasAttacked ? 1 : 0)) >
          (f.attacksThisTurn ?? (f.hasAttacked ? 1 : 0))
      }) ?? actor.field.find(f => playback.frames[0].label.includes(
        `${getCard(f.cardId)?.name ?? f.cardId}が`))
      attackingFollowerId = playback.attackerId ?? source?.instanceId ?? null
    }
  }
  // Keep a visual copy of a follower only during the frame in which it dies.
  // The underlying game state and all targets already reflect the destruction.
  const deathPreviousFields = new Map<string, Follower[]>()
  const hitElements = new Map<string, HitElement>()
  if (playback && playback.index > 0) {
    const before = playback.frames[playback.index - 1].state
    const after = playback.frames[playback.index].state
    for (let i = 0; i < 2; i++) {
      const oldPlayer = before.players[i]
      const newPlayer = after.players[i]
      const oldFollowers = new Map(oldPlayer.field.map(f => [f.instanceId, f]))
      if (oldPlayer.field.some(f => !newPlayer.field.some(next => next.instanceId === f.instanceId))) {
        deathPreviousFields.set(newPlayer.id, oldPlayer.field)
      }
      for (const follower of newPlayer.field) {
        const old = oldFollowers.get(follower.instanceId)
        if (old) {
          const shieldBefore = old.shield.normal + old.shield.crystallize
          const shieldAfter = follower.shield.normal + follower.shield.crystallize
          if (follower.health < old.health) {
            const element = hitElementForPlayback(playback.frames, playback.index, newPlayer.id, playback.attackerId, playback.playedCard?.cardId)
            if (element) hitElements.set(follower.instanceId, element)
            damagedFollowers.set(follower.instanceId, { amount: old.health - follower.health, kind: 'damage' })
          } else if (follower.health > old.health) {
            damagedFollowers.set(follower.instanceId, { amount: follower.health - old.health, kind: 'heal' })
          } else if (shieldAfter < shieldBefore) {
            const element = hitElementForPlayback(playback.frames, playback.index, newPlayer.id, playback.attackerId, playback.playedCard?.cardId)
            if (element) hitElements.set(follower.instanceId, element)
            damagedFollowers.set(follower.instanceId, { amount: shieldBefore - shieldAfter, kind: 'shield' })
          }
        }
        if (!old || old.health !== follower.health || old.attack !== follower.attack ||
            old.shield.normal !== follower.shield.normal ||
            old.shield.crystallize !== follower.shield.crystallize ||
            old.aura.map(a => a.element).join() !== follower.aura.map(a => a.element).join()) {
          highlightedFollowers.add(follower.instanceId)
        }
      }
      const shieldBefore = (oldPlayer.leaderShield?.normal ?? 0) + (oldPlayer.leaderShield?.crystallize ?? 0)
      const shieldAfter = (newPlayer.leaderShield?.normal ?? 0) + (newPlayer.leaderShield?.crystallize ?? 0)
      if (newPlayer.leaderHealth < oldPlayer.leaderHealth || shieldAfter < shieldBefore) {
        const element = hitElementForPlayback(playback.frames, playback.index, newPlayer.id, playback.attackerId, playback.playedCard?.cardId)
        if (element) hitElements.set(newPlayer.id, element)
      }
      if (newPlayer.leaderHealth !== oldPlayer.leaderHealth) {
        damagedLeaders.set(newPlayer.id, {
          amount: Math.abs(newPlayer.leaderHealth - oldPlayer.leaderHealth),
          kind: newPlayer.leaderHealth < oldPlayer.leaderHealth ? 'damage' : 'heal',
        })
      } else if (shieldAfter < shieldBefore) {
        damagedLeaders.set(newPlayer.id, { amount: shieldBefore - shieldAfter, kind: 'shield' })
      }
      if (oldPlayer.leaderHealth !== newPlayer.leaderHealth ||
          (oldPlayer.leaderAura ?? []).map(a=>a.element).join() !==
          (newPlayer.leaderAura ?? []).map(a=>a.element).join()) {
        highlightedLeaders.add(newPlayer.id)
      }
    }
  }

  const animateAction = (action: (state: GameState) => GameState, label: string, playedCardId?: string, abilityKind?: AbilityKind, attackerId?: string) => {
    if (online || playbackLock.current) return
    const traced = beginPresentation(game)
    const next = action(traced)
    if (next === traced) return
    const last = captureFrame(next, label)
    const frames = compactPresentationFrames(game, last.presentationFrames ?? [])
    setGame(withoutPresentation(last))
    setLocalBattleLog(previous => [...previous, {
      id:`local-${Date.now()}-${Math.random()}`,
      turn:game.turn, actorId:game.currentPlayerId,
      title:label,
      ...(playedCardId && /プレイ/.test(label) ? {playedCardId} : {}),
      before:withoutPresentation(game),after:withoutPresentation(last),
      frames,
    }].slice(-150))
    if (frames.length > 0) {
      playbackLock.current = true
      setPlayback({
        frames: [
          { label: label + '：効果を解決中', state: withoutPresentation(game) },
          ...frames,
        ],
        index: 0,
        ...(attackerId ? { attackerId } : {}),
        ...(playedCardId ? { playedCard: {
          key: `local-${Date.now()}-${Math.random()}`, cardId: playedCardId,
          actorId: game.currentPlayerId,
          ...(abilityKind ? { abilityKind } : {}),
        } } : {}),
      })
    }
  }

  const skipPlayback = () => {
    playbackLock.current = false
    onlinePlaybackQueue.current = []
    setPlayback(null)
  }
  const [inspectedCard, setInspectedCard] = useState<
    { kind: 'follower' | 'amulet'; instanceId: string } | { kind: 'hand'; cardId: string } | null
  >(null)
  const [selectedAttackerId, setSelectedAttackerId] =
    useState<string | null>(null)
  const [abilityFocusId, setAbilityFocusId] = useState<string | null>(null)
  const [expandedHandIndex, setExpandedHandIndex] = useState<number | null>(null)
  const [handOpen, setHandOpen] = useState(false)
  const [battleLogOpen, setBattleLogOpen] = useState(false)
  const [localBattleLog, setLocalBattleLog] = useState<BattleHistoryEvent[]>([])
  const [battleLogTab, setBattleLogTab] = useState<'log' | 'play' | 'destroy' | 'details'>('log')
  const [battleLogSide, setBattleLogSide] = useState<'self' | 'opponent'>('self')
  const dragPointer = useRef<{
    pointerId: number; attackerId: string; startX: number; startY: number; moved: boolean
  } | null>(null)
  const suppressDraggedClick = useRef(false)
  const [attackDrag, setAttackDrag] = useState<{
    attackerId: string; x: number; y: number; target: string | null
  } | null>(null)
  const [selectedHandIndex, setSelectedHandIndex] =
    useState<number | null>(null)
  const handDragPointer = useRef<{
    pointerId: number; handIndex: number; startX: number; startY: number; moved: boolean
  } | null>(null)
  const suppressHandDragClick = useRef(false)
  const [handDrag, setHandDrag] = useState<{
    handIndex: number; x: number; y: number; overField: boolean
  } | null>(null)
  const [selectedAbility, setSelectedAbility] = useState<{
    followerId: string
    kind: AbilityKind
    firstTargetId?: string
  } | null>(null)
  const [mulliganSelection, setMulliganSelection] =
    useState<number[]>([])
  const [onlineMulliganSelection, setOnlineMulliganSelection] = useState<number[]>([])

  const currentPlayer = online
    ? shownGame.players[online.match.seat]
    : shownGame.players.find(p => p.id === shownGame.currentPlayerId)!
  const opponent = online
    ? shownGame.players[1-online.match.seat]
    : shownGame.players.find(p => p.id !== shownGame.currentPlayerId)!
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
  const abilityFocus = currentPlayer.field.find(f => f.instanceId === abilityFocusId)
  const abilityFocusCard = abilityFocus ? getCard(abilityFocus.cardId) : undefined

  const resetSelection = () => {
    setSelectedAttackerId(null)
    setSelectedHandIndex(null)
    setSelectedAbility(null)
    setExpandedHandIndex(null)
    setHandOpen(false)
  }

  const handleReset = () => {
    skipPlayback()
    setGame(createInitialGameState(decks))
    setLocalBattleLog([])
    setBattleLogOpen(false)
    setMulliganReveal(null)
    setPlayedCardNotice(null)
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
    if (localGame.phase !== 'mulligan') return
    const player = localGame.players.find(p => p.id === localGame.currentPlayerId)
    if (!player) return
    const result = confirmMulligan(localGame, [...mulliganSelection])
    const confirmedPlayer = result.players.find(p => p.id === player.id)
    if (!confirmedPlayer) return
    setGame(result)
    setMulliganReveal({
      playerName: player.name,
      originalHand: [...player.hand],
      hand: [...confirmedPlayer.hand],
      replacedIndices: [...mulliganSelection],
    })
    setMulliganSelection([])
  }

  const handleEndTurn = () => {
    if (online) onlineSend({type:'endTurn'})
    else animateAction(previous => endTurn(previous), 'ターン終了')
    resetSelection()
  }

  // A hand drop uses exactly the same play/target selection workflow as a click.
  // In particular, fanfare targets are chosen by a subsequent click, not by
  // dropping the card onto a follower or leader.
  const handlePlayCard = (handIndex: number, fromDrag = false) => {
    setExpandedHandIndex(null)
    setHandOpen(false)
    if (!onlineCanAct) return
    const card = getCard(currentPlayer.hand[handIndex])
    if (!card) return

    const noBuffAlly = (['C044', 'C021'].includes(card.id) &&
      !currentPlayer.field.some(f => f.health > 0)) ||
      (['C066', 'C081'].includes(card.id) &&
      !currentPlayer.field.some(f => f.health > 0 &&
        getCard(f.cardId)?.element === (card.id === 'C066' ? 'electro' : 'anemo')))
    if (selectedAbility?.kind === 'skill' && currentPlayer.field.some(f =>
      f.instanceId === selectedAbility.followerId && f.cardId === 'C083')) {
      if (['pyro', 'hydro', 'cryo', 'electro'].includes(card.element)) {
        if (online) onlineSend({type:'ability',followerId:selectedAbility.followerId,kind:'skill',targetId:`hand:${handIndex}`})
        else animateAction(previous => activateAbility(previous, selectedAbility.followerId, 'skill', `hand:${handIndex}`), 'ファルカ：元素付与', 'C083', 'skill')
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
        fromDrag ? handIndex : previous === handIndex ? null : handIndex
      )
      setSelectedAttackerId(null)
      return
    }

    if (online) onlineSend({type:'play',handIndex})
    else animateAction(previous =>
      playCard(
        previous,
        previous.currentPlayerId,
        handIndex
      ), `${card.name} をプレイ`, card.id)
    resetSelection()
  }

  const handOverOwnField = (x: number, y: number): boolean =>
    Boolean(document.elementFromPoint(x, y)?.closest('[data-hand-play-zone="self"]'))

  const startHandDrag = (event: ReactPointerEvent<HTMLButtonElement>, handIndex: number) => {
    // Farka's hand-card selection is an ability cost, not a normal card play.
    if (!onlineCanAct || !canPlayCard(game, handIndex) ||
        (selectedAbility?.kind === 'skill' &&
          currentPlayer.field.some(f => f.instanceId === selectedAbility.followerId && f.cardId === 'C083')) ||
        (event.pointerType === 'mouse' && event.button !== 0)) return
    handDragPointer.current = {
      pointerId: event.pointerId, handIndex,
      startX: event.clientX, startY: event.clientY, moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveHandDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointer = handDragPointer.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    if (!pointer.moved &&
        Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 10) return
    pointer.moved = true
    setHandDrag({
      handIndex: pointer.handIndex, x: event.clientX, y: event.clientY,
      overField: handOverOwnField(event.clientX, event.clientY),
    })
  }

  const finishHandDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const pointer = handDragPointer.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    handDragPointer.current = null
    setHandDrag(null)
    if (!pointer.moved) return
    suppressHandDragClick.current = true
    window.setTimeout(() => { suppressHandDragClick.current = false }, 0)
    if (!cancelled && onlineCanAct && canPlayCard(game, pointer.handIndex) &&
        handOverOwnField(event.clientX, event.clientY)) {
      handlePlayCard(pointer.handIndex, true)
    }
  }

  const handleUseAbility = (follower: Follower, kind: AbilityKind) => {
    if (!onlineCanAct || !canUseAbility(game, follower.instanceId, kind)) return
    const card = getCard(follower.cardId)
    if (!card) return
    if ((card.id === 'C083' && kind === 'skill') ||
        needsAbilityTarget(card, kind) || needsFriendlyAbilityTarget(card, kind)) {
      setSelectedAbility({ followerId: follower.instanceId, kind })
      setSelectedAttackerId(null)
      setSelectedHandIndex(null)
      return
    }
    if (online) onlineSend({type:'ability',followerId:follower.instanceId,kind})
    else animateAction(previous => activateAbility(previous, follower.instanceId, kind), `${card.name}：${kind === 'skill' ? '元素スキル' : '元素爆発'}`, card.id, kind)
    resetSelection()
  }

  // Drag and click both use the same validated combat actions.
  const canDragAttackFollower = (attacker: Follower, target: Follower): boolean =>
    target.health > 0 && !target.keywords.includes('intimidate') &&
    !target.keywords.includes('stealth') &&
    (!isGuarded(opponent) || target.keywords.includes('guard') ||
      attacker.keywords.includes('ignore_guard') ||
      attacker.keywords.includes('plunge_attack'))

  const canDragAttackLeader = (attacker: Follower): boolean =>
    !attacker.keywords.includes('rush_only') || attacker.keywords.includes('storm')
      ? !isGuarded(opponent) || attacker.keywords.includes('plunge_attack')
      : false

  const dragTargetAt = (x: number, y: number, attackerId: string): string | null => {
    const attacker = currentPlayer.field.find(f => f.instanceId === attackerId)
    if (!attacker) return null
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-attack-drop]')
    if (!target) return null
    const value = target.dataset.attackDrop
    if (value === 'leader') return canDragAttackLeader(attacker) ? value : null
    const defender = opponent.field.find(f => f.instanceId === value)
    return defender && canDragAttackFollower(attacker, defender) ? defender.instanceId : null
  }

  const startAttackDrag = (event: ReactPointerEvent<HTMLButtonElement>, follower: Follower) => {
    if (!onlineCanAct || game.winnerId !== null || !canFollowerAttack(follower) ||
        (event.pointerType === 'mouse' && event.button !== 0)) return
    dragPointer.current = {
      pointerId: event.pointerId, attackerId: follower.instanceId,
      startX: event.clientX, startY: event.clientY, moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveAttackDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointer = dragPointer.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    if (!pointer.moved &&
        Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 10) return
    pointer.moved = true
    setAttackDrag({
      attackerId: pointer.attackerId, x: event.clientX, y: event.clientY,
      target: dragTargetAt(event.clientX, event.clientY, pointer.attackerId),
    })
  }

  const finishAttackDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const pointer = dragPointer.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    dragPointer.current = null
    setAttackDrag(null)
    if (!pointer.moved) return
    // Pointer release may synthesize a click; never also select the attacker.
    suppressDraggedClick.current = true
    window.setTimeout(() => { suppressDraggedClick.current = false }, 0)
    if (cancelled || !onlineCanAct || game.winnerId !== null) return
    const attacker = currentPlayer.field.find(f => f.instanceId === pointer.attackerId)
    if (!attacker || !canFollowerAttack(attacker)) return
    const target = dragTargetAt(event.clientX, event.clientY, pointer.attackerId)
    if (!target) return
    if (target === 'leader') {
      if (online) onlineSend({ type: 'attackLeader', attackerId: pointer.attackerId })
      else animateAction(previous => attackLeader(previous, pointer.attackerId), 'リーダー攻撃', undefined, undefined, pointer.attackerId)
    } else {
      if (online) onlineSend({ type: 'attackFollower', attackerId: pointer.attackerId, targetId: target })
      else animateAction(previous => attackFollower(previous, pointer.attackerId, target), 'フォロワー攻撃', undefined, undefined, pointer.attackerId)
    }
    resetSelection()
  }

  const handleSelectAttacker = (follower: Follower) => {
    if (!onlineCanAct || game.winnerId !== null) return
    if (!canFollowerAttack(follower)) return

    setSelectedHandIndex(null)
    setSelectedAttackerId(previous =>
      previous === follower.instanceId
        ? null
        : follower.instanceId
    )
  }

  const handleEnemyFollowerClick = (targetId: string) => {
    if (suppressDraggedClick.current || !onlineCanAct) return
    if (selectedHandIndex !== null) {
      const index = selectedHandIndex

      if (online) onlineSend({type:'play',handIndex:index,targetId})
      else animateAction(previous =>
        playCard(
          previous,
          previous.currentPlayerId,
          index,
          targetId
        ), `${getCard(currentPlayer.hand[index])?.name ?? 'カード'} をプレイ`, currentPlayer.hand[index])
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
        if (online) onlineSend({type:'ability',followerId,kind,targetId:firstTargetId ? `${firstTargetId}|${targetId}` : targetId})
        else animateAction(previous => activateAbility(
          previous, followerId, kind,
          firstTargetId ? `${firstTargetId}|${targetId}` : targetId
        ), '元素スキル：指定した対象に発動', cardId, kind)
      } else {
        if (online) onlineSend({type:'ability',followerId,kind,targetId})
        else animateAction(previous => activateAbility(previous, followerId, kind, targetId), '元素スキル・爆発の対象効果', cardId, kind)
      }
      resetSelection()
      return
    }

    if (!selectedAttackerId) return

    const attackerId = selectedAttackerId
    if (online) onlineSend({type:'attackFollower',attackerId,targetId})
    else animateAction(previous =>
      attackFollower(previous, attackerId, targetId)
    , 'フォロワー攻撃', undefined, undefined, attackerId)
    resetSelection()
  }

  const handleAttackLeader = () => {
    if (suppressDraggedClick.current || !selectedAttackerId || !onlineCanAct) return

    const attackerId = selectedAttackerId

    if (online) onlineSend({type:'attackLeader',attackerId})
    else animateAction(previous =>
      attackLeader(previous, attackerId)
    , 'リーダー攻撃', undefined, undefined, attackerId)
    resetSelection()
  }

  /** One rotating emblem slot for a follower's independent combat abilities. */
  const followerEmblems = (cardId: string, keywords: readonly string[] = []) => {
    const card = getCard(cardId)
    const description = card?.description ?? ''
    const lastWord = !keywords.includes('no_last_word') && (
      keywords.includes('lastword') ||
      keywords.includes('last_word') ||
      keywords.some(keyword => /(?:^on_destroy(?:_|$)|_on_destroy(?:_|$))/.test(keyword)) ||
      card?.effects?.some(effect => effect.trigger === 'on_destroy') ||
      description.includes('【ラストワード】')
    )
    const guard = keywords.includes('guard')
    const bane = keywords.includes('bane') ||
      keywords.includes('lethal') ||
      keywords.includes('必殺') ||
      description.includes('【必殺】')
    // Check live keywords as well as the printed card description: buffs granted
    // by other cards do not rewrite the original card's description.
    const grantedTriggers = keywords.some(keyword =>
      keyword === 'raincutter_on_attack' ||
      keyword === 'attack_heal_2' ||
      /(?:^on_attack(?:_|$)|_on_attack(?:_|$)|^on_turn_(?:start|end)(?:_|$)|_on_turn_(?:start|end)(?:_|$))/.test(keyword)
    )
    const triggered = grantedTriggers ||
      Boolean(card?.effects?.some(effect =>
        effect.trigger === 'turn_start' || effect.trigger === 'turn_end')) ||
      /(?:ターン開始時|ターン終了時|攻撃時|交戦時|自分のターン開始時|自分のターン終了時|相手のターン開始時|相手のターン終了時|攻撃するたび|攻撃したとき|攻撃されるたび|反応を起こすたび|元素反応を起こすたび|シールドを獲得するたび)/.test(description)
    const emblems: Array<{key:string; label:string; content: ReactNode}> = []
    if (lastWord) emblems.push({key:'lastword',label:'ラストワード',content:
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 14a8 8 0 1 1 14 0l-2 2v4H7v-4l-2-2Z" />
        <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/>
        <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/>
        <path d="m12 14-1 2h2l-1-2ZM10 20v-2m4 2v-2"/>
      </svg>})
    if (guard) emblems.push({key:'guard',label:'守護',content:
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2 20 5v6c0 5-3 8-8 11-5-3-8-6-8-11V5l8-3Z"/>
        <path d="M12 6v12M8 11h8"/>
      </svg>})
    if (bane) emblems.push({key:'bane',label:'必殺',content:
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4c4 0 7 2 8 6-3-1-6-.5-8 2-1-3-1-5 0-8Z" fill="currentColor" fillOpacity=".28"/>
        <path d="M15 11 7 21M9 18l-4-2M14 4c4 0 7 2 8 6-3-1-6-.5-8 2"/>
      </svg>})
    if (triggered) emblems.push({key:'triggered',label:'自動発動能力',content:
      <span className="follower-emblem-flag" aria-hidden="true">🏳</span>})
    if (emblems.length === 0) return null
    return <span className="follower-emblems" aria-label={emblems.map(emblem => emblem.label).join('、')}>
      {emblems.map((emblem, index) => <span key={emblem.key}
        className={`follower-emblem follower-emblem--${emblem.key} ${emblems.length > 1 ? 'follower-emblem--rotating follower-emblem--count-' + emblems.length : ''}`}
        style={emblems.length > 1 ? {
          animationDelay: `${index * 2}s`,
          animationDuration: `${emblems.length * 2}s`,
        } : undefined}
        title={emblem.label}>{emblem.content}</span>)}
    </span>
  }

  const renderFollower = (
    follower: Follower,
    isOpponent: boolean
  ) => {
    const card = getCard(follower.cardId)

    const canAttack =
      !isOpponent && onlineCanAct &&
      game.winnerId === null &&
      canFollowerAttack(follower)

    // Visual attack readiness follows the same target restrictions as actual combat.
    // Normal followers can attack leaders too after summoning sickness has ended.
    const canAttackLeaderNow = canAttack &&
      (!follower.keywords.includes('rush_only') || follower.keywords.includes('storm')) &&
      (!isGuarded(opponent) || follower.keywords.includes('plunge_attack'))
    const canAttackFollowerNow = canAttack && opponent.field.some(target =>
      target.health > 0 &&
      !target.keywords.includes('intimidate') &&
      !target.keywords.includes('stealth') &&
      (!isGuarded(opponent) || target.keywords.includes('guard') ||
        follower.keywords.includes('ignore_guard') ||
        follower.keywords.includes('plunge_attack'))
    )
    const attackReadyClass = canAttackLeaderNow ? 'attack-ready--leader'
      : canAttackFollowerNow ? 'attack-ready--follower' : ''

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

    const dragAttacker = attackDrag
      ? currentPlayer.field.find(f => f.instanceId === attackDrag.attackerId)
      : undefined
    const isDragTarget = isOpponent && dragAttacker !== undefined &&
      canDragAttackFollower(dragAttacker, follower)
    const isTarget =
      isOpponent && onlineCanAct &&
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
          damagedFollowers.get(follower.instanceId)?.kind === 'damage' ? 'battle-damaged' : '',
          attackingFollowerId === follower.instanceId ? 'battle-attacker' : '',
          follower.aura.length ? 'follower-has-aura' : ''].join(' ')}
        onMouseEnter={() => {
          setInspectedCard({ kind: 'follower', instanceId: follower.instanceId })
          if (!isOpponent) setAbilityFocusId(follower.instanceId)
        }}
        onMouseLeave={() => setInspectedCard(null)}>
      {hitElements.has(follower.instanceId) && <span className={`elemental-hit elemental-hit--${hitElements.get(follower.instanceId)}`} aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => <i key={i} className="elemental-hit-particle" />)}
        <i className="elemental-hit-ring" />
      </span>}
      {damagedFollowers.has(follower.instanceId) && <span className={`battle-float-number battle-float-number--${damagedFollowers.get(follower.instanceId)!.kind}`} aria-label={`ダメージ・回復表示 ${damagedFollowers.get(follower.instanceId)!.amount}`}>
        {damagedFollowers.get(follower.instanceId)!.kind === 'heal' ? '+' : '−'}{damagedFollowers.get(follower.instanceId)!.amount}
      </span>}
      {follower.aura.length > 0 && <div className="follower-aura-icons"
        aria-label={`元素付着：${follower.aura.map(a=>a.element).join('、')}`}>
        {follower.aura.map((a,i)=><span key={i} className="aura-icon-holder">
          <ElementIcon element={a.element} size="md" />
        </span>)}
      </div>}
      <button
        type="button"
        data-attack-drop={isOpponent ? follower.instanceId : undefined}
        title={card?.name ?? '不明なカード'}
        className={[
          'field-card',
          `card-element--${card?.element ?? 'none'}`,
          `card-rarity--${card?.rarity ?? 'bronze'}`,
          canAttack ? 'can-attack' : '',
          attackReadyClass,
          follower.keywords.includes('stealth') ? 'field-card--stealth' : '',
          isSelected ? 'selected-card' : '',
          isTarget ? 'attack-target' : '',
          isDragTarget ? 'drag-attack-target' : '',
          attackDrag?.target === follower.instanceId ? 'drag-attack-hover' : '',
        ].filter(Boolean).join(' ')}
        disabled={!canAttack && !isTarget && !isFriendlyTarget && !isDragTarget}
        onPointerDown={!isOpponent ? event => startAttackDrag(event, follower) : undefined}
        onPointerMove={!isOpponent ? moveAttackDrag : undefined}
        onPointerUp={!isOpponent ? event => finishAttackDrag(event) : undefined}
        onPointerCancel={!isOpponent ? event => finishAttackDrag(event, true) : undefined}
        draggable={false}
        onFocus={() => setInspectedCard({ kind: 'follower', instanceId: follower.instanceId })}
        onBlur={() => setInspectedCard(null)}
        onClick={() => {
          if (suppressDraggedClick.current) return
          if (isOpponent) {
            handleEnemyFollowerClick(follower.instanceId)
          } else if (isFriendlyTarget && selectedHandIndex !== null) {
            if (online) onlineSend({type:'play',handIndex:selectedHandIndex,targetId:follower.instanceId})
            else animateAction(previous => playCard(
              previous, previous.currentPlayerId,
              selectedHandIndex, follower.instanceId
            ), '味方フォロワーを指定してプレイ', currentPlayer.hand[selectedHandIndex])
            resetSelection()
          } else if (isFriendlyTarget && selectedAbility) {
            const { followerId, kind } = selectedAbility
            if (online) onlineSend({type:'ability',followerId,kind,targetId:follower.instanceId})
            else animateAction(previous => activateAbility(previous, followerId, kind, follower.instanceId), '味方フォロワーへの元素能力', currentPlayer.field.find(f => f.instanceId === followerId)?.cardId, kind)
            resetSelection()
          } else {
            handleSelectAttacker(follower)
          }
        }}
      >
        {card && <CardArtwork cardId={card.id} name={card.name} className="card-artwork--field" />}
        {follower.keywords.includes('stealth') && <span className="stealth-mist" aria-hidden="true">
          <span className="stealth-mist-cloud stealth-mist-cloud--one" />
          <span className="stealth-mist-cloud stealth-mist-cloud--two" />
          <span className="stealth-mist-cloud stealth-mist-cloud--three" />
        </span>}
        <span className="field-keywords" aria-label="カード状態">
          {follower.keywords.includes('storm') && <span title="疾走" className="keyword-pill">疾</span>}
          {follower.keywords.includes('rush_only') && <span title="突進" className="keyword-pill">突</span>}
          {follower.keywords.includes('aura') && <span title="オーラ" className="keyword-pill">護</span>}
          {follower.keywords.includes('frozen') && <span title="凍結" className="keyword-pill keyword-pill--cryo">氷</span>}
          {follower.shield.normal > 0 && <span title={`通常シールド ${follower.shield.normal}`} className="keyword-pill">盾{follower.shield.normal}</span>}
          {follower.shield.crystallize > 0 && <span title={`結晶シールド ${follower.shield.crystallize}`} className="keyword-pill">晶{follower.shield.crystallize}</span>}

        </span>

        <span className="follower-stats"><b className="stat-attack">{follower.attack}</b><b className="stat-health">{follower.health}</b></span>
        {followerEmblems(follower.cardId, follower.keywords)}

      </button>
      </div>
    )
  }

  const renderField = (
    player: typeof currentPlayer,
    isOpponent: boolean
  ) => {
    const followers = player.field
    const beforeDeaths = deathPreviousFields.get(player.id)
    const currentById = new Map(followers.map(f => [f.instanceId, f]))
    const previousIds = new Set(beforeDeaths?.map(f => f.instanceId) ?? [])
    const visibleFollowers = beforeDeaths
      ? [
          ...beforeDeaths.map(before => ({
            follower: currentById.get(before.instanceId) ?? before,
            dying: !currentById.has(before.instanceId),
          })),
          ...followers.filter(f => !previousIds.has(f.instanceId)).map(f => ({ follower: f, dying: false })),
        ]
      : followers.map(f => ({ follower: f, dying: false }))
    const amulets = player.amulets ?? []
    return <div className={['card-slot', !isOpponent && handDrag ? 'hand-play-drop-zone' : '',
        !isOpponent && handDrag?.overField ? 'hand-play-drop-hover' : ''].filter(Boolean).join(' ')}
      data-hand-play-zone={!isOpponent ? 'self' : undefined}
      aria-label={`場：フォロワー${followers.length}体・アミュレット${amulets.length}枚`}>
      {visibleFollowers.length + amulets.length === 0
        ? 'カード配置エリア'
        : <>
          {visibleFollowers.map(({ follower, dying }) => {
            if (!dying) return renderFollower(follower, isOpponent)
            const card = getCard(follower.cardId)
            const element = playback
              ? hitElementForPlayback(playback.frames, playback.index, player.id,
                  playback.attackerId, playback.playedCard?.cardId)
              : null
            return <div key={`${follower.instanceId}-destroy-${playback?.index}`}
              className="follower-wrapper battle-destroying" aria-hidden="true"
              style={{ animationDuration: `${playbackDelay}ms` }}>
              {element && <span className={`elemental-hit elemental-hit--${element}`}>
                {Array.from({ length: 7 }, (_, i) => <i key={i} className="elemental-hit-particle" />)}
                <i className="elemental-hit-ring" />
              </span>}
              <span className="battle-destruction-flash" />
              <div className={['field-card', `card-element--${card?.element ?? 'none'}`,
                `card-rarity--${card?.rarity ?? 'bronze'}`].join(' ')}>
                {card && <CardArtwork cardId={card.id} name={card.name} className="card-artwork--field" />}
                <span className="follower-stats">
                  <b className="stat-attack">{follower.attack}</b>
                  <b className="stat-health">{follower.health}</b>
                </span>
              </div>
            </div>
          })}
          {amulets.map(amulet => {
            const card = getCard(amulet.cardId)
            return <div className="follower-wrapper" key={amulet.instanceId}
              onMouseEnter={() => setInspectedCard({ kind: 'amulet', instanceId: amulet.instanceId })}
              onMouseLeave={() => setInspectedCard(null)}>
              <div className={['field-card','amulet-card',
                `card-element--${card?.element ?? 'none'}`,
                `card-rarity--${card?.rarity ?? 'bronze'}`].join(' ')}>
                <CardArtwork cardId={amulet.cardId} name={card?.name ?? amulet.cardId} className="card-artwork--field" />
                {followerEmblems(amulet.cardId)}
                <span className="amulet-countdown" title={`残り${amulet.turnsRemaining}ターン`}>{amulet.turnsRemaining >= 1 && amulet.turnsRemaining <= 20 ? String.fromCharCode(0x2460 + amulet.turnsRemaining - 1) : String(amulet.turnsRemaining)}</span>
              </div>
            </div>
          })}
        </>}
    </div>
  }

  if (showCardLibrary) {
    return <CardLibrary onBack={() => setShowCardLibrary(false)} />
  }

  if (!online && showDeckManager && !matchStarted) {
    return <DeckManager savedDecks={savedDecks} onChange={setSavedDecks}
      onBack={() => setShowDeckManager(false)} />
  }

  // Keep the online lobby mounted while the deck editor is open.
  // Its room code, Firebase polling and participant role must survive navigation.
  if (!online && showFriendLobby && !matchStarted) {
    return <>
      <div style={{ display: editingPlayer !== null ? 'none' : undefined }}>
        <FriendRoomLobby onBack={() => setShowFriendLobby(false)}
          deck={decks[0]} onEditDeck={() => setEditingPlayer(0)}
          savedDecks={savedDecks} onSelectSavedDeck={deck => updateDeck(0, deck)}
          renderOnlineBattle={(match, pending, onAction, onMulligan, onLeave) => <App online={{match,pending,onAction,onMulligan,onLeave}} />} />
      </div>
      {editingPlayer !== null && <DeckBuilder
        title="フレンド対戦：自分のデッキ"
        deck={decks[editingPlayer]}
        onChange={deck => updateDeck(editingPlayer, deck)}
        onBack={() => setEditingPlayer(null)}
      />}
    </>
  }

  if (!online && editingPlayer !== null) {
    return <DeckBuilder title={editingPlayer === 0 ? '空（自分）' : '蛍（相手）'}
      deck={decks[editingPlayer]} onChange={deck => updateDeck(editingPlayer, deck)}
      onBack={() => setEditingPlayer(null)} />
  }

  if (!online && !matchStarted) {
    const errors = decks.map(validateDeck)
    return <div className="game">
      <header className="game-header">
        <h1>原神カードゲーム</h1><span>対戦準備</span>
        <div className="deck-setup-header-actions">
          <button type="button" onClick={() => setShowDeckManager(true)}>デッキ管理</button>
          <button type="button" onClick={() => setShowCardLibrary(true)}>カード一覧</button>
        </div>
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
              <span>{index === 0 ? '空' : '蛍'}（{index === 0 ? '自分' : '相手'}）</span>
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
            <div className="deck-setup-choices">
              <SavedDeckPicker savedDecks={savedDecks} onSelect={chosen => updateDeck(index as 0 | 1, chosen)} />
              <button type="button" onClick={() => setEditingPlayer(index as 0 | 1)}>
                その場で作成・編集
              </button>
            </div>
          </section>)}
        </div>
        <button type="button" className="end-turn deck-start"
          disabled={errors.some(items => items.length > 0)} onClick={beginMatch}>
          この2つのデッキでローカル対戦開始
        </button>
        <button type="button" className="friend-match-entry" onClick={() => setShowFriendLobby(true)}>
          フレンド対戦（ルーム作成・参加）
        </button>
        <p className="deck-setup-note">対戦用デッキの編集内容と登録済みデッキは、このブラウザ内にそれぞれ保存されます。対戦開始後は再度デッキ選択画面に戻れます。</p>
      </main>
    </div>
  }

  // In local play, show the newly dealt hand before the next player's
  // mulligan (or the first turn). The opponent's hand is never revealed online.
  if (!online && mulliganReveal) {
    return <div className="game">
      <main className="mulligan-result-scene" role="status" aria-live="polite">
        <h2>{mulliganReveal.playerName} のマリガン結果</h2>
        <p>確定した手札</p>
        <MulliganSwapCards reveal={mulliganReveal} />
        <p className="mulligan-result-note">まもなく次の画面へ進みます</p>
      </main>
    </div>
  }

  if (!online && game.phase === 'mulligan') {
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

  const battleHistorySelfId=online?game.players[online.match.seat].id:game.players[0].id
  const battleHistoryEvents: BattleHistoryEvent[]=online
    ? (online.match.history??[]).map(event=>{
      const frames=event.frames.map(frame=>({
        label:frame.label,
        state:projectOnlineSnapshot(frame.state,online.match.seat),
      }))
      const first=frames[0]?.state??game
      const last=frames[frames.length-1]?.state??first
      return {
        id:`online-${event.revision}`,
        turn:first.turn,actorId:event.actorId,title:event.title,
        playedCardId:event.playedCardId,
        before:first,after:last,frames,
      }
    })
    : localBattleLog
  const battlePlayedCards:HistoryCardEntry[]=battleHistoryEvents.flatMap(event=>
    event.playedCardId && getCard(event.playedCardId)
      ? [{id:event.id,cardId:event.playedCardId,ownerId:event.actorId,turn:event.turn}]
      : [])
  const battleDestroyedCards:HistoryCardEntry[]=battleHistoryEvents.flatMap(historyDestroyedCards)

  return (
    <div ref={battleScreenRef}
      className={['game','game--battle','game--battle-fit',handOpen ? 'game--hand-open' : '',playback ? 'game--animating' : ''].filter(Boolean).join(' ')}
      onClick={event => {
        if (!handOpen) return
        const target = event.target
        if (!(target instanceof Element)) return
        // A blank part of the battlefield dismisses the hand. Cards, buttons
        // and leader interaction must retain their existing click behaviour.
        if (target.closest('.field') && !target.closest('.follower-wrapper, button, [data-attack-drop]')) {
          setHandOpen(false)
          setExpandedHandIndex(null)
          setInspectedCard(null)
        }
      }}>
      {turnAnnouncement && <div key={turnAnnouncement.id} className={`turn-announcement turn-announcement--${turnAnnouncement.own ? 'own' : 'opponent'}`}
        role="status" aria-live="polite" aria-atomic="true">
        <div className="turn-announcement-panel">
          <span className="turn-announcement-label">TURN START · {turnAnnouncement.playerName}</span>
          <strong>{turnAnnouncement.own ? 'あなたのターンです' : '相手のターンです'}</strong>
          <span className="turn-announcement-ornament">✦ ───────── ✦</span>
        </div>
      </div>}
      {handDrag && getCard(currentPlayer.hand[handDrag.handIndex] ?? '') &&
        <div className="hand-drag-ghost" aria-hidden="true"
          style={{ left: handDrag.x, top: handDrag.y }}>
          <CardArtwork cardId={currentPlayer.hand[handDrag.handIndex]}
            name={getCard(currentPlayer.hand[handDrag.handIndex])?.name ?? ''} />
          <span>{handDrag.overField ? '離してプレイ' : '自分の場へドラッグ'}</span>
        </div>}
      {attackDrag && getCard(currentPlayer.field.find(f => f.instanceId === attackDrag.attackerId)?.cardId ?? '') &&
        <div className="attack-drag-ghost" aria-hidden="true"
          style={{ left: attackDrag.x, top: attackDrag.y }}>
          <CardArtwork
            cardId={currentPlayer.field.find(f => f.instanceId === attackDrag.attackerId)!.cardId}
            name={getCard(currentPlayer.field.find(f => f.instanceId === attackDrag.attackerId)!.cardId)?.name ?? ''} />
          <span>攻撃対象へドラッグ</span>
        </div>}
      {playedCardNotice &&
        // The online opponent's played card is public; local play shows either side.
        (!online || playedCardNotice.actorId !== online.match.players[online.match.seat].id) &&
        getCard(playedCardNotice.cardId) && <aside key={playedCardNotice.key}
          className={['opponent-card-reveal', playedCardNotice.abilityKind
            ? `opponent-ability-reveal opponent-ability-reveal--${playedCardNotice.abilityKind}` : ''].join(' ')}
          role="status"
          aria-label={playedCardNotice.abilityKind ? '元素能力の発動' : 'プレイしたカード'}>
          <span className="opponent-card-reveal-caption">
            {playedCardNotice.abilityKind === 'skill' ? 'ELEMENTAL SKILL'
              : playedCardNotice.abilityKind === 'burst' ? 'ELEMENTAL BURST' : 'PLAYED CARD'}
          </span>
          <div className={`opponent-card-reveal-art card-element--${getCard(playedCardNotice.cardId)?.element ?? 'none'}`}>
            <CardArtwork cardId={playedCardNotice.cardId}
              name={getCard(playedCardNotice.cardId)?.name ?? playedCardNotice.cardId} />
          </div>
          <strong>{getCard(playedCardNotice.cardId)?.name}</strong>
          {playedCardNotice.abilityKind ? <span className="opponent-card-reveal-detail opponent-ability-name">
            {playedCardNotice.abilityKind === 'skill' ? '元素スキル' : '元素爆発'}：
            {playedCardNotice.abilityKind === 'skill'
              ? getCard(playedCardNotice.cardId)?.elementalSkill?.name ?? '元素スキル'
              : getCard(playedCardNotice.cardId)?.elementalBurst?.name ?? '元素爆発'}
          </span> : <span className="opponent-card-reveal-detail">
            {getCard(playedCardNotice.cardId)?.cost} PP · {
              getCard(playedCardNotice.cardId)?.type === 'follower' ? 'フォロワー'
                : getCard(playedCardNotice.cardId)?.type === 'spell' ? 'スペル' : 'アミュレット'}
          </span>}
        </aside>}
      {online && mulliganReveal && <div className="online-mulligan-overlay mulligan-result-overlay"
        role="status" aria-live="polite">
        <div className="online-mulligan-dialog mulligan-result-dialog">
          <h2>マリガン結果</h2>
          <p>あなたの確定した手札</p>
          <MulliganSwapCards reveal={mulliganReveal} />
          <p className="mulligan-result-note">まもなく対戦が始まります</p>
        </div>
      </div>}
      {online?.match.phase === 'mulligan' && <div className="online-mulligan-overlay" role="dialog" aria-modal="true" aria-label="マリガン">
        <div className="online-mulligan-dialog">
          <h2>{currentPlayer.name} のマリガン</h2>
          <p>両プレイヤーが対戦画面で同時にマリガンします。</p>
          <p>空：{online.match.mulliganReady?.[0] ? '確定済み' : '選択中'}　蛍：{online.match.mulliganReady?.[1] ? '確定済み' : '選択中'}</p>
          {!online.match.mulliganReady?.[online.match.seat] ? <>
            <p>交換したいカードを選択してください。（{onlineMulliganSelection.length} / 4枚）</p>
            <div className="mulligan-cards">
              {currentPlayer.hand.map((cardId, index) => {
                const card = getCard(cardId)
                if (!card) return null
                const selected = onlineMulliganSelection.includes(index)
                return <button type="button" key={index} disabled={online.pending}
                  aria-pressed={selected}
                  className={['mulligan-card', `card-element--${card.element}`,
                    `card-rarity--${card.rarity}`, selected ? 'selected' : ''].join(' ')}
                  onClick={() => setOnlineMulliganSelection(previous => previous.includes(index)
                    ? previous.filter(i => i !== index) : [...previous, index])}>
                  <span>コスト {card.cost}</span>
                  <CardArtwork cardId={card.id} name={card.name} className="card-artwork--mulligan" />
                  <strong>{card.name}</strong>
                  <span>{card.type === 'follower' ? `${card.attack} / ${card.health}` : card.type === 'spell' ? 'スペル' : 'アミュレット'}</span>
                  <span>{selected ? '交換する ✓' : 'キープ'}</span>
                </button>
              })}
            </div>
            <button type="button" className="end-turn mulligan-confirm" disabled={online.pending}
              onClick={() => {
                onlineMulliganDraft.current = {
                  originalHand: [...currentPlayer.hand],
                  replacedIndices: [...onlineMulliganSelection],
                }
                online.onMulligan([...onlineMulliganSelection])
              }}>
              {onlineMulliganSelection.length ? `${onlineMulliganSelection.length}枚交換して確定` : 'すべてキープして確定'}
            </button>
          </> : <div className="online-mulligan-waiting" role="status">
            マリガン確定済み。相手のマリガン完了を待っています。
          </div>}
        </div>
      </div>}
      {drawFlights.length>0&&<div className="battle-draw-layer" aria-hidden="true">
        {drawFlights.map(flight=><div key={flight.id} className="battle-draw-flight"
          style={{
            left:flight.x,top:flight.y,
            '--draw-dx':`${flight.dx}px`,
            '--draw-dy':`${flight.dy}px`,
            animationDelay:`${flight.delay}ms`,
          } as CSSProperties}>
          <div className="battle-draw-card">
            <div className="battle-draw-card-back"><span>✦</span></div>
            {flight.cardId&&<div className="battle-draw-card-front">
              <CardArtwork cardId={flight.cardId} name={getCard(flight.cardId)?.name??''} />
            </div>}
          </div>
        </div>)}
      </div>}
      <div className="battle-opponent-hand" aria-label={`相手の手札 ${opponent.hand.length}枚`}>
        {opponent.hand.map((_, index) => <span key={index}
          className={['battle-opponent-card-back',
            index >= opponent.hand.length-drawFlights.filter(flight=>!flight.isSelf).length ? 'draw-pending' : '',
          ].filter(Boolean).join(' ')} aria-hidden="true">✦</span>)}
      </div>
      <header className="game-header game-header--battle">
        <div className="game-brand"><span className="brand-crest">✦</span><span><strong>原神カードゲーム</strong><small>ELEMENTAL DUEL</small></span></div>
        <span className="turn-counter"><small>ROUND</small><strong>{shownGame.turn}</strong></span>
        {online && <small className="online-build-marker" title="オンライン対戦画面のビルド識別子">ONLINE UI 20261116-B</small>}
        <div className="battle-header-actions">
          <button type="button" className="battle-fullscreen-toggle"
            onClick={toggleBattleFullscreen}
            aria-pressed={battleFullscreen}
            title={battleFullscreen ? 'フルスクリーンを解除（Escでも解除可）' : 'フルスクリーンで対戦する'}>
            {battleFullscreen ? '⤢ 通常表示' : '⛶ フルスクリーン'}
          </button>
          <button type="button" onClick={() => setShowCardLibrary(true)}>
            カード一覧
          </button>
          <button type="button" onClick={() => {
            if (online) online.onLeave()
            else { setMatchStarted(false); resetSelection() }
          }}>
            {online ? 'ロビーへ戻る' : 'デッキ選択へ戻る'}
          </button>
          {!online && <button type="button" onClick={handleReset}>
            ゲームリセット
          </button>}
        </div>
      </header>

      <div className="battle-log-dock">
        <button type="button" className="battle-log-toggle"
          aria-label="対戦ログを表示" aria-expanded={battleLogOpen}
          aria-controls="battle-log-panel"
          onClick={() => setBattleLogOpen(previous => !previous)}>
          <span aria-hidden="true">☷</span><small>LOG</small>
        </button>
      </div>
      {battleLogOpen && <div className="battle-log-backdrop"
        onMouseDown={event=>{if(event.target===event.currentTarget)setBattleLogOpen(false)}}>
        <section id="battle-log-panel" className="battle-log-dialog" role="dialog"
          aria-modal="true" aria-label="バトルログ">
          <div className="battle-log-dialog-head">
            <h2>バトルログ</h2>
            <button type="button" className="battle-log-close"
              aria-label="ログを閉じる" onClick={()=>setBattleLogOpen(false)}>×</button>
          </div>
          <nav className="battle-log-tabs" aria-label="ログの種類">
            {([['log','ログ'],['play','プレイ'],['destroy','破壊'],['details','詳細情報']] as const).map(([key,label])=>
              <button key={key} type="button" aria-pressed={battleLogTab===key}
                className={battleLogTab===key?'active':''}
                onClick={()=>setBattleLogTab(key)}>{label}</button>)}
          </nav>
          {(battleLogTab==='play'||battleLogTab==='destroy')&&
            <nav className="battle-log-side-tabs" aria-label="プレイヤーの切り替え">
              <button type="button" aria-pressed={battleLogSide==='self'}
                className={battleLogSide==='self'?'active':''}
                onClick={()=>setBattleLogSide('self')}>
                自分の{battleLogTab==='play'?'プレイした':'破壊された'}カード
              </button>
              <button type="button" aria-pressed={battleLogSide==='opponent'}
                className={battleLogSide==='opponent'?'active':''}
                onClick={()=>setBattleLogSide('opponent')}>
                相手の{battleLogTab==='play'?'プレイした':'破壊された'}カード
              </button>
            </nav>}
          <div className="battle-log-dialog-scroll">
            {battleLogTab==='log' && <div className="battle-log-timeline">
              {battleHistoryEvents.length===0&&<p className="battle-log-empty">まだ行動履歴はありません。</p>}
              {[...battleHistoryEvents].reverse().map(event=><div key={event.id}
                className={`battle-log-event ${event.actorId===battleHistorySelfId?'battle-log-event--self':'battle-log-event--enemy'}`}>
                <div className="battle-log-event-meta">
                  <span>ROUND {event.turn}</span>
                  <span>{event.actorId===battleHistorySelfId?'自分':'相手'}</span>
                </div>
                <div className="battle-log-event-text">
                  <span>{event.title}</span>
                  {event.playedCardId&&getCard(event.playedCardId)&&
                    <CardArtwork cardId={event.playedCardId} name={getCard(event.playedCardId)!.name}/>}
                </div>
                {event.frames.length>0&&<div className="battle-log-event-details">
                  {event.frames.map((frame,i)=><div key={i}>{frame.label}</div>)}
                </div>}
              </div>)}
            </div>}
            {(battleLogTab==='play'||battleLogTab==='destroy')&&
              <div className="battle-log-card-groups">
                {(() => {
                  const ownId=battleHistorySelfId
                  const wanted=battleLogSide==='self'?ownId:game.players.find(p=>p.id!==ownId)?.id
                  const list=(battleLogTab==='play'?battlePlayedCards:battleDestroyedCards)
                    .filter(entry=>entry.ownerId===wanted&&getCard(entry.cardId))
                  const costs=[...new Set(list.map(entry=>getCard(entry.cardId)!.cost))].sort((a,b)=>a-b)
                  if(list.length===0)return <p className="battle-log-empty">該当するカードはありません。</p>
                  return costs.map(cost=><section key={cost} className="battle-log-cost-group">
                    <h3>COST {cost}</h3>
                    {[...new Set(list.filter(entry=>getCard(entry.cardId)?.cost===cost).map(entry=>entry.cardId))]
                      .map(cardId=>{
                        const card=getCard(cardId)!
                        const count=list.filter(entry=>entry.cardId===cardId).length
                        return <div className={`battle-log-card-row ${battleLogSide==='self'?'battle-log-card-row--self':'battle-log-card-row--enemy'}`}
                          key={cardId}>
                          <span>{card.name}</span>
                          <CardArtwork cardId={card.id} name={card.name}/>
                          <b>×{count}</b>
                        </div>
                      })}
                  </section>)
                })()}
              </div>}
            {battleLogTab==='details'&&<div className="battle-log-details">
              {game.players.map(player=><section key={player.id}>
                <h3>{player.id===battleHistorySelfId?'自分':'相手'} — {player.name}</h3>
                <div><span>リーダー体力</span><strong>{player.leaderHealth} / {player.leaderMaxHealth}</strong></div>
                <div><span>残りデッキ</span><strong>{player.deck.length}枚</strong></div>
                <div><span>手札</span><strong>{player.hand.length}枚</strong></div>
                <div><span>墓場</span><strong>{player.graveyard.length}枚</strong></div>
                <div><span>場のフォロワー</span><strong>{player.field.length}体</strong></div>
                <div><span>アミュレット</span><strong>{player.amulets?.length??0}枚</strong></div>
                <div><span>PP</span><strong>{player.pp} / {player.maxPp}</strong></div>
                <div><span>元素エネルギー</span><strong>{player.energy} / 5</strong></div>
              </section>)}
            </div>}
          </div>
          {playback&&<div className="battle-log-playback">
            <span>演出 {playback.index+1}/{playback.frames.length}</span>
            <label>再生速度
              <select value={playbackDelay} onChange={e=>setPlaybackDelay(Number(e.target.value) as 450|900|1500)}>
                <option value={1500}>ゆっくり</option>
                <option value={900}>標準</option>
                <option value={450}>速い</option>
              </select>
            </label>
            <button type="button" onClick={skipPlayback}>スキップ</button>
          </div>}
        </section>
      </div>}
      {winner && (
        <div className="winner-banner">
          {winner.name} の勝利！
        </div>
      )}

      <section className="player opponent">
        <div className="player-side-label">
          <span className="side-label-dot" /> OPPONENT <strong>{opponent.name}</strong>

        </div>
        <button
          type="button"
          key={highlightedLeaders.has(opponent.id) ? `opponent-hit-${playback?.index}` : 'opponent-leader'}
          className={[
            'leader',
            'leader-button',
            highlightedLeaders.has(opponent.id) ? 'leader-hit' : '',
            damagedLeaders.get(opponent.id)?.kind === 'damage' ? 'leader-damaged' : '',
            selectedAttacker ? 'attack-target' : '',
            attackDrag && currentPlayer.field.some(f => f.instanceId === attackDrag.attackerId &&
              canDragAttackLeader(f)) ? 'drag-attack-target' : '',
            attackDrag?.target === 'leader' ? 'drag-attack-hover' : '',
          ].filter(Boolean).join(' ')}
          data-attack-drop="leader"
          disabled={
            (!selectedAttacker && !attackDrag) || !onlineCanAct ||
            game.winnerId !== null ||
            (selectedAttacker ? !canDragAttackLeader(selectedAttacker) :
              !currentPlayer.field.some(f => f.instanceId === attackDrag?.attackerId &&
                canFollowerAttack(f) && canDragAttackLeader(f)))
          }
          onClick={handleAttackLeader}
        >
          {(opponent.leaderAura?.length ?? 0) > 0 && <span className="leader-aura-status" aria-label={`リーダー元素付着：${opponent.leaderAura?.map(a => a.element).join('、')}`}>
            {opponent.leaderAura?.map((a, i) =>
              <span key={i} className="aura-icon-holder">
                <ElementIcon element={a.element} size="sm" />
              </span>)}
          </span>}
          {hitElements.has(opponent.id) && <span className={`elemental-hit elemental-hit--${hitElements.get(opponent.id)}`} aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => <i key={i} className="elemental-hit-particle" />)}
            <i className="elemental-hit-ring" />
          </span>}
          {damagedLeaders.has(opponent.id) && <span className={`battle-float-number battle-float-number--${damagedLeaders.get(opponent.id)!.kind}`}>
            {damagedLeaders.get(opponent.id)!.kind === 'heal' ? '+' : '−'}{damagedLeaders.get(opponent.id)!.amount}
          </span>}
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
        <div className="player-counts"><span data-draw-source="opponent">山札 <strong>{opponent.deck.length}</strong></span><span>手札 <strong>{opponent.hand.length}</strong></span><span>墓場 <strong>{opponent.graveyard.length}</strong></span></div>
        <div className="player-effects">
        <CrestIcons crests={opponent.crests} ownerName={opponent.name} placement="below" />
        {(opponent.bondOfLife ?? 0) > 0 && <div>命の契約：{opponent.bondOfLife}</div>}
        {opponent.leaderShield && (
          <div>リーダーシールド：通常 {opponent.leaderShield.normal} ／ 結晶 {opponent.leaderShield.crystallize}</div>
        )}
        {(opponent.leaderBurningTurns ?? 0) > 0 && (
          <div>リーダー燃焼：残り{opponent.leaderBurningTurns}ターン</div>
        )}
        {opponent.leaderFrozenNextTurn && <div>❄ リーダー凍結：次の自分のターンの使用可能PP－1（重複不可）</div>}
        {opponent.leaderSuperconduct && <div>⚡ リーダー超電導：次の物理ダメージ＋1</div>}
        {(opponent.leaderQuickenCharges ?? 0) > 0 && <div>🌿 リーダー原激化：残り{opponent.leaderQuickenCharges}回</div>}
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

        </div>
        <div key={highlightedLeaders.has(currentPlayer.id) ? `self-hit-${playback?.index}` : 'self-leader'}
          className={['leader', highlightedLeaders.has(currentPlayer.id) ? 'leader-hit' : '', damagedLeaders.get(currentPlayer.id)?.kind === 'damage' ? 'leader-damaged' : ''].filter(Boolean).join(' ')}>
          {(currentPlayer.leaderAura?.length ?? 0) > 0 && <span className="leader-aura-status" aria-label={`リーダー元素付着：${currentPlayer.leaderAura?.map(a => a.element).join('、')}`}>
            {currentPlayer.leaderAura?.map((a, i) =>
              <span key={i} className="aura-icon-holder">
                <ElementIcon element={a.element} size="sm" />
              </span>)}
          </span>}
          {hitElements.has(currentPlayer.id) && <span className={`elemental-hit elemental-hit--${hitElements.get(currentPlayer.id)}`} aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => <i key={i} className="elemental-hit-particle" />)}
            <i className="elemental-hit-ring" />
          </span>}
          {damagedLeaders.has(currentPlayer.id) && <span className={`battle-float-number battle-float-number--${damagedLeaders.get(currentPlayer.id)!.kind}`}>
            {damagedLeaders.get(currentPlayer.id)!.kind === 'heal' ? '+' : '−'}{damagedLeaders.get(currentPlayer.id)!.amount}
          </span>}
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
        <div className="player-counts"><span data-draw-source="self">山札 <strong>{currentPlayer.deck.length}</strong></span><span>手札 <strong>{currentPlayer.hand.length}</strong></span><span>墓場 <strong>{currentPlayer.graveyard.length}</strong></span></div>
        <div className="player-effects">
        <CrestIcons crests={currentPlayer.crests} ownerName={currentPlayer.name} placement="above" />
        {(currentPlayer.bondOfLife ?? 0) > 0 && <div>命の契約：{currentPlayer.bondOfLife}</div>}
        {currentPlayer.leaderShield && (
          <div>リーダーシールド：通常 {currentPlayer.leaderShield.normal} ／ 結晶 {currentPlayer.leaderShield.crystallize}</div>
        )}
        {(currentPlayer.leaderBurningTurns ?? 0) > 0 && (
          <div>リーダー燃焼：残り{currentPlayer.leaderBurningTurns}ターン</div>
        )}
        {currentPlayer.leaderFrozenNextTurn && <div>❄ リーダー凍結：次の自分のターンの使用可能PP－1（重複不可）</div>}
        {currentPlayer.leaderSuperconduct && <div>⚡ リーダー超電導：次の物理ダメージ＋1</div>}
        {(currentPlayer.leaderQuickenCharges ?? 0) > 0 && <div>🌿 リーダー原激化：残り{currentPlayer.leaderQuickenCharges}回</div>}
        </div>

        <button
          type="button"
          className="end-turn"
          disabled={!onlineCanAct || shownGame.winnerId !== null || Boolean(playback)}
          onClick={handleEndTurn}
        >
          <span>END TURN</span><strong>ターン終了</strong>
        </button>
      </section>

      <aside className="battle-ability-rail" aria-label="元素能力の操作">
        <div className="battle-ability-rail-title">元素能力</div>
        <div className="battle-ability-rail-source">{abilityFocusCard?.name ?? '自分のフォロワーを選択'}</div>
        <button type="button" className="battle-ability-rail-button"
          disabled={!abilityFocus || !abilityFocusCard?.elementalSkill || !onlineCanAct ||
            !canUseAbility(game, abilityFocus.instanceId, 'skill')}
          title={abilityFocusCard?.elementalSkill?.name ?? '元素スキル'}
          onClick={() => { if (abilityFocus) handleUseAbility(abilityFocus, 'skill') }}>
          <span>元素スキル</span>
          <small>{abilityFocusCard?.elementalSkill
            ? `PP ${abilityFocusCard.elementalSkill.ppCost ?? 0}` : '—'}</small>
        </button>
        <button type="button" className="battle-ability-rail-button battle-ability-rail-button--burst"
          disabled={!abilityFocus || !abilityFocusCard?.elementalBurst || !onlineCanAct ||
            !canUseAbility(game, abilityFocus.instanceId, 'burst')}
          title={abilityFocusCard?.elementalBurst?.name ?? '元素爆発'}
          onClick={() => { if (abilityFocus) handleUseAbility(abilityFocus, 'burst') }}>
          <span>元素爆発</span>
          <small>{abilityFocusCard?.elementalBurst
            ? `EN ${abilityFocusCard.elementalBurst.energyCost ?? 0}` : '—'}</small>
        </button>
      </aside>

      <div className="battle-message" role="status" aria-live="polite"><span className="battle-message-icon">✧</span>
        {winner
          ? 'ゲーム終了'
          : selectedAbility !== null
            ? currentPlayer.field.find(f => f.instanceId === selectedAbility.followerId)?.cardId === 'C083'
              ? 'ファルカ：捨てる炎・水・氷・雷の手札カードを選択してください'
              : currentPlayer.field.find(f => f.instanceId === selectedAbility.followerId)?.cardId === 'C066'
              ? '九条裟羅：強化する味方雷元素フォロワーを選択してください'
              : selectedAbility.firstTargetId
              ? 'ディオナのスキル：2体目の相手フォロワーを選択してください'
              : '元素スキル・元素爆発の対象となる相手フォロワーを選択してください'
          : selectedHandIndex !== null
            ? ['C021', 'C044', 'C066', 'C081', 'C030'].includes(currentPlayer.hand[selectedHandIndex])
              ? currentPlayer.hand[selectedHandIndex] === 'C081'
                ? 'ファルザン：他の味方風元素フォロワーを選択してください'
                : currentPlayer.hand[selectedHandIndex] === 'C066'
                ? '九条裟羅：他の味方雷元素フォロワーを選択してください'
                : currentPlayer.hand[selectedHandIndex] === 'C030'
                ? '古華剣・裁雨留虹：効果を付与する味方フォロワーを選択してください'
                : currentPlayer.hand[selectedHandIndex] === 'C044'
                ? '霜の精：自身以外の味方フォロワーを選択してください'
                : '味方強化のファンファーレ：他の味方フォロワーを選択してください'
              : 'ファンファーレの対象となる相手フォロワーを選択してください'
            : selectedAttacker
              ? '攻撃対象を選択してください'
              : 'カードをプレイするか、攻撃可能なフォロワーを選択してください'}
      </div>



      <footer className="hand" onClick={() => { if (!handOpen) setHandOpen(true) }}>
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
            : onlineCanAct && canPlayCard(game, index)
          const selected = selectedHandIndex === index

          return (
            <button
              type="button"
              className={[
                'hand-card',
                `card-element--${card.element}`,
                `card-rarity--${card.rarity}`,
                selected ? 'selected-card' : '',
                expandedHandIndex === index ? 'hand-card--expanded' : '',
                !playable ? 'hand-card--unplayable' : '',
                index >= currentPlayer.hand.length-drawFlights.filter(flight=>flight.isSelf).length ? 'draw-pending' : '',
              ].filter(Boolean).join(' ')}
              key={`${cardId}-${index}`}
              aria-disabled={!playable}
              data-hand-index={index}
              draggable={false}
              onPointerDown={event => startHandDrag(event, index)}
              onPointerMove={moveHandDrag}
              onPointerUp={event => finishHandDrag(event)}
              onPointerCancel={event => finishHandDrag(event, true)}
              onMouseEnter={() => setInspectedCard({ kind: 'hand', cardId })}
              onFocus={() => setInspectedCard({ kind: 'hand', cardId })}
              onBlur={() => setInspectedCard(null)}
              onClick={() => {
                if (suppressHandDragClick.current) return
                if (!handOpen) {
                  setHandOpen(true)
                  setExpandedHandIndex(null)
                  return
                }
                if (expandedHandIndex !== index) {
                  setExpandedHandIndex(index)
                  setInspectedCard({ kind: 'hand', cardId })
                } else {
                  handlePlayCard(index)
                }
              }}
            >
              <span className="card-cost">
                {card.cost}
              </span>
              <CardArtwork cardId={card.id} name={card.name} className="card-artwork--hand" />
              <strong>{card.name}</strong>
              <ElementIcon element={card.element} size="xs" />
              {card.type === 'follower' ? (
                <span className="hand-card-stats hand-card-stats--follower" aria-label={`攻撃力 ${card.attack}、体力 ${card.health}`}>
                  <span className="hand-card-stat hand-card-stat--attack"><span aria-hidden="true">⚔</span>{card.attack}</span>
                  <span className="hand-card-stat hand-card-stat--health"><span aria-hidden="true">♥</span>{card.health}</span>
                </span>
              ) : (
                <span className={`hand-card-type-label hand-card-type-label--${card.type}`}>
                  <span aria-hidden="true">{card.type === 'spell' ? '✦' : '◆'}</span>
                  {card.type === 'spell' ? 'SPELL' : 'AMULET'}
                </span>
              )}
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
