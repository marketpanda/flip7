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

export function joinRoomHandler(service: GameService) {
  return async (event: HttpEvent) => {
    try {
      return json(200, await service.joinRoom(
        bearerToken(event),
        roomIdParameter(event),
        requiredDisplayName(parseJsonBody(event)),
      ))
    } catch (error) {
      return handleError(error)
    }
  }
}

export const handler = async (event: HttpEvent) =>
  joinRoomHandler(serviceWithRooms())(event)
