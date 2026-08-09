import type { GameService } from "../game-service"
import {
  bearerToken,
  handleError,
  json,
  parseJsonBody,
  requiredDisplayName,
  roomIdParameter,
  type HttpEvent,
} from "../shared/http"
import { serviceWithRooms } from "./dependencies"
import {
  invokeRoomBroadcaster,
  noBroadcast,
  type RoomBroadcaster,
} from "./room-broadcaster"

export function joinRoomHandler(
  service: GameService,
  broadcastRoomUpdate: RoomBroadcaster = noBroadcast,
) {
  return async (event: HttpEvent) => {
    try {
      const roomId = roomIdParameter(event)
      const room = await service.joinRoom(
        bearerToken(event),
        roomId,
        requiredDisplayName(parseJsonBody(event)),
      )

      try {
        await broadcastRoomUpdate(roomId, room)
      } catch (error) {
        // The player has already joined. A notification failure must not turn
        // the successfully committed join into an HTTP failure.
        console.error("Failed to broadcast room update", error)
      }

      return json(200, room)
    } catch (error) {
      return handleError(error)
    }
  }
}

export const handler = async (event: HttpEvent) =>
  joinRoomHandler(
    serviceWithRooms(),
    invokeRoomBroadcaster,
  )(event)
