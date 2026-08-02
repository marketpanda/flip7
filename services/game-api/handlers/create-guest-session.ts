import type { GameService } from "../game-service"
import { handleError, json } from "../shared/http"
import { serviceWithSessions } from "./dependencies"

export function createGuestSessionHandler(service: GameService) {
  return async () => {
    try {
      return json(201, await service.createGuestSession())
    } catch (error) {
      return handleError(error)
    }
  }
}

export const handler = async () =>
  createGuestSessionHandler(serviceWithSessions())()
