import { createHash, randomBytes } from "node:crypto"

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url")
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function createRoomCode(length = 6): string {
  const random = randomBytes(length)
  return Array.from(random, (value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join("")
}
