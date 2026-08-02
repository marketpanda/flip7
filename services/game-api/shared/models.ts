export interface GuestSessionItem {
  sessionHash: string
  itemType: "guest"
  guestId: string
  expiresAt: number
}

export interface SocketTicketItem {
  sessionHash: string
  itemType: "socket-ticket"
  guestId: string
  roomId: string
  playerId: string
  consumed: boolean
  expiresAt: number
}

export type SessionItem = GuestSessionItem | SocketTicketItem
