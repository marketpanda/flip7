"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react"
import type {
  PublicGameState,
  PublicRoomSnapshot,
  RoomCommandRequest,
} from "../../packages/contracts"
import { FLIP_SEVEN_BONUS, WINNING_SCORE } from "../../packages/game-engine"
import { calculateRoundScore } from "../../packages/game-engine/rules"
import cardBack from "../assets/cards/card_back.jpeg"
import {
  clearActiveRoom,
  guestSession,
  savedActiveRoom,
  savedGuestSession,
  saveActiveRoom,
} from "../lib/browser-session"
import {
  createRoom,
  createSocketTicket,
  GameApiError,
  getRoom,
  joinRoom,
  socketUrl,
  submitRoomCommand,
} from "../lib/game-api"
import PlayerPanel from "./PlayerPanel"

type EntryScreen = "landing" | "create" | "join"
type ConnectionState = "connecting" | "connected" | "reconnecting" | "offline"
type CommandType = RoomCommandRequest["type"]

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong."
}

function commandRequest(
  type: CommandType,
  version: number,
  targetId?: string,
): RoomCommandRequest {
  const base = { commandId: crypto.randomUUID(), expectedVersion: version }
  if (type === "target") {
    return { ...base, type, payload: { targetId: targetId ?? "" } }
  }
  return { ...base, type, payload: {} }
}

function actionName(action: string) {
  if (action === "flip-three") return "Flip Three"
  if (action === "second-chance") return "Second Chance"
  return "Freeze"
}

interface EntryProps {
  screen: EntryScreen
  initialRoomCode: string
  busy: boolean
  error: string
  onChoose: (screen: EntryScreen) => void
  onCreate: (displayName: string) => void
  onJoin: (roomId: string, displayName: string) => void
  onShowRules: () => void
}

