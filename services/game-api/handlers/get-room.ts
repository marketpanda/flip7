import type { GameService } from "../game-service"
import {
  bearerToken,
  handleError,
  json,
  roomIdParameter,
  type HttpEvent,
} from "../shared/http"
import { serviceWithRooms } from "./dependencies"

export function getRoomHandler(service: GameService) {
  return async (event: HttpEvent) => {
    try {
      return json(200, await service.getRoom(
        bearerToken(event),
        roomIdParameter(event),
      ))
    } catch (error) {
      return handleError(error)
    }
  }
}

export const handler = async (event: HttpEvent) =>
  getRoomHandler(serviceWithRooms())(event)
