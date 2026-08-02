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

export function submitCommandHandler(service: GameService) {
  return async (event: HttpEvent) => {
    try {
      return json(200, await service.submitCommand(
        bearerToken(event),
        roomIdParameter(event),
        parseJsonBody(event),
      ))
    } catch (error) {
      return handleError(error)
    }
  }
}

export const handler = async (event: HttpEvent) =>
  submitCommandHandler(serviceWithRooms())(event)