function EntryFlow({
  screen,
  initialRoomCode,
  busy,
  error,
  onChoose,
  onCreate,
  onJoin,
  onShowRules,
}: EntryProps) {
  const [displayName, setDisplayName] = useState("")
  const [roomId, setRoomId] = useState(initialRoomCode)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = displayName.trim()
    if (!name) return
    if (screen === "create") onCreate(name)
    if (screen === "join" && roomId.trim()) onJoin(roomId.trim().toUpperCase(), name)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />
      <div className="relative z-10 grid w-full max-w-5xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="min-w-0">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.32em] text-amber-300">
            Push your luck, together
          </p>
          <h1 className="display-title text-6xl font-black leading-[0.86] tracking-[-0.07em] text-white sm:text-8xl">
            FLIP <span className="inline-block rotate-3 text-amber-300">7</span>
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-slate-300">
            Create a private table, share the six-character room code, and play
            from your own device.
          </p>
          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
            {[["2–8", "players"], [String(WINNING_SCORE), "points to win"], [`+${FLIP_SEVEN_BONUS}`, "Flip 7 bonus"]].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xl font-black text-white">{value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel min-w-0 rounded-3xl border border-white/10 p-6 shadow-2xl sm:p-8">
          {screen === "landing" ? (
            <>
              <p className="eyebrow">Online table</p>
              <h2 className="mt-2 text-3xl font-black text-white">Ready to play?</h2>
              <div className="mt-7 grid gap-3">
                <button type="button" onClick={() => onChoose("create")} className="focus-ring rounded-xl bg-amber-300 px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-slate-950 hover:bg-amber-200">
                  Create room
                </button>
                <button type="button" onClick={() => onChoose("join")} className="focus-ring rounded-xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-white hover:border-white/30 hover:bg-white/10">
                  Join room
                </button>
              </div>
              <button type="button" onClick={onShowRules} className="focus-ring mt-5 w-full rounded-lg py-2 text-sm font-bold text-slate-400 hover:text-white">
                How to play
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <button type="button" onClick={() => onChoose("landing")} className="focus-ring text-sm font-bold text-slate-400 hover:text-white">← Back</button>
              <p className="eyebrow mt-6">{screen === "create" ? "New room" : "Join a table"}</p>
              <h2 className="mt-2 text-3xl font-black text-white">
                {screen === "create" ? "Choose your name" : "Enter the room code"}
              </h2>
              <div className="mt-6 grid gap-4">
                {screen === "join" && (
                  <label>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Room code</span>
                    <input autoFocus value={roomId} onChange={(event) => setRoomId(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} maxLength={6} autoComplete="off" className="focus-ring mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-center text-xl font-black tracking-[0.3em] text-white outline-none" placeholder="AB12CD" />
                  </label>
                )}
                <label>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Display name</span>
                  <input autoFocus={screen === "create"} value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={20} className="focus-ring mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 font-bold text-white outline-none" placeholder="Your name" />
                </label>
              </div>
              {error && <p role="alert" className="mt-4 text-sm font-semibold text-rose-300">{error}</p>}
              <button disabled={busy || !displayName.trim() || (screen === "join" && roomId.length !== 6)} type="submit" className="focus-ring mt-6 w-full rounded-xl bg-amber-300 px-5 py-3.5 text-sm font-black uppercase tracking-[0.14em] text-slate-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? "Connecting…" : screen === "create" ? "Create room" : "Join room"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const connected = state === "connected"
  return (
    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} />
      {state}
    </span>
  )
}

interface LobbyProps {
  room: PublicRoomSnapshot
  playerId: string
  connection: ConnectionState
  pending: boolean
  error: string
  onCommand: (type: CommandType) => void
  onExit: () => void
  onShowRules: () => void
}

function Lobby({ room, playerId, connection, pending, error, onCommand, onExit, onShowRules }: LobbyProps) {
  const me = room.players.find((player) => player.playerId === playerId)
  const canStart = Boolean(me?.isHost && room.players.length >= 2)
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/?room=${room.roomId}`
  const [copied, setCopied] = useState(false)

  async function copyInvite() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <main className="relative min-h-screen px-4 py-8 sm:py-14">
      <div className="ambient-orb ambient-orb-one" />
      <div className="relative z-10 mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <div><p className="eyebrow">Waiting room</p><h1 className="mt-1 text-3xl font-black text-white">Your table is ready</h1></div>
          <ConnectionBadge state={connection} />
        </header>
        <section className="glass-panel mt-7 rounded-3xl border border-white/10 p-6 sm:p-8">
          <p className="text-center text-xs font-black uppercase tracking-[0.25em] text-slate-500">Room code</p>
          <p className="mt-2 text-center text-5xl font-black tracking-[0.18em] text-amber-300 sm:text-6xl">{room.roomId}</p>
          <button type="button" onClick={copyInvite} className="focus-ring mx-auto mt-5 block rounded-xl border border-white/10 px-5 py-2.5 text-sm font-bold text-slate-300 hover:border-white/25 hover:text-white">{copied ? "Invite copied!" : "Copy invite link"}</button>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
            {room.players.map((player) => (
              <div key={player.playerId} className="flex items-center justify-between border-b border-white/8 bg-white/[0.035] px-4 py-3 last:border-b-0">
                <div><p className="font-bold text-white">{player.displayName}{player.playerId === playerId ? " (you)" : ""}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{player.isHost ? "Host" : "Player"}</p></div>
                <span className="text-sm font-black text-slate-500">#{room.players.indexOf(player) + 1}</span>
              </div>
            ))}
          </div>
          {error && <p role="alert" className="mt-4 text-center text-sm font-semibold text-rose-300">{error}</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={onExit} className="focus-ring rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 hover:text-white">Leave room</button>
            {me?.isHost ? (
              <button type="button" disabled={!canStart || pending} onClick={() => onCommand("start")} className="focus-ring rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40">{room.players.length < 2 ? "Waiting for a player" : pending ? "Starting…" : "Start game"}</button>
            ) : <p className="self-center text-center text-sm font-semibold text-slate-500">Waiting for the host to start…</p>}
          </div>
          <button type="button" onClick={onShowRules} className="focus-ring mx-auto mt-4 block px-3 py-2 text-xs font-bold text-slate-500 hover:text-white">Game rules</button>
        </section>
      </div>
    </main>
  )
}

interface GameBoardProps {
  room: PublicRoomSnapshot
  playerId: string
  connection: ConnectionState
  pending: boolean
  error: string
  onCommand: (type: CommandType) => void
  onExit: () => void
  onShowRules: () => void
}

function GameBoard({ room, playerId, connection, pending, error, onCommand, onExit, onShowRules }: GameBoardProps) {
  const game = room.game!
  const opening = game.players.find((player) => !game.openingHandled.includes(player.id))
  const current = game.players.find((player) => player.id === game.currentPlayerId)
  const flipTarget = game.players.find((player) => player.id === game.flipResolution?.targetId)
  const actor = opening ?? flipTarget ?? current
  const mayHit = !pending && (
    (game.phase === "opening-deal" && opening?.id === playerId) ||
    (game.phase === "flip-three" && flipTarget?.id === playerId) ||
    (game.phase === "player-turn" && current?.id === playerId)
  )
  const mayStay = !pending && game.phase === "player-turn" && current?.id === playerId && Boolean(current.cards.length || current.secondChance)

  return (
    <main className="min-h-screen px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-amber-300 px-2.5 py-1 text-lg font-black text-slate-950">F7</div><div><h1 className="font-black text-white">Room {room.roomId}</h1><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Round {game.round} · Version {room.version}</p></div></div>
          <div className="flex items-center gap-3"><ConnectionBadge state={connection} /><button type="button" onClick={onShowRules} className="focus-ring rounded-lg px-3 py-2 text-xs font-bold text-slate-400 hover:text-white">Rules</button><button type="button" onClick={onExit} className="focus-ring rounded-lg px-3 py-2 text-xs font-bold text-slate-400 hover:text-rose-300">Exit</button></div>
        </header>
        <section aria-live="polite" className="mt-4 flex min-h-14 items-center justify-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-center"><p className="text-sm font-bold text-amber-100">{error || game.event}</p></section>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {game.players.map((player, index) => <PlayerPanel key={player.id} player={player} isCurrent={player.id === game.currentPlayerId || player.id === game.flipResolution?.targetId} isDealer={index === game.dealerIndex} />)}
        </div>
        <section className="mt-4 rounded-3xl border border-white/10 bg-slate-950/65 p-4 backdrop-blur-xl sm:p-6">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div className="text-center md:text-right"><p className="eyebrow">{game.phase === "opening-deal" ? "Opening deal" : game.phase === "flip-three" ? "Forced draw" : "Current turn"}</p><h2 className="mt-1 text-2xl font-black text-white">{actor?.name ?? "Resolving action"}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{game.deckCount} in deck · {game.discardCount} discarded</p></div>
            <button type="button" onClick={() => onCommand("hit")} disabled={!mayHit} aria-label={`Draw for ${actor?.name ?? "current player"}`} className="deck-button focus-ring mx-auto block rounded-xl disabled:cursor-not-allowed disabled:opacity-40" style={{ backgroundImage: `url(${cardBack.src})` }}><span className="sr-only">Draw from deck</span></button>
            <div className="flex justify-center gap-3 md:justify-start">
              {mayHit && <button type="button" onClick={() => onCommand("hit")} className="focus-ring rounded-xl bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 hover:bg-amber-200">{game.phase === "opening-deal" ? `Deal to ${opening?.name}` : game.phase === "flip-three" ? `Flip card · ${game.flipResolution?.remaining} left` : "Hit"}</button>}
              {game.phase === "player-turn" && current?.id === playerId && <button type="button" disabled={!mayStay} onClick={() => onCommand("stay")} className="focus-ring rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35">Stay</button>}
              {!mayHit && !(game.phase === "player-turn" && current?.id === playerId) && !["round-results", "game-results", "targeting"].includes(game.phase) && <p className="self-center text-sm font-semibold text-slate-500">Waiting for {actor?.name}…</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function RulesDialog({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rules-title"><section className="modal-panel max-h-[85vh] max-w-xl overflow-y-auto"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Quick rules</p><h2 id="rules-title" className="mt-1 text-3xl font-black text-white">Hit, stay, don&apos;t bust.</h2></div><button type="button" onClick={onClose} className="focus-ring rounded-full border border-white/10 px-3 py-1.5 text-slate-300">Close</button></div><ol className="mt-6 space-y-4 text-sm leading-6 text-slate-300"><li><strong className="text-white">1. Hit or stay.</strong> Draw a card or bank your round score.</li><li><strong className="text-white">2. Avoid duplicates.</strong> A repeated number busts you unless Second Chance saves you.</li><li><strong className="text-white">3. Flip seven.</strong> Seven unique number cards add {FLIP_SEVEN_BONUS} points.</li><li><strong className="text-white">4. Action cards.</strong> Freeze, Flip Three, and Second Chance change the table.</li><li><strong className="text-white">5. Reach {WINNING_SCORE}.</strong> The unique leader at the end of a round wins.</li></ol></section></div>
}

function TargetDialog({ game, onTarget, pending }: { game: PublicGameState; onTarget: (targetId: string) => void; pending: boolean }) {
  const request = game.actionRequest!
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="target-title"><section className="modal-panel max-w-md"><p className="eyebrow">Action card</p><h2 id="target-title" className="mt-1 text-3xl font-black text-white">Choose a target</h2><p className="mt-2 text-sm text-slate-400">Who receives <strong className="text-amber-300">{actionName(request.card.action)}</strong>?</p><div className="mt-5 grid gap-2">{request.eligiblePlayerIds.map((id) => { const player = game.players.find((item) => item.id === id)!; return <button disabled={pending} key={id} type="button" onClick={() => onTarget(id)} className="focus-ring flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:border-amber-300/60 disabled:opacity-40"><span className="font-bold text-white">{player.name}</span><span className="text-xs text-slate-500">{calculateRoundScore(player)} pts</span></button> })}</div></section></div>
}

function ResultsDialog({ room, playerId, pending, onNextRound, onExit }: { room: PublicRoomSnapshot; playerId: string; pending: boolean; onNextRound: () => void; onExit: () => void }) {
  const game = room.game!
  const gameOver = game.phase === "game-results"
  const isHost = room.players.find((player) => player.playerId === playerId)?.isHost
  const winnerNames = game.winnerIds.map((id) => game.players.find((player) => player.id === id)?.name).filter(Boolean).join(", ")
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="results-title"><section className="modal-panel max-w-2xl"><p className="eyebrow">{gameOver ? "Game complete" : `Round ${game.round}`}</p><h2 id="results-title" className="mt-1 text-3xl font-black text-white">{gameOver ? `${winnerNames} wins!` : "Round results"}</h2><p className="mt-2 text-sm text-slate-400">{game.event}</p><div className="mt-6 overflow-hidden rounded-2xl border border-white/10">{game.roundResults.slice().sort((a, b) => b.totalScore - a.totalScore).map((result, index) => <div key={result.playerId} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 border-b border-white/8 bg-white/[0.035] px-4 py-3 last:border-b-0"><span className="text-sm font-black text-slate-600">{index + 1}</span><p className="truncate font-bold text-white">{game.players.find((player) => player.id === result.playerId)?.name}</p><p className="text-sm font-bold text-amber-300">+{result.roundScore}</p><p className="w-12 text-right text-lg font-black text-white">{result.totalScore}</p></div>)}</div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onExit} className="focus-ring rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300">Exit room</button>{!gameOver && (isHost ? <button disabled={pending} type="button" onClick={onNextRound} className="focus-ring rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-40">Start round {game.round + 1}</button> : <p className="self-center text-sm font-semibold text-slate-500">Waiting for the host…</p>)}</div></section></div>
}

export default function GameApp() {
  const [entry, setEntry] = useState<EntryScreen>("landing")
  const [initialRoomCode, setInitialRoomCode] = useState("")
  const [token, setToken] = useState("")
  const [playerId, setPlayerId] = useState("")
  const [room, setRoom] = useState<PublicRoomSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [showRules, setShowRules] = useState(false)
  const [connection, setConnection] = useState<ConnectionState>("offline")
  const roomRef = useRef<PublicRoomSnapshot | null>(null)

  useEffect(() => { roomRef.current = room }, [room])

  useEffect(() => {
    let cancelled = false
    async function restore() {
      await Promise.resolve()
      if (cancelled) return
      const code = new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? ""
      if (code) { setInitialRoomCode(code); setEntry("join") }
      const active = savedActiveRoom()
      const session = savedGuestSession()
      if (!active || !session || session.expiresAt <= Math.floor(Date.now() / 1000)) return
      setBusy(true)
      try {
        const snapshot = await getRoom(session.token, active.roomId)
        if (cancelled || !snapshot.players.some((player) => player.playerId === active.playerId)) return
        setToken(session.token); setPlayerId(active.playerId); setRoom(snapshot)
      } catch {
        clearActiveRoom()
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    void restore()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(async () => {
    if (!token || !roomRef.current) return
    const latest = await getRoom(token, roomRef.current.roomId)
    setRoom(latest)
  }, [token])

  const activeRoomId = room?.roomId

  useEffect(() => {
    if (!token || !activeRoomId) return
    const roomId = activeRoomId
    let disposed = false
    let socket: WebSocket | null = null
    let retry: number | null = null
    let attempts = 0

    async function connect() {
      try {
        setConnection(attempts ? "reconnecting" : "connecting")
        const { ticket } = await createSocketTicket(token, roomId)
        if (disposed) return
        socket = new WebSocket(socketUrl(ticket))
        socket.onopen = () => { attempts = 0; setConnection("connected"); void refresh().catch(() => undefined) }
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(String(event.data)) as { type?: string; room?: PublicRoomSnapshot }
            if (message.type !== "room.updated" || !message.room) return
            const currentVersion = roomRef.current?.version ?? 0
            if (message.room.version > currentVersion + 1) void refresh()
            else if (message.room.version > currentVersion) setRoom(message.room)
          } catch { void refresh() }
        }
        socket.onclose = () => {
          if (disposed) return
          attempts += 1
          setConnection("reconnecting")
          retry = window.setTimeout(connect, Math.min(1000 * 2 ** (attempts - 1), 10000))
        }
        socket.onerror = () => socket?.close()
      } catch (connectError) {
        if (disposed) return
        attempts += 1
        setConnection("reconnecting")
        setError(errorMessage(connectError))
        retry = window.setTimeout(connect, Math.min(1000 * 2 ** (attempts - 1), 10000))
      }
    }
    void connect()
    return () => { disposed = true; if (retry) window.clearTimeout(retry); socket?.close() }
  }, [activeRoomId, refresh, token])

  async function create(displayName: string) {
    setBusy(true); setError("")
    try {
      const session = await guestSession()
      const created = await createRoom(session.token, displayName)
      const snapshot = await getRoom(session.token, created.roomId)
      const id = snapshot.players[0]?.playerId
      if (!id) throw new Error("The room did not include its host.")
      setToken(session.token); setPlayerId(id); setRoom(snapshot); saveActiveRoom({ roomId: snapshot.roomId, playerId: id })
      window.history.replaceState(null, "", `/?room=${snapshot.roomId}`)
    } catch (creationError) { setError(errorMessage(creationError)) } finally { setBusy(false) }
  }

  async function join(roomId: string, displayName: string) {
    setBusy(true); setError("")
    try {
      const session = await guestSession()
      const snapshot = await joinRoom(session.token, roomId, displayName)
      const id = snapshot.players.filter((player) => player.displayName === displayName).at(-1)?.playerId
      if (!id) throw new Error("Could not identify your player in this room.")
      setToken(session.token); setPlayerId(id); setRoom(snapshot); saveActiveRoom({ roomId: snapshot.roomId, playerId: id })
      window.history.replaceState(null, "", `/?room=${snapshot.roomId}`)
    } catch (joinError) { setError(errorMessage(joinError)) } finally { setBusy(false) }
  }

  async function sendCommand(type: CommandType, targetId?: string) {
    if (!room || !token || pending) return
    setPending(true); setError("")
    try {
      const updated = await submitRoomCommand(token, room.roomId, commandRequest(type, room.version, targetId))
      setRoom(updated)
    } catch (commandError) {
      if (commandError instanceof GameApiError && commandError.code === "VERSION_CONFLICT") {
        await refresh()
        setError("The room changed first. It has been refreshed; try again.")
      } else setError(errorMessage(commandError))
    } finally { setPending(false) }
  }

  function exitRoom() {
    clearActiveRoom(); setRoom(null); setToken(""); setPlayerId(""); setConnection("offline"); setEntry("landing"); setError(""); window.history.replaceState(null, "", "/")
  }

  return <>{room ? room.status === "lobby" ? <Lobby room={room} playerId={playerId} connection={connection} pending={pending} error={error} onCommand={sendCommand} onExit={exitRoom} onShowRules={() => setShowRules(true)} /> : room.game ? <GameBoard room={room} playerId={playerId} connection={connection} pending={pending} error={error} onCommand={sendCommand} onExit={exitRoom} onShowRules={() => setShowRules(true)} /> : null : <EntryFlow key={`${entry}-${initialRoomCode}`} screen={entry} initialRoomCode={initialRoomCode} busy={busy} error={error} onChoose={(screen) => { setEntry(screen); setError("") }} onCreate={create} onJoin={join} onShowRules={() => setShowRules(true)} />}{showRules && <RulesDialog onClose={() => setShowRules(false)} />}{room?.game?.phase === "targeting" && room.game.actionRequest?.sourceId === playerId && <TargetDialog game={room.game} pending={pending} onTarget={(targetId) => void sendCommand("target", targetId)} />}{room?.game && ["round-results", "game-results"].includes(room.game.phase) && <ResultsDialog room={room} playerId={playerId} pending={pending} onNextRound={() => void sendCommand("next-round")} onExit={exitRoom} />}</>
}
