import { GameState } from "../game-engine"

export interface PublicRoomPlayer {
    playerId: string
    displayName: string
    isHost: boolean
}

export type PublicRoomStatus = "lobby" | "active" | "complete"

export type PublicGameState = Omit<GameState, "deck" | "discard"> & {
    deckCount: number
    discardCount: number
}

export interface PublicRoomSnapshot {
    roomId: string
    version: number
    status: PublicRoomStatus
    players: PublicRoomPlayer[]
    game: PublicGameState | null
}
