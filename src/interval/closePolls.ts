import { Client, ThreadChannel } from "discord.js";
import { dbConnect } from "../common/db/connect";
import { closePoll } from "../common/messageHelpers";
import { Rooms } from "../types/db";

export async function closePolls(client: Client) {
    const pollsToClose = await findPollsToClose()
    const changes: string[] = []
    for (let room of pollsToClose) {
        try {
            const channel = await client.channels.fetch(room.roomChannelId)
            if (!(channel instanceof ThreadChannel) || !room.pollMessageId)
                continue
            const message = await channel.messages.fetch(room.pollMessageId).catch(e => {
                console.error(`closePolls.ts closePolls() failed to fetch message ${room.pollMessageId} ${e}`)
                if (`${e}`.includes('DiscordAPIError: Unknown Message')) {
                    changes.push(room.roomChannelId)
                }
            })
            if (!message)
                continue
            const success = await closePoll(message)
            if (success)
                changes.push(room.roomChannelId)
        }
        catch(e) {
            console.error(`closePolls.ts error closing the poll for room ${room.roomChannelId}`)
        }
    }
    if (changes.length)
        await deletePollMessageIdFromRooms(changes).catch(e => console.error(`closePolls.ts deletePollMessageIdFromRooms() failed ${e}`))
}

async function findPollsToClose() {
    const now = Date.now()
    return await dbConnect(async db => {
        return await db.fetchAll<Rooms>("SELECT * FROM rooms WHERE createdAt < ? AND pollMessageId IS NOT NULL", [now - 120000])
    })
}

async function deletePollMessageIdFromRooms(roomChannelIds: string[]) {
    let query = "UPDATE rooms SET pollMessageId = null WHERE"
    const whereClause = roomChannelIds.map(i => "roomChannelId = ?")
    return await dbConnect(async db => {
        return await db.execute(`${query} ${whereClause.join(" OR ")}`, roomChannelIds)
    })
    // don't delete the votes, want to keep them around for at least 24 hours. handled by deleteOldRowsAndRooms() in interval.ts
}