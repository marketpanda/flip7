import type { RoomCommandRequest } from "../../packages/contracts"
import {
  createGameForPlayers,
  gameReducer,
  openingPlayer,
  type GameAction,
} from "../../packages/game-engine"
import {
  ConditionalWriteError,
  type GameRepository,
} from "./persistence/repository"
import type { RoomItem } from "./persistence/room-item"
import { epochSeconds, isExpired } from "./shared/expiry"
import { ApiError } from "./shared/http"
import { sanitizeRoom } from "./shared/sanitize-room"
import type { GuestSessionItem } from "./shared/models"
import { createOpaqueToken, createRoomCode, hashToken } from "./shared/tokens"

const GUEST_LIFETIME_SECONDS = 30 * 24 * 60 * 60
const ROOM_LIFETIME_SECONDS = 24 * 60 * 60
const SOCKET_TICKET_LIFETIME_SECONDS = 60
const MAX_PROCESSED_COMMANDS = 100

interface ServiceOptions {
  now?: () => number
  token?: () => string
  roomCode?: () => string
}

export class GameService {
  private readonly now: () => number
  private readonly token: () => string
  private readonly roomCode: () => string

  constructor(
    private readonly repository: GameRepository,
    options: ServiceOptions = {},
  ) {
    this.now = options.now ?? (() => epochSeconds())
    this.token = options.token ?? createOpaqueToken
    this.roomCode = options.roomCode ?? createRoomCode
  }

  async createGuestSession() {
    const token = this.token()
    const expiresAt = this.now() + GUEST_LIFETIME_SECONDS
    await this.repository.putSession({
      sessionHash: hashToken(token),
      itemType: "guest",
      guestId: createOpaqueToken(18),
      expiresAt,
    })
    return { token, expiresAt }
  }

  async createRoom(rawToken: string, displayName: string) {
    const session = await this.requireGuest(rawToken)
    const expiresAt = this.now() + ROOM_LIFETIME_SECONDS

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const roomId = this.roomCode()
      const room: RoomItem = {
        roomId,
        version: 1,
        status: "lobby",
        hostPlayerId: session.guestId,
        members: [{
          guestId: session.guestId,
          playerId: session.guestId,
          displayName,
        }],
        game: null,
        processedCommandIds: [],
        expiresAt,
      }
      try {
        await this.repository.createRoom(room)
        return { roomId }
      } catch (error) {
        if (!(error instanceof ConditionalWriteError)) throw error
      }
    }
    throw new ApiError(503, "ROOM_CODE_UNAVAILABLE", "Could not allocate a room code. Try again.")
  }

  async joinRoom(rawToken: string, roomId: string, displayName: string) {
    const session = await this.requireGuest(rawToken)
    const room = await this.requireRoom(roomId)
    const existing = room.members.find((member) => member.guestId === session.guestId)
    if (existing) return sanitizeRoom(room)
    if (room.status !== "lobby") {
      throw new ApiError(409, "ROOM_ALREADY_STARTED", "This room has already started.")
    }
    if (room.members.length >= 8) {
      throw new ApiError(409, "ROOM_FULL", "This room is full.")
    }
    const updated: RoomItem = {
      ...room,
      version: room.version + 1,
      members: [...room.members, {
        guestId: session.guestId,
        playerId: session.guestId,
        displayName,
      }],
    }
    await this.saveRoom(updated, room.version)
    return sanitizeRoom(updated)
  }

  async getRoom(rawToken: string, roomId: string) {
    const session = await this.requireGuest(rawToken)
    const room = await this.requireRoom(roomId)
    this.requireMember(room, session.guestId)
    return sanitizeRoom(room)
  }

  async submitCommand(rawToken: string, roomId: string, input: unknown) {
    const command = validateCommand(input)
    const session = await this.requireGuest(rawToken)
    const room = await this.requireRoom(roomId)
    const member = this.requireMember(room, session.guestId)

    if (room.processedCommandIds.includes(command.commandId)) {
      return sanitizeRoom(room)
    }
    if (room.version !== command.expectedVersion) {
      throw new ApiError(409, "VERSION_CONFLICT", "The room has changed. Fetch the latest version.")
    }

    const updated = applyCommand(room, member.playerId, command)
    updated.version = room.version + 1
    updated.processedCommandIds = [
      ...room.processedCommandIds.slice(-(MAX_PROCESSED_COMMANDS - 1)),
      command.commandId,
    ]
    updated.expiresAt = this.now() + ROOM_LIFETIME_SECONDS
    await this.saveRoom(updated, room.version)
    return sanitizeRoom(updated)
  }

  async createSocketTicket(rawToken: string, roomId: string) {
    const session = await this.requireGuest(rawToken)
    const ticket = this.token()
    const expiresAt = this.now() + SOCKET_TICKET_LIFETIME_SECONDS
    await this.repository.putSession({
      sessionHash: hashToken(ticket),
      itemType: "socket-ticket",
      guestId: session.guestId,
      roomId,
      playerId: session.guestId,
      consumed: false,
      expiresAt,
    })
    return { ticket, expiresAt }
  }

  private async requireGuest(rawToken: string): Promise<GuestSessionItem> {
    const item = await this.repository.getSession(hashToken(rawToken))
    if (!item || item.itemType !== "guest" || isExpired(item, this.now())) {
      throw new ApiError(401, "INVALID_SESSION", "The guest session is invalid or expired.")
    }
    return item
  }

  private async requireRoom(roomId: string): Promise<RoomItem> {
    const room = await this.repository.getRoom(roomId)
    if (!room || isExpired(room, this.now())) {
      throw new ApiError(404, "ROOM_NOT_FOUND", "The room was not found.")
    }
    return room
  }

  private requireMember(room: RoomItem, guestId: string) {
    const member = room.members.find((candidate) => candidate.guestId === guestId)
    if (!member) throw new ApiError(403, "NOT_A_ROOM_MEMBER", "You are not a member of this room.")
    return member
  }

  private async saveRoom(room: RoomItem, expectedVersion: number) {
    try {
      await this.repository.saveRoom(room, expectedVersion)
    } catch (error) {
      if (error instanceof ConditionalWriteError) {
        throw new ApiError(409, "VERSION_CONFLICT", "The room has changed. Fetch the latest version.")
      }
      throw error
    }
  }
}

