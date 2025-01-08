import { Client, TextChannel } from "discord.js"
import { dbConnect } from "../common/db/connect"
import { LoungeQueue } from "../types/db"
import { makeRooms, updateLoungeQueueMessage } from "../common/messageHelpers"
import { closeQueue } from "../common/core"

export async function closeQueues(client: Client) {
    // do not close all queues at once then run the for loop because a discord error would
    // cause the queue to close without making the rooms
    const queuesToClose = await findQueuesToClose()
    for (let queue of queuesToClose) {
        const channel = await client.channels.fetch(queue.channelId)
        if (!(channel instanceof TextChannel))
            continue
        const message = await channel.messages.fetch(queue.messageId).catch(e => {
            console.error(`closeQueues.ts closeQueues() failed to fetch message ${queue.messageId} ${e}`)
            if (`${e}`.includes('DiscordAPIError: Unknown Message')) {
                closeQueue(queue.messageId).catch(e => console.error(`closeQueues.ts failed to close unknown message ${queue.messageId} ${e}`))
            }
        })
        if (!message)
            continue

        await closeQueue(message.id)
        await updateLoungeQueueMessage(message, false)
        await makeRooms(message)
    }
}

async function findQueuesToClose() {
    const now = Date.now()
    return await dbConnect(async db => {
        return await db.fetchAll<LoungeQueue>("SELECT * FROM loungeQueue WHERE endTime <= ? AND active = 1", [now])
    })
}