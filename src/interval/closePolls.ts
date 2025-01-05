import { Client, ThreadChannel } from "discord.js";
import { dbConnect } from "../common/db/connect";
import { closePoll } from "../common/messageHelpers";
import { Rooms } from "../types/db";

const channelsToIgnore = new Set<string>()
export async function closePolls(client: Client) {
    const pollsToClose = await findPollsToClose()
    for (let room of pollsToClose) {
        if (channelsToIgnore.has(room.roomChannelId))
            continue
        const channel = await client.channels.fetch(room.roomChannelId)
        if (!(channel instanceof ThreadChannel) || !room.pollMessageId)
            continue
        const message = await channel.messages.fetch(room.pollMessageId).catch(e => {
            console.error(`closePolls.ts closePolls() failed to fetch message ${room.pollMessageId} ${e}`)
            if (`${e}`.includes('DiscordAPIError: Unknown Message'))
                channelsToIgnore.add(room.roomChannelId)
        })
        if (!message)
            continue
        await closePoll(message)
    }
}

async function findPollsToClose() {
    const now = Date.now()
    return await dbConnect(async db => {
        return await db.fetchAll<Rooms>("SELECT * FROM rooms WHERE createdAt < ? AND scoreboard IS NULL", [now - 120000])
    })
}