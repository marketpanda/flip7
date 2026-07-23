import { nanoid } from "nanoid"
import { createDeck, shuffleDeck } from "./cards"
import {
  calculateRoundScore,
  createRoundResults,
  hasFlipSeven,
  hasNumber,
  uniqueWinningIds,
} from "./rules"
import {
  WINNING_SCORE,
  type ActionCard,
  type ActionRequest,
  type Card,
  type FlipResolution,
  type GameAction,
  type GameState,
  type Player,
  type QueuedAction,
  type ResumeContext,
} from "./types"

function activePlayers(state: GameState) {
  return state.players.filter((player) => player.status === "active")
}

function playerName(state: GameState, playerId: string) {
  return state.players.find((player) => player.id === playerId)?.name ?? "Player"
}

function updatePlayer(
  state: GameState,
  playerId: string,
  update: (player: Player) => Player,
) {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? update(player) : player,
    ),
  }
}

function addOpeningHandled(state: GameState, playerId: string) {
  if (state.openingHandled.includes(playerId)) return state
  return {
    ...state,
    openingHandled: [...state.openingHandled, playerId],
  }
}

function nextActivePlayerId(state: GameState, afterPlayerId: string) {
  const startIndex = state.players.findIndex(
    (player) => player.id === afterPlayerId,
  )

  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const player = state.players[(startIndex + offset) % state.players.length]
    if (player.status === "active") return player.id
  }

  return null
}

function firstActiveFromDealer(state: GameState) {
  for (let offset = 0; offset < state.players.length; offset += 1) {
    const player =
      state.players[(state.dealerIndex + offset) % state.players.length]
    if (player.status === "active") return player.id
  }
  return null
}

function nextOpeningPlayer(state: GameState) {
  for (let offset = 0; offset < state.players.length; offset += 1) {
    const player =
      state.players[(state.dealerIndex + offset) % state.players.length]
    if (!state.openingHandled.includes(player.id)) return player
  }
  return null
}

function drawTopCard(state: GameState) {
  let deck = state.deck
  let discard = state.discard

  if (deck.length === 0 && discard.length > 0) {
    deck = shuffleDeck(discard)
    discard = []
  }

  const [card, ...rest] = deck
  return {
    card,
    state: {
      ...state,
      deck: rest,
      discard,
    },
  }
}

function finishRound(state: GameState, event = state.event): GameState {
  const roundResults = createRoundResults(state.players)
  const players = state.players.map((player) => ({
    ...player,
    totalScore:
      roundResults.find((result) => result.playerId === player.id)?.totalScore ??
      player.totalScore,
  }))
  const winnerIds = uniqueWinningIds(roundResults, WINNING_SCORE)
  const hasUniqueWinner = winnerIds.length === 1
  const hasThresholdTie =
    winnerIds.length > 1 &&
    Math.max(...roundResults.map((result) => result.totalScore)) >= WINNING_SCORE

  return {
    ...state,
    players,
    phase: hasUniqueWinner ? "game-results" : "round-results",
    currentPlayerId: null,
    event: hasThresholdTie
      ? "The leaders are tied above 200. Play another round!"
      : event,
    actionRequest: null,
    flipResolution: null,
    roundResults,
    winnerIds: hasUniqueWinner ? winnerIds : [],
  }
}

function resumeGame(state: GameState, resume: ResumeContext): GameState {
  if (activePlayers(state).length === 0) {
    return finishRound(state, "Every player has stayed or busted.")
  }

  if (resume.kind === "flip") {
    return {
      ...state,
      phase: "flip-three",
      actionRequest: null,
      flipResolution: resume.resolution,
    }
  }

  if (resume.kind === "opening") {
    const openingComplete = state.players.every((player) =>
      state.openingHandled.includes(player.id),
    )

    if (!openingComplete) {
      return {
        ...state,
        phase: "opening-deal",
        currentPlayerId: null,
        actionRequest: null,
        flipResolution: null,
      }
    }

    const firstPlayerId = firstActiveFromDealer(state)
    if (!firstPlayerId) return finishRound(state)

    return {
      ...state,
      phase: "player-turn",
      currentPlayerId: firstPlayerId,
      actionRequest: null,
      flipResolution: null,
      event: `${playerName(state, firstPlayerId)}, hit or stay?`,
    }
  }

  const nextPlayerId = nextActivePlayerId(state, resume.afterPlayerId)
  if (!nextPlayerId) return finishRound(state)

  return {
    ...state,
    phase: "player-turn",
    currentPlayerId: nextPlayerId,
    actionRequest: null,
    flipResolution: null,
    event: `${playerName(state, nextPlayerId)}, hit or stay?`,
  }
}

