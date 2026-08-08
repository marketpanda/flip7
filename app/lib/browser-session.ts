import type { CreateGuestSessionResponse } from "../../packages/contracts"
import { createGuestSession } from "./game-api"

const GUEST_KEY = "flip7.guest-session"
const ROOM_KEY = "flip7.active-room"

export interface ActiveRoom {
  roomId: string
  playerId: string
}

function readJson<T>(key: string): T | null {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

export async function guestSession() {
  const existing = readJson<CreateGuestSessionResponse>(GUEST_KEY)
  const now = Math.floor(Date.now() / 1000)
  if (existing?.token && existing.expiresAt > now + 60) return existing

  const created = await createGuestSession()
  window.localStorage.setItem(GUEST_KEY, JSON.stringify(created))
  return created
}

export function savedGuestSession() {
  return readJson<CreateGuestSessionResponse>(GUEST_KEY)
}

export function saveActiveRoom(room: ActiveRoom) {
  window.localStorage.setItem(ROOM_KEY, JSON.stringify(room))
}

export function savedActiveRoom() {
  return readJson<ActiveRoom>(ROOM_KEY)
}

export function clearActiveRoom() {
  window.localStorage.removeItem(ROOM_KEY)
}
