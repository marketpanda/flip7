import type { ApiErrorResponse } from "../../../packages/contracts"

export interface HttpEvent {
  body?: string | null
  headers?: Record<string, string | undefined>
  pathParameters?: Record<string, string | undefined> | null
}

export interface HttpResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function json(statusCode: number, value: unknown): HttpResponse {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  }
}

export function parseJsonBody(event: HttpEvent): unknown {
  if (!event.body) return {}
  try {
    return JSON.parse(event.body)
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.")
  }
}

export function bearerToken(event: HttpEvent): string {
  const entry = Object.entries(event.headers ?? {}).find(
    ([name]) => name.toLowerCase() === "authorization",
  )
  const match = entry?.[1]?.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new ApiError(401, "UNAUTHORIZED", "A bearer token is required.")
  return match[1]
}

export function roomIdParameter(event: HttpEvent): string {
  const roomId = event.pathParameters?.roomId?.trim().toUpperCase()
  if (!roomId) throw new ApiError(400, "INVALID_ROOM_ID", "A room ID is required.")
  return roomId
}

export function handleError(error: unknown): HttpResponse {
  if (error instanceof ApiError) {
    const body: ApiErrorResponse = {
      error: { code: error.code, message: error.message },
    }
    return json(error.statusCode, body)
  }
  console.error(error)
  return json(500, {
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  } satisfies ApiErrorResponse)
}

export function requiredDisplayName(body: unknown): string {
  if (!body || typeof body !== "object" || !("displayName" in body)) {
    throw new ApiError(400, "INVALID_DISPLAY_NAME", "A display name is required.")
  }
  const value = (body as { displayName?: unknown }).displayName
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 24) {
    throw new ApiError(400, "INVALID_DISPLAY_NAME", "Display name must be 1 to 24 characters.")
  }
  return value.trim()
}
