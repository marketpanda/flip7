import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb"
import type { RoomItem } from "./room-item"
import type { SessionItem } from "../shared/models"

export class ConditionalWriteError extends Error {}

export interface GameRepository {
  getSession(sessionHash: string): Promise<SessionItem | undefined>
  putSession(item: SessionItem): Promise<void>
  getRoom(roomId: string): Promise<RoomItem | undefined>
  createRoom(item: RoomItem): Promise<void>
  saveRoom(item: RoomItem, expectedVersion: number): Promise<void>
}

export class DynamoGameRepository implements GameRepository {
  private readonly client: DynamoDBDocumentClient

  constructor(
    private readonly sessionsTableName: string,
    private readonly roomsTableName?: string,
    client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
  ) {
    this.client = client
  }

  async getSession(sessionHash: string): Promise<SessionItem | undefined> {
    const result = await this.client.send(new GetCommand({
      TableName: this.sessionsTableName,
      Key: { sessionHash },
    }))
    return result.Item as SessionItem | undefined
  }

  async putSession(item: SessionItem): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.sessionsTableName,
      Item: item,
      ConditionExpression: "attribute_not_exists(sessionHash)",
    }))
  }

  async getRoom(roomId: string): Promise<RoomItem | undefined> {
    const result = await this.client.send(new GetCommand({
      TableName: this.requireRoomsTable(),
      Key: { roomId },
    }))
    return result.Item as RoomItem | undefined
  }

  async createRoom(item: RoomItem): Promise<void> {
    try {
      await this.client.send(new PutCommand({
        TableName: this.requireRoomsTable(),
        Item: item,
        ConditionExpression: "attribute_not_exists(roomId)",
      }))
    } catch (error) {
      if (isConditionalFailure(error)) throw new ConditionalWriteError()
      throw error
    }
  }

  async saveRoom(item: RoomItem, expectedVersion: number): Promise<void> {
    try {
      await this.client.send(new UpdateCommand({
        TableName: this.requireRoomsTable(),
        Key: { roomId: item.roomId },
        UpdateExpression: "SET #version = :version, #status = :status, hostPlayerId = :hostPlayerId, members = :members, game = :game, processedCommandIds = :commands, expiresAt = :expiresAt",
        ConditionExpression: "#version = :expectedVersion",
        ExpressionAttributeNames: {
          "#version": "version",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":version": item.version,
          ":status": item.status,
          ":hostPlayerId": item.hostPlayerId,
          ":members": item.members,
          ":game": item.game,
          ":commands": item.processedCommandIds,
          ":expiresAt": item.expiresAt,
          ":expectedVersion": expectedVersion,
        },
      }))
    } catch (error) {
      if (isConditionalFailure(error)) throw new ConditionalWriteError()
      throw error
    }
  }

  private requireRoomsTable(): string {
    if (!this.roomsTableName) throw new Error("ROOMS_TABLE_NAME is required")
    return this.roomsTableName
  }
}

function isConditionalFailure(error: unknown): boolean {
  return error instanceof Error && error.name === "ConditionalCheckFailedException"
}
