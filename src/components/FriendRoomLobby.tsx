import { useEffect, useState } from 'react'
import {
  createFriendRoom, fetchFriendRoom, getMyFriendRoomRole,
  isFriendRoomsConfigured, joinFriendRoom, normalizeRoomCode, setFriendRoomReady, startFriendMatch,
  type FriendRoom,
} from '../online/firebaseRooms'
import { validateDeck, type DeckDefinition } from '../data/deckRules'
import { ElementIcon } from './ElementIcon'
import './FriendRoomLobby.css'

const ACTIVE_ROOM_KEY = 'genshin-friend-room-code-v1'
function saveActiveRoom(code: string | null) {
  try {
    if (code) window.localStorage.setItem(ACTIVE_ROOM_KEY, code)
    else window.localStorage.removeItem(ACTIVE_ROOM_KEY)
  } catch { /* Browsers with disabled storage still support a live session. */ }
}

export function FriendRoomLobby({ onBack, deck, onEditDeck }: {
  onBack: () => void
  deck: DeckDefinition
  onEditDeck: () => void
}) {
  const [codeInput, setCodeInput] = useState('')
  const [room, setRoom] = useState<FriendRoom | null>(null)
  const [role, setRole] = useState<'host' | 'guest' | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState(false)
  const deckErrors = validateDeck(deck)
  const myReady = role === 'host' ? room?.hostReady : room?.guestReady

  // Restore the room after refresh, but only for its authenticated participant.
  useEffect(() => {
    let active = true
    const restore = async () => {
      try {
        const code = window.localStorage.getItem(ACTIVE_ROOM_KEY)
        if (!code) return
        const saved = await fetchFriendRoom(code)
        const savedRole = await getMyFriendRoomRole(saved)
        if (!active) return
        if (!savedRole) { saveActiveRoom(null); return }
        setRoom(previous => previous ?? saved)
        setRole(previous => previous ?? savedRole)
      } catch { /* User can create or join a fresh room instead. */ }
    }
    void restore()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!room) return
    let active = true
    const poll = async () => {
      try {
        const latest = await fetchFriendRoom(room.code)
        if (!active) return
        setRoom(latest)
        setPollError(false)
      } catch {
        if (active) setPollError(true)
      }
    }
    const timer = window.setInterval(() => { void poll() }, 2500)
    return () => { active = false; window.clearInterval(timer) }
  }, [room?.code])

  async function changeReady(ready: boolean) {
    if (!room) return
    setPending(true)
    setError('')
    try {
      const latest = await setFriendRoomReady(room, ready, ready ? deck : undefined)
      setRoom(latest)
    } catch (e) {
      setError(e instanceof Error ? e.message : '準備状態の更新に失敗しました。')
    } finally { setPending(false) }
  }

  async function startMatch() {
    if (!room || role !== 'host') return
    setPending(true)
    setError('')
    try {
      const started = await startFriendMatch(room)
      setRoom(started)
    } catch (e) {
      setError(e instanceof Error ? e.message : '対戦開始に失敗しました。')
      try { setRoom(await fetchFriendRoom(room.code)) } catch { /* polling will retry */ }
    } finally { setPending(false) }
  }

  async function run(action: () => Promise<FriendRoom>) {
    setPending(true)
    setError('')
    try {
      const next = await action()
      const myRole = await getMyFriendRoomRole(next)
      if (!myRole) throw new Error('参加権限を確認できませんでした。')
      setRoom(next)
      setRole(myRole)
      saveActiveRoom(next.code)
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信エラーが発生しました。')
    } finally { setPending(false) }
  }

  return <div className="game">
    <header className="game-header"><h1>原神カードゲーム</h1><span>FRIEND MATCH</span>
      <button type="button" onClick={onBack}>デッキ選択へ戻る</button>
    </header>
    <main className="friend-room-lobby">
      <div className="friend-lobby-heading"><span>ONLINE LOBBY</span><h2>フレンド対戦</h2>
        <p>ルームコードを共有して、別のPC・ブラウザと接続できます。</p>
      </div>
      {!isFriendRoomsConfigured() ? <section className="friend-room-panel">
        <h3>Firebaseの設定が必要です</h3>
        <p><code>VITE_FIREBASE_PROJECT_ID</code> と <code>VITE_FIREBASE_API_KEY</code> を <code>.env.local</code> に設定し、Firebase Authentication（匿名ログイン）とFirestoreを有効化してください。</p>
        <p>設定手順とルールはリポジトリの <code>docs/friend-match-setup.md</code> にあります。</p>
      </section> : !room ? <div className="friend-lobby-grid">
        <section className="friend-room-panel"><h3>ルームを作る</h3>
          <p>招待する側はこちら。8文字のルームコードを発行します。</p>
          <button type="button" className="friend-room-primary" disabled={pending}
            onClick={() => void run(createFriendRoom)}>ルーム作成</button>
        </section>
        <section className="friend-room-panel"><h3>ルームに参加する</h3>
          <p>フレンドから受け取ったコードを入力してください。</p>
          <label htmlFor="friend-code">ルームコード</label>
          <input id="friend-code" type="text" autoComplete="off" spellCheck={false}
            placeholder="ABCDEFGH" maxLength={8} value={codeInput}
            onChange={event => setCodeInput(normalizeRoomCode(event.target.value))}/>
          <button type="button" disabled={pending || codeInput.length !== 8}
            onClick={() => void run(() => joinFriendRoom(codeInput))}>ルームに参加</button>
        </section>
      </div> : room.status === 'playing' ? <section className="friend-room-panel friend-room-active friend-match-session">
        <span className="friend-lobby-subtitle">ONLINE MATCH SESSION</span>
        <h3>対戦セッションを開始しました</h3>
        <div className="friend-code-display">{room.code}</div>
        <div className="friend-room-players">
          <span>プレイヤー1（ホスト） <strong>{role === 'host' ? 'あなた' : '対戦相手'}</strong></span>
          <span>プレイヤー2（ゲスト） <strong>{role === 'guest' ? 'あなた' : '対戦相手'}</strong></span>
        </div>
        <div className="friend-match-session-banner">
          <strong>2人の画面に対戦開始が反映されています</strong>
          <p>現在はオンライン対戦セッションの接続確認段階です。手札・山札の同期、
            マリガン、カード操作はまだ有効ではありません。</p>
          <p>非公開カード情報を守るため、既存のローカル対戦画面をオンライン用として
            そのまま起動することはしていません。</p>
        </div>
        {pollError && <p className="friend-room-error">通信が不安定です。接続を確認してください。</p>}
        <button type="button" onClick={() => { saveActiveRoom(null); setRoom(null); setRole(null); setError('') }}>
          ロビー画面を閉じる
        </button>
      </section> : <section className="friend-room-panel friend-room-active">
        <span className="friend-lobby-subtitle">{role === 'host' ? 'ルーム作成者' : 'ゲスト'}</span>
        <h3>ルームコード</h3>
        <div className="friend-code-display">{room.code}</div>
        <button type="button" onClick={() => void navigator.clipboard.writeText(room.code)}>コードをコピー</button>
        <div className="friend-room-players">
          <span>プレイヤー1（ホスト） <strong>{room.hostReady ? '準備完了' : '準備待ち'}</strong></span>
          <span>プレイヤー2（ゲスト） <strong>{!room.guestUid ? '参加待ち' : room.guestReady ? '準備完了' : '準備待ち'}</strong></span>
        </div>
        <div className="friend-deck-selection">
          <h3>自分のデッキ</h3>
          <p>選択元素：{deck.elements.length
            ? <span className="friend-deck-elements">{deck.elements.map(el =>
                <ElementIcon key={el} element={el} size="sm" withLabel />)}</span>
            : 'なし'}</p>
          <p>カード：{deck.cards.length} / 40枚</p>
          <p className="friend-deck-privacy">準備完了時にデッキを自分専用の非公開領域へ登録します。相手には公開されません。</p>
          {deckErrors.length > 0 && <p className="friend-room-error">{deckErrors[0]}</p>}
          <button type="button" disabled={pending || Boolean(myReady)}
            onClick={onEditDeck}>デッキを編集</button>
        </div>
        <button type="button" className="friend-room-primary"
          disabled={pending || !room.guestUid || deckErrors.length > 0}
          onClick={() => void changeReady(!myReady)}>
          {myReady ? '準備完了を解除' : 'このデッキで準備完了'}
        </button>
        {room.hostReady && room.guestReady
          ? <>
              <p className="friend-room-both-ready">両プレイヤーが準備完了しました。</p>
              {role === 'host'
                ? <button type="button" className="friend-room-primary friend-room-start"
                    disabled={pending} onClick={() => void startMatch()}>
                    対戦セッションを開始
                  </button>
                : <p className="friend-room-notice">ホストの開始操作を待っています。</p>}
            </>
          : <p className="friend-room-notice">2人の準備完了を待っています。</p>}
        {pollError && <p className="friend-room-error">接続を再確認しています。通信状況をご確認ください。</p>}
        {!room.guestUid && <p className="friend-room-notice">
          フレンドにコードを伝えて参加してもらってください。接続状況は自動更新されます。
        </p>}
        <button type="button" onClick={() => { saveActiveRoom(null); setRoom(null); setRole(null); setError('') }}>ロビーを離れる</button>
      </section>}
      {pending && <p className="friend-room-wait">Firebaseに接続しています…</p>}
      {error && <p className="friend-room-error" role="alert">{error}</p>}
      <p className="friend-room-footnote">対戦開始操作は同期されますが、手札・山札・マリガン・カード操作の同期はまだ未実装です。既存のローカル対戦は引き続き利用できます。</p>
    </main>
  </div>
}
