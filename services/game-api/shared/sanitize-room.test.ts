import { describe, expect, it } from "vitest"
import { sanitizeRoom } from "./sanitize-room"

describe("sanitizeRoom", () => {
  it("removes private room data", () => {
    const privateRoomFixture = {
      roomId: "AB12CD",
      version: 4,
      status: "active" as const,
      hostPlayerId: "player-1",
      members: [
        {
          guestId: "guest-secret-1",
          playerId: "player-1",
          displayName: "Alice",
        },
        {
          guestId: "guest-secret-2",
          playerId: "player-2",
          displayName: "Bob",
        },
      ],
      game: {
        players: [
          {
            id: "player-1",
            name: "Alice",
            cards: [],
            secondChance: null,
            status: "active" as const,
            totalScore: 0,
          },
          {
            id: "player-2",
            name: "Bob",
            cards: [],
            secondChance: null,
            status: "active" as const,
            totalScore: 0,
          },
        ],
        deck: [
          {
            id: "hidden-deck-card",
            kind: "number" as const,
            value: 7,
          },
        ],
        discard: [
          {
            id: "discarded-card",
            kind: "number" as const,
            value: 2,
          },
        ],
        dealerIndex: 0,
        currentPlayerId: "player-1",
        openingHandled: ["player-1", "player-2"],
        phase: "player-turn" as const,
        round: 1,
        event: "Alice, hit or stay?",
        actionRequest: null,
        flipResolution: null,
        roundResults: [],
        winnerIds: [],
      },
      processedCommandIds: ["command-secret-1"],
      expiresAt: 1_800_000_000,
      sessionHash: "session-hash-secret",
      connectionId: "connection-secret",
    }

    const result = sanitizeRoom(privateRoomFixture)
    const serialized = JSON.stringify(result)

    expect(result.game?.deckCount).toBe(privateRoomFixture.game.deck.length)
    expect(result.game?.discardCount).toBe(
      privateRoomFixture.game.discard.length,
    )
    expect(result.players).toEqual([
      {
        playerId: "player-1",
        displayName: "Alice",
        isHost: true,
      },
      {
        playerId: "player-2",
        displayName: "Bob",
        isHost: false,
      },
    ])
    expect(serialized).not.toContain('"deck":')
    expect(serialized).not.toContain('"discard":')
    expect(serialized).not.toContain('"guestId":')
    expect(serialized).not.toContain('"sessionHash":')
    expect(serialized).not.toContain('"processedCommandIds":')
    expect(serialized).not.toContain('"connectionId":')
    expect(serialized).not.toContain('"expiresAt":')
  })
})
