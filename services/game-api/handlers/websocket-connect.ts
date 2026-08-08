import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb"
import { hashToken } from "../shared/tokens"

declare const process: {
  env: Record<string, string | undefined>
}

interface ConnectEvent {
  queryStringParameters?: Record<string, string | undefined> | null
  requestContext?: {
    connectionId?: string
  }
}

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const CONNECTION_LIFETIME_SECONDS = 2 * 60 * 60

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} environment variable is required`)
  return value
}

function response(statusCode: number, message?: string) {
  return {
    statusCode,
    ...(message ? { body: JSON.stringify({ message }) } : {}),
  }
}

export const handler = async (event: ConnectEvent) => {
  const ticket = event.queryStringParameters?.ticket
  const connectionId = event.requestContext?.connectionId

  if (!ticket || !connectionId) {
    return response(401, "A valid socket ticket is required.")
  }

  const now = Math.floor(Date.now() / 1000)

  try {
    const consumed = await documentClient.send(new UpdateCommand({
      TableName: requiredEnvironment("SESSIONS_TABLE_NAME"),
      Key: {
        sessionHash: hashToken(ticket),
      },
      UpdateExpression: "SET #consumed = :true",
      ConditionExpression:
        "#itemType = :ticketType AND " +
        "(attribute_not_exists(#consumed) OR #consumed = :false) AND " +
        "#expiresAt > :now",
      ExpressionAttributeNames: {
        "#itemType": "itemType",
        "#consumed": "consumed",
        "#expiresAt": "expiresAt",
      },
      ExpressionAttributeValues: {
        ":ticketType": "socket-ticket",
        ":true": true,
        ":false": false,
        ":now": now,
      },
      ReturnValues: "ALL_NEW",
    }))

    const ticketItem = consumed.Attributes

    if (
      typeof ticketItem?.roomId !== "string" ||
      typeof ticketItem?.playerId !== "string"
    ) {
      return response(401, "The socket ticket is invalid.")
    }

    await documentClient.send(new PutCommand({
      TableName: requiredEnvironment("CONNECTIONS_TABLE_NAME"),
      Item: {
        connectionId,
        roomId: ticketItem.roomId,
        playerId: ticketItem.playerId,
        expiresAt: now + CONNECTION_LIFETIME_SECONDS,
      },
      ConditionExpression: "attribute_not_exists(connectionId)",
    }))

    return response(200)
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "ConditionalCheckFailedException"
    ) {
      return response(401, "The socket ticket is invalid, expired, or consumed.")
    }

    console.error(error)
    return response(500, "Could not establish the connection.")
  }
}