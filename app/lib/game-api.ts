import type {
  ApiErrorResponse,
  CreateGuestSessionResponse,
  CreateSocketTicketResponse,
  PublicRoomSnapshot,
  RoomCommandRequest,
} from "../../packages/contracts"

export const gameApiUrl = (process.env.NEXT_PUBLIC_GAME_API_URL ?? "").replace(/\/$/, "")
export const gameWebSocketUrl = process.env.NEXT_PUBLIC_GAME_WEBSOCKET_URL ?? ""

export class GameApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = "GameApiError"
  }
}

function requireApiUrl() {
  if (!gameApiUrl) {
    throw new GameApiError(
      "Set NEXT_PUBLIC_GAME_API_URL in .env.local before playing online.",
      0,
      "MISSING_CONFIGURATION",
    )
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  requireApiUrl()
  const response = await fetch(`${gameApiUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    let error: ApiErrorResponse | null = null
    try {
      error = await response.json() as ApiErrorResponse
    } catch {
      // The gateway may return a non-JSON error before a Lambda is reached.
    }
    throw new GameApiError(
      error?.error.message ?? `The game service returned ${response.status}.`,
      response.status,
      error?.error.code ?? "REQUEST_FAILED",
    )
  }

  return response.json() as Promise<T>
}

export function createGuestSession() {
  return request<CreateGuestSessionResponse>("/sessions/guest", { method: "POST" })
}

export function createRoom(token: string, displayName: string) {
  return request<{ roomId: string }>("/rooms", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  }, token)
}

export function joinRoom(token: string, roomId: string, displayName: string) {
  return request<PublicRoomSnapshot>(`/rooms/${encodeURIComponent(roomId)}/join`, {
    method: "POST",
    body: JSON.stringify({ displayName }),
  }, token)
}

export function getRoom(token: string, roomId: string) {
  return request<PublicRoomSnapshot>(`/rooms/${encodeURIComponent(roomId)}`, {}, token)
}

export function submitRoomCommand(
  token: string,
  roomId: string,
  command: RoomCommandRequest,
) {
  return request<PublicRoomSnapshot>(
    `/rooms/${encodeURIComponent(roomId)}/commands`,
    { method: "POST", body: JSON.stringify(command) },
    token,
  )
}

export function createSocketTicket(token: string, roomId: string) {
  return request<CreateSocketTicketResponse>(
    `/rooms/${encodeURIComponent(roomId)}/socket-ticket`,
    { method: "POST" },
    token,
  )
}

export function socketUrl(ticket: string) {
  if (!gameWebSocketUrl) {
    throw new GameApiError(
      "Set NEXT_PUBLIC_GAME_WEBSOCKET_URL in .env.local before playing online.",
      0,
      "MISSING_CONFIGURATION",
    )
  }
  const url = new URL(gameWebSocketUrl)
  url.searchParams.set("ticket", ticket)
  return url.toString()
}
