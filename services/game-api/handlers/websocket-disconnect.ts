/// <reference types="node" />
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DeleteCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb"

interface DisconnectEvent {
  requestContext?: {
    connectionId?: string
  }
}

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} environment variable is required`)
  return value
}

export const handler = async (event: DisconnectEvent) => {
  const connectionId = event.requestContext?.connectionId

  if (!connectionId) {
    return { statusCode: 400 }
  }

  try {
    await documentClient.send(new DeleteCommand({
      TableName: requiredEnvironment("CONNECTIONS_TABLE_NAME"),
      Key: { connectionId },
    }))

    return { statusCode: 200 }
  } catch (error) {
    console.error(error)
    return { statusCode: 500 }
  }
}