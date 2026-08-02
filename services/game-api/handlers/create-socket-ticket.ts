import type { GameService } from "../game-service"
import {
  bearerToken,
  handleError,
  json,
  roomIdParameter,
  type HttpEvent,
} from "../shared/http"
import { serviceWithSessions } from "./dependencies"

export function createSocketTicketHandler(service: GameService) {
  return async (event: HttpEvent) => {
    try {
      return json(201, await service.createSocketTicket(
        bearerToken(event),
        roomIdParameter(event),
      ))
    } catch (error) {
      return handleError(error)
    }
  }
}

export const handler = async (event: HttpEvent) =>
  createSocketTicketHandler(serviceWithSessions())(event)
