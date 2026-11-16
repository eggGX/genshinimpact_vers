import { useEffect, useState } from 'react'
import {
  createFriendRoom, fetchFriendRoom, getMyFriendRoomRole,
  isFriendRoomsConfigured, joinFriendRoom, normalizeRoomCode,
  type FriendRoom,
} from '../online/firebaseRooms'
import './FriendRoomLobby.css'

export function FriendRoomLobby({ onBack }: { onBack: () => void }) {
  const [codeInput, setCodeInput] = useState('')
  const [room, setRoom] = useState<FriendRoom | null>(null)
  const [role, setRole] = useState<'host' | 'guest' | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState(false)

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

  async function run(action: () => Promise<FriendRoom>) {
    setPending(true)
    setError('')
    try {
      const next = await action()
      const myRole = await getMyFriendRoomRole(next)
      if (!myRole) throw new Error('参加権限を確認できませんでした。')
      setRoom(next)
      setRole(myRole)
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
      </div> : <section className="friend-room-panel friend-room-active">
        <span className="friend-lobby-subtitle">{role === 'host' ? 'ルーム作成者' : 'ゲスト'}</span>
        <h3>ルームコード</h3>
        <div className="friend-code-display">{room.code}</div>
        <button type="button" onClick={() => void navigator.clipboard.writeText(room.code)}>コードをコピー</button>
        <div className="friend-room-players">
          <span>プレイヤー1（ホスト） <strong>登録済み</strong></span>
          <span>プレイヤー2（ゲスト） <strong>{room.guestUid ? '参加済み' : '参加待ち'}</strong></span>
        </div>
        {pollError && <p className="friend-room-error">接続を再確認しています。通信状況をご確認ください。</p>}
        <p className="friend-room-notice">{room.guestUid
          ? '2人の参加登録を確認しました。次の段階で対戦同期と非公開情報の分離を実装します。'
          : 'フレンドにコードを伝えて参加してもらってください。接続状況は自動更新されます。'}</p>
        <button type="button" onClick={() => { setRoom(null); setRole(null); setError('') }}>ロビーを離れる</button>
      </section>}
      {pending && <p className="friend-room-wait">Firebaseに接続しています…</p>}
      {error && <p className="friend-room-error" role="alert">{error}</p>}
      <p className="friend-room-footnote">現在はオンラインロビーの実装段階です。対戦アクションの同期はまだ有効化していません。既存のローカル対戦は引き続き利用できます。</p>
    </main>
  </div>
}