function validateCommand(input: unknown): RoomCommandRequest {
  if (!input || typeof input !== "object") {
    throw new ApiError(400, "INVALID_COMMAND", "A command object is required.")
  }
  const value = input as Record<string, unknown>
  const types = ["start", "hit", "stay", "next-round", "target", "leave"]
  if (
    typeof value.commandId !== "string" || value.commandId.length < 1 || value.commandId.length > 100 ||
    !Number.isInteger(value.expectedVersion) || (value.expectedVersion as number) < 1 ||
    typeof value.type !== "string" || !types.includes(value.type)
  ) {
    throw new ApiError(400, "INVALID_COMMAND", "Command ID, version, or type is invalid.")
  }
  if (value.type === "target") {
    const payload = value.payload
    if (!payload || typeof payload !== "object" || typeof (payload as { targetId?: unknown }).targetId !== "string") {
      throw new ApiError(400, "INVALID_COMMAND", "A target command requires payload.targetId.")
    }
  }
  return value as unknown as RoomCommandRequest
}

function applyCommand(room: RoomItem, playerId: string, command: RoomCommandRequest): RoomItem {
  if (command.type === "leave") {
    if (room.status !== "lobby") throw illegalCommand("Players can only leave before the game starts.")
    if (room.members.length === 1) throw illegalCommand("The only player cannot leave the room.")
    const members = room.members.filter((member) => member.playerId !== playerId)
    return {
      ...room,
      members,
      hostPlayerId: room.hostPlayerId === playerId ? members[0].playerId : room.hostPlayerId,
    }
  }

  if (command.type === "start") {
    if (room.status !== "lobby" || room.hostPlayerId !== playerId || room.members.length < 2) {
      throw illegalCommand("Only the host can start a lobby with at least two players.")
    }
    return {
      ...room,
      status: "active",
      game: createGameForPlayers(room.members.map((member) => ({
        id: member.playerId,
        name: member.displayName,
      }))),
    }
  }

  if (room.status !== "active" || !room.game) throw illegalCommand("The game is not active.")
  let action: GameAction
  if (command.type === "hit") {
    if (room.game.phase === "opening-deal") {
      if (openingPlayer(room.game)?.id !== playerId) throw notYourTurn()
      action = { type: "draw" }
    } else if (room.game.phase === "flip-three") {
      if (room.game.flipResolution?.targetId !== playerId) throw notYourTurn()
      action = { type: "flip-next" }
    } else {
      if (room.game.phase !== "player-turn" || room.game.currentPlayerId !== playerId) throw notYourTurn()
      action = { type: "draw" }
    }
  } else if (command.type === "stay") {
    if (room.game.phase !== "player-turn" || room.game.currentPlayerId !== playerId) throw notYourTurn()
    action = { type: "stay" }
  } else if (command.type === "target") {
    if (room.game.phase !== "targeting" || room.game.actionRequest?.sourceId !== playerId) throw notYourTurn()
    if (!room.game.actionRequest.eligiblePlayerIds.includes(command.payload.targetId)) {
      throw illegalCommand("That player is not an eligible target.")
    }
    action = { type: "assign-action", targetId: command.payload.targetId }
  } else {
    if (room.game.phase !== "round-results" || room.hostPlayerId !== playerId) {
      throw illegalCommand("Only the host can begin the next round.")
    }
    action = { type: "next-round" }
  }

  const game = gameReducer(room.game, action)
  return {
    ...room,
    status: game.phase === "game-results" ? "complete" : "active",
    game,
  }
}

function illegalCommand(message: string) {
  return new ApiError(409, "ILLEGAL_COMMAND", message)
}

function notYourTurn() {
  return new ApiError(403, "NOT_YOUR_TURN", "This command belongs to another player.")
}
