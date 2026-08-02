import { describe, expect, it } from "vitest"
import { GameService } from "../game-service"
import {
  ConditionalWriteError,
  type GameRepository,
} from "../persistence/repository"
import type { RoomItem } from "../persistence/room-item"
import type { SessionItem } from "../shared/models"
import { createGuestSessionHandler } from "./create-guest-session"
import { createRoomHandler } from "./create-room"
import { createSocketTicketHandler } from "./create-socket-ticket"
import { getRoomHandler } from "./get-room"
import { joinRoomHandler } from "./join-room"
import { submitCommandHandler } from "./submit-command"

class MemoryRepository implements GameRepository {
  sessions = new Map<string, SessionItem>()
  rooms = new Map<string, RoomItem>()

  async getSession(sessionHash: string) {
    return this.sessions.get(sessionHash)
  }

  async putSession(item: SessionItem) {
    if (this.sessions.has(item.sessionHash)) throw new ConditionalWriteError()
    this.sessions.set(item.sessionHash, structuredClone(item))
  }

  async getRoom(roomId: string) {
    const room = this.rooms.get(roomId)
    return room ? structuredClone(room) : undefined
  }

  async createRoom(item: RoomItem) {
    if (this.rooms.has(item.roomId)) throw new ConditionalWriteError()
    this.rooms.set(item.roomId, structuredClone(item))
  }

  async saveRoom(item: RoomItem, expectedVersion: number) {
    if (this.rooms.get(item.roomId)?.version !== expectedVersion) {
      throw new ConditionalWriteError()
    }
    this.rooms.set(item.roomId, structuredClone(item))
  }
}

function parse<T>(response: { body: string }): T {
  return JSON.parse(response.body) as T
}

interface SessionResponse { token: string }
interface RoomCodeResponse { roomId: string }
interface RoomResponse {
  version: number
  status: string
  players: Array<{ displayName: string }>
  game: { deckCount: number }
}
interface TicketResponse { ticket: string }
interface ErrorResponse { error: { code: string } }

function authorized(token: string, extras: Record<string, unknown> = {}) {
  return {
    headers: { authorization: `Bearer ${token}` },
    ...extras,
  }
}

describe("game API handlers", () => {
  it("lets two guest sessions create and join the same room", async () => {
    const repository = new MemoryRepository()
    const tokens = ["guest-token-a", "guest-token-b", "raw-ticket-secret"]
    const service = new GameService(repository, {
      now: () => 1_800_000_000,
      token: () => tokens.shift()!,
      roomCode: () => "AB12CD",
    })

    const createGuest = createGuestSessionHandler(service)
    const firstSession = parse<SessionResponse>(await createGuest())
    const secondSession = parse<SessionResponse>(await createGuest())
    expect(firstSession.token).toBe("guest-token-a")
    expect(secondSession.token).toBe("guest-token-b")
    expect(JSON.stringify([...repository.sessions.values()])).not.toContain("guest-token-a")

    const created = await createRoomHandler(service)(authorized(firstSession.token, {
      body: JSON.stringify({ displayName: "Alice" }),
    }))
    expect(created.statusCode).toBe(201)
    expect(parse<RoomCodeResponse>(created).roomId).toBe("AB12CD")

    const joined = await joinRoomHandler(service)(authorized(secondSession.token, {
      pathParameters: { roomId: "ab12cd" },
      body: JSON.stringify({ displayName: "Bob" }),
    }))
    const joinedRoom = parse<RoomResponse>(joined)
    expect(joined.statusCode).toBe(200)
    expect(joinedRoom.version).toBe(2)
    expect(joinedRoom.players.map((player) => player.displayName))
      .toEqual(["Alice", "Bob"])

    const fetched = await getRoomHandler(service)(authorized(firstSession.token, {
      pathParameters: { roomId: "AB12CD" },
    }))
    expect(parse<RoomResponse>(fetched).players).toHaveLength(2)

    const started = await submitCommandHandler(service)(authorized(firstSession.token, {
      pathParameters: { roomId: "AB12CD" },
      body: JSON.stringify({
        commandId: "start-1",
        expectedVersion: 2,
        type: "start",
        payload: {},
      }),
    }))
    const startedRoom = parse<RoomResponse>(started)
    expect(startedRoom.status).toBe("active")
    expect(startedRoom.game.deckCount).toBe(94)
    expect(started.body).not.toContain('"deck":')

    const ticket = await createSocketTicketHandler(service)(authorized(firstSession.token, {
      pathParameters: { roomId: "AB12CD" },
    }))
    expect(parse<TicketResponse>(ticket).ticket).toBe("raw-ticket-secret")
    expect(JSON.stringify([...repository.sessions.values()])).not.toContain("raw-ticket-secret")
  })

  it("rejects expired sessions and stale room versions", async () => {
    const repository = new MemoryRepository()
    let now = 1_800_000_000
    const tokens = ["guest-a", "guest-b"]
    const service = new GameService(repository, {
      now: () => now,
      token: () => tokens.shift()!,
      roomCode: () => "ZX98YU",
    })
    const session = parse<SessionResponse>(await createGuestSessionHandler(service)())
    await createRoomHandler(service)(authorized(session.token, {
      body: JSON.stringify({ displayName: "Alice" }),
    }))

    const stale = await submitCommandHandler(service)(authorized(session.token, {
      pathParameters: { roomId: "ZX98YU" },
      body: JSON.stringify({
        commandId: "bad-version",
        expectedVersion: 99,
        type: "start",
        payload: {},
      }),
    }))
    expect(stale.statusCode).toBe(409)
    expect(parse<ErrorResponse>(stale).error.code).toBe("VERSION_CONFLICT")

    now += 31 * 24 * 60 * 60
    const expired = await getRoomHandler(service)(authorized(session.token, {
      pathParameters: { roomId: "ZX98YU" },
    }))
    expect(expired.statusCode).toBe(401)
    expect(parse<ErrorResponse>(expired).error.code).toBe("INVALID_SESSION")
  })
})
