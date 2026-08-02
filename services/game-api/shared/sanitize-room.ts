import type { PublicGameState, PublicRoomSnapshot } from "../../../packages/contracts"
import type { GameState } from "../../../packages/game-engine"
import type { RoomItem } from "../persistence/room-item"

function sanitizeGame(game: GameState | null): PublicGameState | null {
    if (!game) return null

    const { deck, discard, ...visibleGame } = game
    return {
        ...visibleGame,
        deckCount: deck.length,
        discardCount: discard.length,
    }
}

export function sanitizeRoom(room: RoomItem): PublicRoomSnapshot {
    return {
        roomId: room.roomId,
        version: room.version,
        status: room.status,
        players: room.members.map((member) => ({
            playerId: member.playerId,
            displayName: member.displayName,
            isHost: member.playerId === room.hostPlayerId,
        })),
        game: sanitizeGame(room.game),
    }
}
