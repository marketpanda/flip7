import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb"

interface BroadcastEvent {
  roomId: string
  room: unknown
}

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} environment variable is required`)
  return value
}

export const handler = async (event: BroadcastEvent) => {
  if (!event.roomId || !event.room) {
    throw new Error("roomId and room are required")
  }

  const tableName = requiredEnvironment("CONNECTIONS_TABLE_NAME")
  const indexName = requiredEnvironment("CONNECTIONS_INDEX_NAME")
  const callbackUrl = requiredEnvironment("WEBSOCKET_CALLBACK_URL")

  const managementClient = new ApiGatewayManagementApiClient({
    endpoint: callbackUrl,
  })

  const message = Buffer.from(JSON.stringify({
    type: "room.updated",
    roomId: event.roomId,
    room: event.room,
  }))

  let exclusiveStartKey: QueryCommandInput["ExclusiveStartKey"]
  let delivered = 0
  let removed = 0

  do {
    const result = await documentClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: indexName,
      KeyConditionExpression: "roomId = :roomId",
      ExpressionAttributeValues: {
        ":roomId": event.roomId,
      },
      ExclusiveStartKey: exclusiveStartKey,
    }))

    for (const item of result.Items ?? []) {
      if (typeof item.connectionId !== "string") continue

      try {
        await managementClient.send(new PostToConnectionCommand({
          ConnectionId: item.connectionId,
          Data: message,
        }))

        delivered += 1
      } catch (error) {
        if (
          error instanceof GoneException ||
          (error instanceof Error && error.name === "GoneException")
        ) {
          await documentClient.send(new DeleteCommand({
            TableName: tableName,
            Key: {
              connectionId: item.connectionId,
            },
          }))

          removed += 1
          continue
        }

        console.error("Failed to notify connection", item.connectionId, error)
      }
    }

    exclusiveStartKey = result.LastEvaluatedKey
  } while (exclusiveStartKey)

  return {
    delivered,
    removed,
  }
}