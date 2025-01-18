import { Client, TextChannel } from "discord.js"
import { dbConnect } from "../common/db/connect"
import { Config, LoungeQueue } from "../types/db"
import { makeRooms, updateLoungeQueueMessage } from "../common/messageHelpers"
import { closeQueue, getRooms } from "../common/core"
import { getConfig } from "../common/dbHelpers"
import { getTextChannel } from "../common/discordHelpers"
import { guildConfig } from "../common/data/guildConfig"
import { findNext10Seconds } from "../common/util"

export async function closeQueues(client: Client) {
    // do not close all queues at once then run the for loop because a discord error would
    // cause the queue to close without making the rooms
    const queuesToClose = await findQueuesToClose(client)
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

async function findQueuesToClose(client: Client) {
    const now = Date.now()
    const queues = await dbConnect(async db => {
        return await db.fetchAll<LoungeQueue>("SELECT * FROM loungeQueue WHERE endTime <= ? AND active = 1", [now])
    })
    
    const queuesToClose: LoungeQueue[] = []
    for (let queue of queues) {
        const config = await getConfig(queue.guildId)
        if (!config)
            continue

        if (await shouldExtend(config, queue)) {
            await extendQueue(queue.id, config.queuePlusOneExtensionMinutes!)
            await sendPlusOneMessage(client, queue)
        }
        else {
            queuesToClose.push(queue)
        }
    }
    return queuesToClose
}

async function shouldExtend(config: Config, queue: LoungeQueue) {
    if (!config.queuePlusOneExtensionMinutes || queue.extended)
        return false

    const rooms = await getRooms(queue.messageId)
    return rooms.latePlayers.length === guildConfig[queue.guildId].roomSize - 1
}

async function extendQueue(queueId: number, extendMinutes: number) {
    const expiration = findNext10Seconds().getTime() + 60000*extendMinutes
    const res = await dbConnect(async db => {
        return await db.execute("UPDATE loungeQueue SET extended = 1, endTime = ? WHERE id = ?", [expiration, queueId])
    })
    return res
}

async function sendPlusOneMessage(client: Client, queue: LoungeQueue) {
    const config = await getConfig(queue.guildId)
    if (!config)
        throw new Error(`closeQueue.ts sendPlusOneMessage() config for ${queue.guildId} is null`)

    const channel = await getTextChannel(client, queue.channelId)
    const queueMessage = await channel.messages.fetch(queue.messageId)
    const minutes = config.queuePlusOneExtensionMinutes

    const text = `<@&${config.queuePlusOnePingRoleId}> Queue needs 1 more player!\n`
               + `-# Queue will close when someone joins/drops or after ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`

    await queueMessage.reply(text)
}