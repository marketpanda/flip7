import type { GameState } from "../../../packages/game-engine"

export interface RoomMember {
  guestId: string
  playerId: string
  displayName: string
}

export interface RoomItem {
  roomId: string
  version: number
  status: "lobby" | "active" | "complete"
  hostPlayerId: string
  members: RoomMember[]
  game: GameState | null
  processedCommandIds: string[]
  expiresAt: number
}
