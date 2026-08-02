import type { GameService } from "../game-service"
import {
  bearerToken,
  handleError,
  json,
  parseJsonBody,
  requiredDisplayName,
  type HttpEvent,
} from "../shared/http"
import { serviceWithRooms } from "./dependencies"


export function createRoomHandler(service: GameService) {
  return async (event: HttpEvent) => {
    try {
      const result = await service.createRoom(
        bearerToken(event),
        requiredDisplayName(parseJsonBody(event)),
      )
      return json(201, result)
    } catch (error) {
      return handleError(error)
    }
  }
}

export const handler = async (event: HttpEvent) =>
  createRoomHandler(serviceWithRooms())(event)
