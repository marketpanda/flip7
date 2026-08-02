import { describe, expect, it } from "vitest"
import {
  actionCard,
  createDeck,
  modifierCard,
  multiplierCard,
  numberCard,
} from "./cards"
import { createGame, gameReducer, openingPlayer } from "./reducer"
import {
  calculateRoundScore,
  createRoundResults,
  uniqueWinningIds,
} from "./rules"
import type { Player } from "./types"

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    name: "Alice",
    cards: [],
    secondChance: null,
    status: "active",
    totalScore: 0,
    ...overrides,
  }
}

describe("deck", () => {
  it("creates the official 94-card distribution", () => {
    const deck = createDeck()

    expect(deck).toHaveLength(94)
    expect(deck.filter((card) => card.kind === "action")).toHaveLength(9)
    expect(deck.filter((card) => card.kind === "modifier")).toHaveLength(5)
    expect(deck.filter((card) => card.kind === "multiplier")).toHaveLength(1)

    for (let value = 1; value <= 12; value += 1) {
      expect(
        deck.filter(
          (card) => card.kind === "number" && card.value === value,
        ),
      ).toHaveLength(value)
    }
  })
})

describe("scoring", () => {
  it("doubles number cards before adding modifiers and Flip 7", () => {
    const hand = player({
      status: "flip-seven",
      cards: [
        numberCard(0, "n0"),
        numberCard(1, "n1"),
        numberCard(2, "n2"),
        numberCard(3, "n3"),
        numberCard(4, "n4"),
        numberCard(5, "n5"),
        numberCard(6, "n6"),
        multiplierCard("times-two"),
        modifierCard(10, "plus-ten"),
      ],
    })

    expect(calculateRoundScore(hand)).toBe(67)
  })

  it("awards zero points to a busted player", () => {
    expect(
      calculateRoundScore(
        player({
          status: "busted",
          cards: [numberCard(12), modifierCard(10)],
        }),
      ),
    ).toBe(0)
  })

  it("requires a unique high score at or above 200", () => {
    const results = createRoundResults([
      player({ id: "a", totalScore: 180, cards: [numberCard(10)] }),
      player({ id: "b", totalScore: 195, cards: [numberCard(5)] }),
      player({ id: "c", totalScore: 190, cards: [numberCard(10)] }),
    ])

    expect(uniqueWinningIds(results, 200)).toEqual(["b", "c"])
  })
})

