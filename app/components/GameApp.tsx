"use client"

import { useReducer, useState, type FormEvent } from "react"
import cardBack from "../assets/cards/card_back.jpeg"
import { createGame, gameReducer, openingPlayer } from "../game/reducer"
import { calculateRoundScore } from "../game/rules"
import {
  FLIP_SEVEN_BONUS,
  WINNING_SCORE,
  type GameAction,
  type GameState,
} from "../game/types"
import PlayerPanel from "./PlayerPanel"

type SessionAction =
  | { type: "start-game"; names: string[] }
  | { type: "leave-game" }
  | GameAction

function sessionReducer(
  state: GameState | null,
  action: SessionAction,
): GameState | null {
  if (action.type === "start-game") return createGame(action.names)
  if (action.type === "leave-game") return null
  if (!state) return state
  return gameReducer(state, action)
}

function actionName(action: string) {
  if (action === "flip-three") return "Flip Three"
  if (action === "second-chance") return "Second Chance"
  return "Freeze"
}

interface SetupScreenProps {
  onStart: (names: string[]) => void
  onShowRules: () => void
}

function SetupScreen({ onStart, onShowRules }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(3)
  const [names, setNames] = useState([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
    "Player 5",
    "Player 6",
  ])
  const [error, setError] = useState("")

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const selectedNames = names
      .slice(0, playerCount)
      .map((name) => name.trim())
    const normalized = selectedNames.map((name) => name.toLowerCase())

    if (selectedNames.some((name) => !name)) {
      setError("Every player needs a name.")
      return
    }
    if (new Set(normalized).size !== selectedNames.length) {
      setError("Player names must be unique.")
      return
    }

    setError("")
    onStart(selectedNames)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />

      <div className="relative z-10 grid w-full max-w-5xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="min-w-0">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.32em] text-amber-300">
            Push your luck
          </p>
          <h1 className="display-title text-6xl font-black leading-[0.86] tracking-[-0.07em] text-white sm:text-8xl">
            FLIP
            <span className="ml-2 inline-block rotate-3 text-amber-300">7</span>
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-slate-300">
            Build a high-scoring line, bank it before you bust, or chase seven
            unique numbers for the bonus.
          </p>

          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
            {[
              ["3–6", "players"],
              ["200", "points to win"],
              [`+${FLIP_SEVEN_BONUS}`, "Flip 7 bonus"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <p className="text-xl font-black text-white">{value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <form
          onSubmit={submit}
          className="glass-panel min-w-0 rounded-3xl border border-white/10 p-5 shadow-2xl sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                New table
              </p>
              <h2 className="mt-1 text-2xl font-black text-white">
                Who&apos;s playing?
              </h2>
            </div>
            <button
              type="button"
              onClick={onShowRules}
              className="focus-ring rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              How to play
            </button>
          </div>

          <div className="mt-6">
            <label
              htmlFor="player-count"
              className="text-xs font-bold uppercase tracking-wider text-slate-400"
            >
              Player count
            </label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[3, 4, 5, 6].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setPlayerCount(count)}
                  aria-pressed={playerCount === count}
                  className={[
                    "focus-ring rounded-xl border py-2.5 text-sm font-black transition",
                    playerCount === count
                      ? "border-amber-300 bg-amber-300 text-slate-950"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25",
                  ].join(" ")}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {names.slice(0, playerCount).map((name, index) => (
              <label key={index} className="block">
                <span className="sr-only">Player {index + 1} name</span>
                <input
                  value={name}
                  maxLength={20}
                  onChange={(event) => {
                    const updated = [...names]
                    updated[index] = event.target.value
                    setNames(updated)
                  }}
                  className="focus-ring w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 hover:border-white/20"
                  placeholder={`Player ${index + 1}`}
                />
              </label>
            ))}
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm font-semibold text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="focus-ring mt-6 w-full rounded-xl bg-amber-300 px-5 py-3.5 text-sm font-black uppercase tracking-[0.16em] text-slate-950 shadow-[0_12px_35px_rgba(251,191,36,0.22)] transition hover:-translate-y-0.5 hover:bg-amber-200"
          >
            Start game
          </button>
        </form>
      </div>
    </main>
  )
}

interface RulesDialogProps {
  onClose: () => void
}

function RulesDialog({ onClose }: RulesDialogProps) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
    >
      <section className="modal-panel max-h-[85vh] max-w-xl overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Quick rules</p>
            <h2 id="rules-title" className="mt-1 text-3xl font-black text-white">
              Hit, stay, don&apos;t bust.
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="focus-ring rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:text-white"
          >
            Close
          </button>
        </div>

        <ol className="mt-6 space-y-4 text-sm leading-6 text-slate-300">
          <li>
            <strong className="text-white">1. Hit or stay.</strong> Draw one
            card to build your round score, or stay to bank it safely.
          </li>
          <li>
            <strong className="text-white">2. Avoid duplicates.</strong> A
            second copy of a number busts you for zero round points unless you
            have a Second Chance.
          </li>
          <li>
            <strong className="text-white">3. Flip seven.</strong> Seven unique
            number cards end the round immediately and add 15 points.
          </li>
          <li>
            <strong className="text-white">4. Use action cards.</strong> Freeze
            banks a target&apos;s score. Flip Three forces a target to take
            three cards. Second Chance cancels one duplicate.
          </li>
          <li>
            <strong className="text-white">5. Score modifiers.</strong> ×2
            doubles number cards only, then additive bonuses are applied.
          </li>
          <li>
            <strong className="text-white">6. Reach 200.</strong> At the end of
            a round, the unique highest-scoring player at 200 or more wins.
          </li>
        </ol>
      </section>
    </div>
  )
}

