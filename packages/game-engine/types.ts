export const WINNING_SCORE = 200
export const FLIP_SEVEN_COUNT = 7
export const FLIP_SEVEN_BONUS = 15

export type PlayerStatus = "active" | "stayed" | "busted" | "flip-seven"
export type GamePhase =
  | "opening-deal"
  | "player-turn"
  | "targeting"
  | "flip-three"
  | "round-results"
  | "game-results"

interface CardBase {
  id: string
}

export interface NumberCard extends CardBase {
  kind: "number"
  value: number
}

export interface ModifierCard extends CardBase {
  kind: "modifier"
  value: 2 | 4 | 6 | 8 | 10
}

export interface MultiplierCard extends CardBase {
  kind: "multiplier"
  value: 2
}

export type ActionName = "freeze" | "flip-three" | "second-chance"

export interface ActionCard extends CardBase {
  kind: "action"
  action: ActionName
}

export type Card = NumberCard | ModifierCard | MultiplierCard | ActionCard
export type ScoreCard = NumberCard | ModifierCard | MultiplierCard

export interface GamePlayerInput {
  id: string
  name: string
}

export interface Player {
  id: string
  name: string
  cards: ScoreCard[]
  secondChance: ActionCard | null
  status: PlayerStatus
  totalScore: number
}

export interface RoundResult {
  playerId: string
  roundScore: number
  totalScore: number
  status: PlayerStatus
}

export type ResumeContext =
  | { kind: "opening" }
  | { kind: "turn"; afterPlayerId: string }
  | { kind: "flip"; resolution: FlipResolution }

export interface QueuedAction {
  card: ActionCard
  sourceId: string
}

export interface ActionRequest {
  card: ActionCard
  sourceId: string
  eligiblePlayerIds: string[]
  queuedActions: QueuedAction[]
  resume: ResumeContext
}

export interface FlipResolution {
  card: ActionCard
  targetId: string
  remaining: number
  deferredActions: QueuedAction[]
  queuedActions: QueuedAction[]
  resume: Exclude<ResumeContext, { kind: "flip" }>
}

export interface GameState {
  players: Player[]
  deck: Card[]
  discard: Card[]
  dealerIndex: number
  currentPlayerId: string | null
  openingHandled: string[]
  phase: GamePhase
  round: number
  event: string
  actionRequest: ActionRequest | null
  flipResolution: FlipResolution | null
  roundResults: RoundResult[]
  winnerIds: string[]
}

export type GameAction =
  | { type: "draw" }
  | { type: "stay" }
  | { type: "assign-action"; targetId: string }
  | { type: "flip-next" }
  | { type: "next-round" }
