import CardFace from "./CardFace"
import { calculateRoundScore, numberCards } from "../game/rules"
import type { Player } from "../game/types"

const statusLabels = {
  active: "In play",
  stayed: "Banked",
  busted: "Busted",
  "flip-seven": "Flip 7!",
}

interface PlayerPanelProps {
  player: Player
  isCurrent: boolean
  isDealer: boolean
}

export default function PlayerPanel({
  player,
  isCurrent,
  isDealer,
}: PlayerPanelProps) {
  const numbers = numberCards(player)

  return (
    <section
      aria-label={`${player.name}, ${statusLabels[player.status]}`}
      className={[
        "player-panel min-w-0 rounded-2xl border p-3 sm:p-4",
        isCurrent
          ? "border-amber-300 bg-amber-300/10 shadow-[0_0_35px_rgba(251,191,36,0.16)]"
          : "border-white/10 bg-white/[0.045]",
        player.status === "busted" ? "opacity-65" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-black tracking-tight text-white">
              {player.name}
            </h2>
            {isDealer && (
              <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-sky-200">
                Dealer
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs font-semibold text-slate-400">
            {statusLabels[player.status]} · {numbers.length}/7 numbers
          </p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-black tabular-nums text-white">
            {player.totalScore}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            total
          </p>
        </div>
      </div>

      <div className="mt-3 flex min-h-20 flex-wrap content-start gap-1.5">
        {player.cards.length === 0 && !player.secondChance ? (
          <p className="self-center text-sm text-slate-600">Waiting for a card</p>
        ) : (
          <>
            {player.cards.map((card) => (
              <CardFace
                key={card.id}
                card={card}
                compact
                muted={player.status === "busted"}
              />
            ))}
            {player.secondChance && (
              <CardFace
                card={player.secondChance}
                compact
                muted={player.status === "busted"}
              />
            )}
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3">
        <span className="text-xs font-semibold text-slate-500">
          Round value
        </span>
        <span
          className={[
            "text-lg font-black tabular-nums",
            player.status === "busted" ? "text-rose-400" : "text-amber-300",
          ].join(" ")}
        >
          {calculateRoundScore(player)}
        </span>
      </div>
    </section>
  )
}