describe("game reducer", () => {
  it("completes the opening deal and rotates Hit/Stay turns", () => {
    let state = createGame(
      ["Alice", "Bob", "Carol"],
      [numberCard(1), numberCard(2), numberCard(3), numberCard(4)],
    )

    state = gameReducer(state, { type: "draw" })
    state = gameReducer(state, { type: "draw" })
    state = gameReducer(state, { type: "draw" })

    expect(state.phase).toBe("player-turn")
    expect(state.currentPlayerId).toBe(state.players[0].id)

    state = gameReducer(state, { type: "draw" })
    expect(state.currentPlayerId).toBe(state.players[1].id)

    state = gameReducer(state, { type: "stay" })
    expect(state.players[1].status).toBe("stayed")
    expect(state.currentPlayerId).toBe(state.players[2].id)
  })

  it("uses Second Chance to discard one duplicate", () => {
    let state = createGame(
      ["Alice", "Bob", "Carol"],
      [
        actionCard("second-chance", "second-chance"),
        numberCard(2, "bob-two"),
        numberCard(3, "carol-three"),
        numberCard(5, "alice-five"),
        numberCard(5, "alice-duplicate"),
      ],
    )

    state = gameReducer(state, { type: "draw" })
    const aliceId = state.players[0].id
    state = gameReducer(state, { type: "assign-action", targetId: aliceId })
    state = gameReducer(state, { type: "draw" })
    state = gameReducer(state, { type: "draw" })
    state = gameReducer(state, { type: "draw" })
    state = gameReducer(state, { type: "stay" })
    state = gameReducer(state, { type: "stay" })
    state = gameReducer(state, { type: "draw" })

    const alice = state.players[0]
    expect(alice.status).toBe("active")
    expect(alice.secondChance).toBeNull()
    expect(
      alice.cards.filter(
        (card) => card.kind === "number" && card.value === 5,
      ),
    ).toHaveLength(1)
    expect(state.discard.map((card) => card.id)).toEqual(
      expect.arrayContaining(["second-chance", "alice-duplicate"]),
    )
  })

  it("ends the round immediately with seven unique numbers", () => {
    let state = createGame(
      ["Alice", "Bob", "Carol"],
      [
        numberCard(0),
        numberCard(8),
        numberCard(9),
        numberCard(1),
        numberCard(2),
        numberCard(3),
        numberCard(4),
        numberCard(5),
        numberCard(6),
      ],
    )

    state = gameReducer(state, { type: "draw" })
    state = gameReducer(state, { type: "draw" })
    state = gameReducer(state, { type: "draw" })
    state = gameReducer(state, { type: "draw" })
    state = gameReducer(state, { type: "stay" })
    state = gameReducer(state, { type: "stay" })

    for (let draw = 0; draw < 5; draw += 1) {
      state = gameReducer(state, { type: "draw" })
    }

    expect(state.phase).toBe("round-results")
    expect(state.players[0].status).toBe("flip-seven")
    expect(state.roundResults[0].roundScore).toBe(36)
  })

  it("freezes an active target and banks their cards", () => {
    let state = createGame(
      ["Alice", "Bob", "Carol"],
      [
        actionCard("freeze"),
        numberCard(2),
        numberCard(3),
      ],
    )

    state = gameReducer(state, { type: "draw" })
    const bobId = state.players[1].id
    state = gameReducer(state, { type: "assign-action", targetId: bobId })

    expect(state.players[1].status).toBe("stayed")
    expect(state.phase).toBe("opening-deal")
  })

  it("resolves all three forced cards and discards Flip Three", () => {
    let state = createGame(
      ["Alice", "Bob", "Carol"],
      [
        actionCard("flip-three", "flip-three"),
        numberCard(1, "one"),
        modifierCard(4, "plus-four"),
        numberCard(3, "three"),
        numberCard(2, "bob-two"),
        numberCard(6, "carol-six"),
      ],
    )

    state = gameReducer(state, { type: "draw" })
    const aliceId = state.players[0].id
    state = gameReducer(state, { type: "assign-action", targetId: aliceId })

    expect(state.phase).toBe("flip-three")

    state = gameReducer(state, { type: "flip-next" })
    state = gameReducer(state, { type: "flip-next" })
    state = gameReducer(state, { type: "flip-next" })

    expect(state.phase).toBe("opening-deal")
    expect(state.players[0].cards.map((card) => card.id)).toEqual([
      "one",
      "plus-four",
      "three",
    ])
    expect(state.discard.map((card) => card.id)).toContain("flip-three")
  })

  it("moves table cards to the discard and rotates the dealer", () => {
    const base = createGame(
      ["Alice", "Bob", "Carol"],
      [numberCard(12, "remaining")],
    )
    const state = {
      ...base,
      phase: "round-results" as const,
      roundResults: [],
      players: base.players.map((item, index) => ({
        ...item,
        status: "stayed" as const,
        cards: index === 0 ? [numberCard(7, "table-card")] : [],
      })),
    }

    const next = gameReducer(state, { type: "next-round" })

    expect(next.round).toBe(2)
    expect(next.dealerIndex).toBe(1)
    expect(next.phase).toBe("opening-deal")
    expect(openingPlayer(next)?.id).toBe(next.players[1].id)
    expect(next.players.every((item) => item.cards.length === 0)).toBe(true)
    expect(next.discard.map((card) => card.id)).toContain("table-card")
    expect(next.deck.map((card) => card.id)).toEqual(["remaining"])
  })
})