function eligibleTargets(state: GameState, card: ActionCard) {
  return activePlayers(state)
    .filter(
      (player) =>
        card.action !== "second-chance" || player.secondChance === null,
    )
    .map((player) => player.id)
}

function beginActionResolution(
  state: GameState,
  actions: QueuedAction[],
  resume: ResumeContext,
): GameState {
  const [nextAction, ...queuedActions] = actions
  if (!nextAction) return resumeGame(state, resume)

  const eligiblePlayerIds = eligibleTargets(state, nextAction.card)
  if (eligiblePlayerIds.length === 0) {
    return beginActionResolution(
      {
        ...state,
        discard: [...state.discard, nextAction.card],
        event: `${nextAction.card.action} had no eligible target and was discarded.`,
      },
      queuedActions,
      resume,
    )
  }

  const request: ActionRequest = {
    card: nextAction.card,
    sourceId: nextAction.sourceId,
    eligiblePlayerIds,
    queuedActions,
    resume,
  }

  return {
    ...state,
    phase: "targeting",
    currentPlayerId: nextAction.sourceId,
    actionRequest: request,
    flipResolution: null,
    event: `${playerName(state, nextAction.sourceId)} must choose a target.`,
  }
}

function completeFlipThree(
  state: GameState,
  resolution: FlipResolution,
): GameState {
  return beginActionResolution(
    {
      ...state,
      discard: [...state.discard, resolution.card],
      flipResolution: null,
      event: `${playerName(state, resolution.targetId)} completed Flip Three.`,
    },
    [...resolution.deferredActions, ...resolution.queuedActions],
    resolution.resume,
  )
}

function applyScoreCard(
  state: GameState,
  playerId: string,
  card: Exclude<Card, ActionCard>,
  resume: ResumeContext,
) {
  const player = state.players.find((item) => item.id === playerId)
  if (!player) return state

  if (card.kind === "number" && hasNumber(player, card.value)) {
    if (player.secondChance) {
      const savedState = updatePlayer(state, playerId, (current) => ({
        ...current,
        secondChance: null,
      }))
      return resumeGame(
        {
          ...savedState,
          discard: [
            ...savedState.discard,
            card,
            player.secondChance,
          ],
          event: `${player.name} used Second Chance on a duplicate ${card.value}.`,
        },
        resume,
      )
    }

    const bustedState = updatePlayer(state, playerId, (current) => ({
      ...current,
      cards: [...current.cards, card],
      status: "busted",
    }))
    return resumeGame(
      {
        ...bustedState,
        event: `${player.name} drew a duplicate ${card.value} and busted.`,
      },
      resume,
    )
  }

  const updatedState = updatePlayer(state, playerId, (current) => ({
    ...current,
    cards: [...current.cards, card],
  }))
  const updatedPlayer = updatedState.players.find(
    (item) => item.id === playerId,
  )

  if (updatedPlayer && hasFlipSeven(updatedPlayer)) {
    const flipSevenState = updatePlayer(updatedState, playerId, (current) => ({
      ...current,
      status: "flip-seven",
    }))
    return finishRound(
      flipSevenState,
      `${player.name} flipped seven unique numbers!`,
    )
  }

  const label =
    card.kind === "number"
      ? `${card.value}`
      : card.kind === "multiplier"
        ? "×2"
        : `+${card.value}`

  return resumeGame(
    {
      ...updatedState,
      event: `${player.name} drew ${label}.`,
    },
    resume,
  )
}

function processDrawnCard(
  state: GameState,
  playerId: string,
  card: Card,
  resume: ResumeContext,
): GameState {
  const handledState = addOpeningHandled(state, playerId)

  if (card.kind === "action") {
    return beginActionResolution(
      handledState,
      [{ card, sourceId: playerId }],
      resume,
    )
  }

  return applyScoreCard(handledState, playerId, card, resume)
}