interface ResultsDialogProps {
  game: GameState
  onNextRound: () => void
  onNewGame: () => void
}

function ResultsDialog({
  game,
  onNextRound,
  onNewGame,
}: ResultsDialogProps) {
  const gameOver = game.phase === "game-results"
  const winnerNames = game.winnerIds
    .map((id) => game.players.find((player) => player.id === id)?.name)
    .filter(Boolean)
    .join(", ")

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="results-title"
    >
      <section className="modal-panel max-w-2xl">
        <p className="eyebrow">{gameOver ? "Game complete" : `Round ${game.round}`}</p>
        <h2 id="results-title" className="mt-1 text-3xl font-black text-white">
          {gameOver ? `${winnerNames} wins!` : "Round results"}
        </h2>
        <p className="mt-2 text-sm text-slate-400">{game.event}</p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          {game.roundResults
            .slice()
            .sort((a, b) => b.totalScore - a.totalScore)
            .map((result, index) => {
              const player = game.players.find(
                (item) => item.id === result.playerId,
              )
              return (
                <div
                  key={result.playerId}
                  className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 border-b border-white/8 bg-white/[0.035] px-3 py-3 last:border-b-0 sm:px-4"
                >
                  <span className="text-sm font-black text-slate-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">
                      {player?.name}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {result.status.replace("-", " ")}
                    </p>
                  </div>
                  <p className="text-right text-sm font-bold text-amber-300">
                    +{result.roundScore}
                  </p>
                  <p className="w-12 text-right text-lg font-black text-white">
                    {result.totalScore}
                  </p>
                </div>
              )
            })}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onNewGame}
            className="focus-ring rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 hover:border-white/25 hover:text-white"
          >
            New game
          </button>
          {!gameOver && (
            <button
              type="button"
              onClick={onNextRound}
              className="focus-ring rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-200"
            >
              Start round {game.round + 1}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

interface TargetDialogProps {
  game: GameState
  onTarget: (targetId: string) => void
}

function TargetDialog({ game, onTarget }: TargetDialogProps) {
  const request = game.actionRequest
  if (!request) return null

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="target-title"
    >
      <section className="modal-panel max-w-md">
        <p className="eyebrow">Action card</p>
        <h2 id="target-title" className="mt-1 text-3xl font-black text-white">
          Choose a target
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Who receives{" "}
          <strong className="text-amber-300">
            {actionName(request.card.action)}
          </strong>
          ?
        </p>

        <div className="mt-5 grid gap-2">
          {request.eligiblePlayerIds.map((playerId) => {
            const player = game.players.find((item) => item.id === playerId)
            return (
              <button
                key={playerId}
                type="button"
                onClick={() => onTarget(playerId)}
                className="focus-ring flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-amber-300/60 hover:bg-amber-300/10"
              >
                <span className="font-bold text-white">{player?.name}</span>
                <span className="text-xs font-semibold text-slate-500">
                  {calculateRoundScore(player!)} pts
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

interface GameBoardProps {
  game: GameState
  dispatch: (action: SessionAction) => void
  onShowRules: () => void
}

function GameBoard({ game, dispatch, onShowRules }: GameBoardProps) {
  const opening = openingPlayer(game)
  const current = game.players.find(
    (player) => player.id === game.currentPlayerId,
  )
  const flipTarget = game.players.find(
    (player) => player.id === game.flipResolution?.targetId,
  )
  const canStay =
    current && (current.cards.length > 0 || current.secondChance !== null)

  return (
    <main className="min-h-screen px-3 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-300 px-2.5 py-1 text-lg font-black tracking-tighter text-slate-950">
              F7
            </div>
            <div>
              <h1 className="font-black tracking-tight text-white">Flip 7</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Round {game.round} · First to {WINNING_SCORE}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onShowRules}
              className="focus-ring rounded-lg px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-white"
            >
              Rules
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Leave this game and return to player setup? Current scores will be lost.",
                  )
                ) {
                  dispatch({ type: "leave-game" })
                }
              }}
              className="focus-ring rounded-lg px-3 py-2 text-xs font-bold text-slate-400 hover:bg-rose-400/10 hover:text-rose-300"
            >
              New game
            </button>
          </div>
        </header>

        <section
          aria-live="polite"
          className="mt-4 flex min-h-14 items-center justify-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-center"
        >
          <p className="text-sm font-bold text-amber-100">{game.event}</p>
        </section>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {game.players.map((player, index) => (
            <PlayerPanel
              key={player.id}
              player={player}
              isCurrent={
                player.id === game.currentPlayerId ||
                player.id === game.flipResolution?.targetId
              }
              isDealer={index === game.dealerIndex}
            />
          ))}
        </div>

        <section className="mt-4 rounded-3xl border border-white/10 bg-slate-950/65 p-4 backdrop-blur-xl sm:p-6">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div className="text-center md:text-right">
              <p className="eyebrow">
                {game.phase === "opening-deal"
                  ? "Opening deal"
                  : game.phase === "flip-three"
                    ? "Forced draw"
                    : "Current turn"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-white">
                {opening?.name ??
                  flipTarget?.name ??
                  current?.name ??
                  "Resolving action"}
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {game.deck.length} in deck · {game.discard.length} discarded
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                dispatch(
                  game.phase === "flip-three"
                    ? { type: "flip-next" }
                    : { type: "draw" },
                )
              }
              disabled={
                !["opening-deal", "player-turn", "flip-three"].includes(
                  game.phase,
                )
              }
              aria-label={
                game.phase === "flip-three"
                  ? `Flip next card for ${flipTarget?.name}`
                  : game.phase === "opening-deal"
                    ? `Deal opening card to ${opening?.name}`
                    : `Hit for ${current?.name}`
              }
              className="deck-button focus-ring mx-auto block rounded-xl disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundImage: `url(${cardBack.src})` }}
            >
              <span className="sr-only">Draw from deck</span>
            </button>

            <div className="flex justify-center gap-3 md:justify-start">
              {game.phase === "player-turn" && (
                <>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "draw" })}
                    className="focus-ring rounded-xl bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-200"
                  >
                    Hit
                  </button>
                  <button
                    type="button"
                    disabled={!canStay}
                    onClick={() => dispatch({ type: "stay" })}
                    className="focus-ring rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-black text-white transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Stay
                  </button>
                </>
              )}
              {game.phase === "opening-deal" && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "draw" })}
                  className="focus-ring rounded-xl bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 hover:bg-amber-200"
                >
                  Deal to {opening?.name}
                </button>
              )}
              {game.phase === "flip-three" && game.flipResolution && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "flip-next" })}
                  className="focus-ring rounded-xl bg-rose-400 px-6 py-3 text-sm font-black text-slate-950 hover:bg-rose-300"
                >
                  Flip card · {game.flipResolution.remaining} left
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function GameApp() {
  const [game, dispatch] = useReducer(sessionReducer, null)
  const [showRules, setShowRules] = useState(false)

  return (
    <>
      {game ? (
        <GameBoard
          game={game}
          dispatch={dispatch}
          onShowRules={() => setShowRules(true)}
        />
      ) : (
        <SetupScreen
          onStart={(names) => dispatch({ type: "start-game", names })}
          onShowRules={() => setShowRules(true)}
        />
      )}

      {showRules && <RulesDialog onClose={() => setShowRules(false)} />}

      {game?.phase === "targeting" && (
        <TargetDialog
          game={game}
          onTarget={(targetId) =>
            dispatch({ type: "assign-action", targetId })
          }
        />
      )}

      {game &&
        (game.phase === "round-results" ||
          game.phase === "game-results") && (
          <ResultsDialog
            game={game}
            onNextRound={() => dispatch({ type: "next-round" })}
            onNewGame={() => dispatch({ type: "leave-game" })}
          />
        )}
    </>
  )
}
