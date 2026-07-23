import {
  FLIP_SEVEN_BONUS,
  FLIP_SEVEN_COUNT,
  type Player,
  type RoundResult,
} from "./types"

export function numberCards(player: Player) {
  return player.cards.filter((card) => card.kind === "number")
}

export function hasNumber(player: Player, value: number) {
  return numberCards(player).some((card) => card.value === value)
}

export function hasFlipSeven(player: Player) {
  return new Set(numberCards(player).map((card) => card.value)).size >=
    FLIP_SEVEN_COUNT
}

export function calculateRoundScore(player: Player) {
  if (player.status === "busted") return 0

  const numberTotal = numberCards(player).reduce(
    (total, card) => total + card.value,
    0,
  )
  const hasMultiplier = player.cards.some(
    (card) => card.kind === "multiplier",
  )
  const modifierTotal = player.cards
    .filter((card) => card.kind === "modifier")
    .reduce((total, card) => total + card.value, 0)
  const flipSevenBonus =
    player.status === "flip-seven" ? FLIP_SEVEN_BONUS : 0

  return (
    numberTotal * (hasMultiplier ? 2 : 1) +
    modifierTotal +
    flipSevenBonus
  )
}

export function createRoundResults(players: Player[]): RoundResult[] {
  return players.map((player) => {
    const roundScore = calculateRoundScore(player)
    return {
      playerId: player.id,
      roundScore,
      totalScore: player.totalScore + roundScore,
      status: player.status,
    }
  })
}

export function uniqueWinningIds(results: RoundResult[], target: number) {
  const highest = Math.max(...results.map((result) => result.totalScore))
  if (highest < target) return []

  return results
    .filter((result) => result.totalScore === highest)
    .map((result) => result.playerId)
}