function drawForTurn(state: GameState) {
  let playerId: string | null = null
  let resume: ResumeContext
  let preparedState = state

  if (state.phase === "opening-deal") {
    const player = nextOpeningPlayer(state)
    if (!player) return resumeGame(state, { kind: "opening" })
    playerId = player.id
    preparedState = addOpeningHandled(state, player.id)
    resume = { kind: "opening" }
  } else if (state.phase === "player-turn" && state.currentPlayerId) {
    playerId = state.currentPlayerId
    resume = { kind: "turn", afterPlayerId: playerId }
  } else {
    return state
  }

  const drawn = drawTopCard(preparedState)
  if (!drawn.card) {
    return finishRound(
      drawn.state,
      "No cards remain. The round ended with current scores.",
    )
  }

  return processDrawnCard(drawn.state, playerId, drawn.card, resume)
}

function assignAction(state: GameState, targetId: string): GameState {
  const request = state.actionRequest
  if (!request || !request.eligiblePlayerIds.includes(targetId)) return state

  const targetName = playerName(state, targetId)
  const withHandledTarget = addOpeningHandled(state, targetId)

  if (request.card.action === "freeze") {
    const frozenState = updatePlayer(withHandledTarget, targetId, (player) => ({
      ...player,
      status: "stayed",
    }))
    return beginActionResolution(
      {
        ...frozenState,
        discard: [...frozenState.discard, request.card],
        actionRequest: null,
        event: `${targetName} was frozen and banked their points.`,
      },
      request.queuedActions,
      request.resume,
    )
  }

  if (request.card.action === "second-chance") {
    const protectedState = updatePlayer(
      withHandledTarget,
      targetId,
      (player) => ({
        ...player,
        secondChance: request.card,
      }),
    )
    return beginActionResolution(
      {
        ...protectedState,
        actionRequest: null,
        event: `${targetName} received a Second Chance.`,
      },
      request.queuedActions,
      request.resume,
    )
  }

  const baseResume: Exclude<ResumeContext, { kind: "flip" }> =
    request.resume.kind === "flip"
      ? request.resume.resolution.resume
      : request.resume
  const carriedActions =
    request.resume.kind === "flip"
      ? [
          ...request.resume.resolution.deferredActions,
          ...request.resume.resolution.queuedActions,
          ...request.queuedActions,
        ]
      : request.queuedActions

  return {
    ...withHandledTarget,
    phase: "flip-three",
    actionRequest: null,
    flipResolution: {
      card: request.card,
      targetId,
      remaining: 3,
      deferredActions: [],
      queuedActions: carriedActions,
      resume: baseResume,
    },
    event: `${targetName} must flip three cards.`,
  }
}

