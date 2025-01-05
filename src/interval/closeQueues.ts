import { Client, TextChannel } from "discord.js"
import { dbConnect } from "../common/db/connect"
import { LoungeQueue } from "../types/db"
import { makeRooms, updateLoungeQueueMessage } from "../common/messageHelpers"
import { closeQueue } from "../common/core"

const queuesToIgnore = new Set<string>()
export async function closeQueues(client: Client) {
    const queuesToClose = await findQueuesToClose()
    for (let queue of queuesToClose) {
        if (queuesToIgnore.has(queue.messageId))
            continue
        const channel = await client.channels.fetch(queue.channelId)
        if (!(channel instanceof TextChannel))
            continue
        const message = await channel.messages.fetch(queue.messageId).catch(e => {
            console.error(`closeQueues.ts closeQueues() failed to fetch message ${queue.messageId} ${e}`)
            if (`${e}`.includes('DiscordAPIError: Unknown Message'))
                queuesToIgnore.add(queue.messageId)
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
        return await db.fetchAll<LoungeQueue>("SELECT * FROM loungeQueue WHERE endTime <= ? AND active = 1", [now + 10000]) // +10 seconds to better handle potential time drifts
    })
}