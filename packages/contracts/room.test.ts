import { describe, expect, it } from "vitest"
import { PublicRoomSnapshot } from "./room"

const publicRoomFixture = {
  roomId: "AB12CD",
  version: 4,
  status: "active",
  players: [
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
  ],
  game: {
    players: [
      {
        id: "player-1",
        name: "Alice",
        cards: [],
        secondChance: null,
        status: "active",
        totalScore: 0,
      },
      {
        id: "player-2",
        name: "Bob",
        cards: [],
        secondChance: null,
        status: "active",
        totalScore: 0,
      },
    ],
    dealerIndex: 0,
    currentPlayerId: "player-1",
    openingHandled: ["player-1", "player-2"],
    phase: "player-turn",
    round: 1,
    event: "Alice, hit or stay?",
    actionRequest: null,
    flipResolution: null,
    roundResults: [],
    winnerIds: [],
    deckCount: 77,
    discardCount: 0,
  },
} satisfies PublicRoomSnapshot


describe("PublicRoomSnapshot", () => {
  it("documents a browser-safe room response", () => {
    const serialized = JSON.stringify(publicRoomFixture)

    expect(publicRoomFixture.roomId).toBe("AB12CD")
    expect(publicRoomFixture.game.deckCount).toBe(77)
    expect(serialized).not.toContain('"deck":')
    expect(serialized).not.toContain('"discard":')
    expect(serialized).not.toContain('"sessionHash":')
    expect(serialized).not.toContain('"processedCommandIds":')
    expect(serialized).not.toContain('"connectionId":')
  })
})