function flipNext(state: GameState): GameState {
  const resolution = state.flipResolution
  if (state.phase !== "flip-three" || !resolution) return state

  const drawn = drawTopCard(state)
  if (!drawn.card) {
    return finishRound(
      drawn.state,
      "No cards remain. The round ended with current scores.",
    )
  }

  const nextResolution: FlipResolution = {
    ...resolution,
    remaining: resolution.remaining - 1,
  }
  const handledState = addOpeningHandled(drawn.state, resolution.targetId)
  const target = handledState.players.find(
    (player) => player.id === resolution.targetId,
  )
  if (!target) return state

  if (drawn.card.kind === "action") {
    if (drawn.card.action === "second-chance") {
      if (!target.secondChance) {
        const protectedState = updatePlayer(
          handledState,
          target.id,
          (player) => ({ ...player, secondChance: drawn.card as ActionCard }),
        )
        if (nextResolution.remaining === 0) {
          return completeFlipThree(protectedState, nextResolution)
        }
        return {
          ...protectedState,
          flipResolution: nextResolution,
          event: `${target.name} found a Second Chance during Flip Three.`,
        }
      }

      return beginActionResolution(
        handledState,
        [{ card: drawn.card, sourceId: target.id }],
        { kind: "flip", resolution: nextResolution },
      )
    }

    const deferredResolution = {
      ...nextResolution,
      deferredActions: [
        ...nextResolution.deferredActions,
        { card: drawn.card, sourceId: target.id },
      ],
    }
    if (deferredResolution.remaining === 0) {
      return completeFlipThree(handledState, deferredResolution)
    }
    return {
      ...handledState,
      flipResolution: deferredResolution,
      event: `${target.name} revealed ${drawn.card.action}; it will resolve after Flip Three.`,
    }
  }

  const beforeStatus = target.status
  const processed = applyScoreCard(
    handledState,
    target.id,
    drawn.card,
    { kind: "flip", resolution: nextResolution },
  )
  const processedTarget = processed.players.find(
    (player) => player.id === target.id,
  )

  if (
    processed.phase === "round-results" ||
    processed.phase === "game-results"
  ) {
    return {
      ...processed,
      discard: [
        ...processed.discard,
        resolution.card,
        ...nextResolution.deferredActions.map((item) => item.card),
        ...nextResolution.queuedActions.map((item) => item.card),
      ],
    }
  }

  if (beforeStatus === "active" && processedTarget?.status === "busted") {
    const cleared = {
      ...processed,
      discard: [
        ...processed.discard,
        resolution.card,
        ...nextResolution.deferredActions.map((item) => item.card),
        ...nextResolution.queuedActions.map((item) => item.card),
      ],
      flipResolution: null,
    }
    return resumeGame(cleared, resolution.resume)
  }

  if (nextResolution.remaining === 0) {
    return completeFlipThree(processed, nextResolution)
  }

  return {
    ...processed,
    phase: "flip-three",
    flipResolution: nextResolution,
  }
}

function stay(state: GameState) {
  if (state.phase !== "player-turn" || !state.currentPlayerId) return state
  const playerId = state.currentPlayerId
  const player = state.players.find((item) => item.id === playerId)
  if (!player || player.cards.length === 0 && !player.secondChance) return state

  const stayedState = updatePlayer(state, playerId, (current) => ({
    ...current,
    status: "stayed",
  }))
  return resumeGame(
    {
      ...stayedState,
      event: `${player.name} stayed with ${calculateRoundScore({
        ...player,
        status: "stayed",
      })} points.`,
    },
    { kind: "turn", afterPlayerId: playerId },
  )
}

function nextRound(state: GameState): GameState {
  if (state.phase !== "round-results") return state

  const returnedCards = state.players.flatMap((player) => [
    ...player.cards,
    ...(player.secondChance ? [player.secondChance] : []),
  ])
  const dealerIndex = (state.dealerIndex + 1) % state.players.length
  const players = state.players.map((player) => ({
    ...player,
    cards: [],
    secondChance: null,
    status: "active" as const,
  }))

  return {
    ...state,
    players,
    discard: [...state.discard, ...returnedCards],
    dealerIndex,
    currentPlayerId: null,
    openingHandled: [],
    phase: "opening-deal",
    round: state.round + 1,
    event: `${players[dealerIndex].name} deals the opening cards.`,
    actionRequest: null,
    flipResolution: null,
    roundResults: [],
    winnerIds: [],
  }
}

export function createGame(
  names: string[],
  deck: Card[] = shuffleDeck(createDeck()),
): GameState {
  const players = names.map((name) => ({
    id: nanoid(),
    name,
    cards: [],
    secondChance: null,
    status: "active" as const,
    totalScore: 0,
  }))

  return {
    players,
    deck,
    discard: [],
    dealerIndex: 0,
    currentPlayerId: null,
    openingHandled: [],
    phase: "opening-deal",
    round: 1,
    event: `${players[0]?.name ?? "The dealer"} deals the opening cards.`,
    actionRequest: null,
    flipResolution: null,
    roundResults: [],
    winnerIds: [],
  }
}

export function openingPlayer(state: GameState) {
  if (state.phase !== "opening-deal") return null
  return nextOpeningPlayer(state)
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "draw":
      return drawForTurn(state)
    case "stay":
      return stay(state)
    case "assign-action":
      return assignAction(state, action.targetId)
    case "flip-next":
      return flipNext(state)
    case "next-round":
      return nextRound(state)
    default:
      return state
  }
}
