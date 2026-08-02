export interface CreateGuestSessionResponse {
    token: string
    expiresAt: number
}

export interface CreateRoomRequest {
    displayName: string
}

export interface JoinRoomRequest {
    displayName: string
}

export type EmptyPayload = Record<string, never>

export type RoomCommandRequest =
    | {
        commandId: string
        expectedVersion: number
        type: "start" | "hit" | "stay" | "next-round"
        payload: EmptyPayload
    }
    | {
        commandId: string
        expectedVersion: number
        type: "target"
        payload: {
            targetId: string
        }
    }
    | {
        commandId: string
        expectedVersion: number
        type: "leave"
        payload: Record<string, never>
    }

export interface CreateSocketTicketResponse {
    ticket: string
    expiresAt: number
}

export interface ApiErrorResponse {
    error: {
        code: string
        message: string
    }
}
