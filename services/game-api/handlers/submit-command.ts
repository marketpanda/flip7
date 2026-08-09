import type { GameService } from "../game-service"
import {
  bearerToken,
  handleError,
  json,
  parseJsonBody,
  roomIdParameter,
  type HttpEvent,
} from "../shared/http"
import { serviceWithRooms } from "./dependencies"
import {
  invokeRoomBroadcaster,
  noBroadcast,
  type RoomBroadcaster,
} from "./room-broadcaster"

export function submitCommandHandler(
  service: GameService,
  broadcastRoomUpdate: RoomBroadcaster = noBroadcast,
) {
  return async (event: HttpEvent) => {
    try {
      const roomId = roomIdParameter(event)

      const room = await service.submitCommand(
        bearerToken(event),
        roomId,
        parseJsonBody(event),
      )

      try {
        await broadcastRoomUpdate(roomId, room)
      } catch (error) {
        // The command is already saved. A WebSocket failure must not turn
        // the successfully committed command into an HTTP failure.
        console.error("Failed to broadcast room update", error)
      }

      return json(200, room)
    } catch (error) {
      return handleError(error)
    }
  }
}

export const handler = async (event: HttpEvent) =>
  submitCommandHandler(
    serviceWithRooms(),
    invokeRoomBroadcaster,
  )(event)
