import {
  InvokeCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda"

export type RoomBroadcaster = (
  roomId: string,
  room: unknown,
) => Promise<void>

const lambdaClient = new LambdaClient({})

export async function invokeRoomBroadcaster(
  roomId: string,
  room: unknown,
): Promise<void> {
  const functionName = process.env.BROADCAST_FUNCTION_NAME

  if (!functionName) {
    throw new Error("BROADCAST_FUNCTION_NAME is required")
  }

  await lambdaClient.send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: "Event",
    Payload: Buffer.from(JSON.stringify({
      roomId,
      room,
    })),
  }))
}

export const noBroadcast: RoomBroadcaster = async () => {}
