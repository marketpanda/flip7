import { GameService } from "../game-service"
import { DynamoGameRepository } from "../persistence/repository"

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} environment variable is required`)
  return value
}

export function serviceWithSessions(): GameService {
  return new GameService(new DynamoGameRepository(
    requiredEnvironment("SESSIONS_TABLE_NAME"),
  ))
}

export function serviceWithRooms(): GameService {
  return new GameService(new DynamoGameRepository(
    requiredEnvironment("SESSIONS_TABLE_NAME"),
    requiredEnvironment("ROOMS_TABLE_NAME"),
  ))
}
