import { Client, TextChannel } from "discord.js";
import { createLoungeQueue } from "../common/messageHelpers";
import { dbConnect } from "../common/db/connect";
import { Schedule } from "../types/db";
import { getConfig } from "../common/dbHelpers";

export async function openScheduledQueues(client: Client) {
    const schedules = await schedulesToOpen()
    for (let s of schedules) {
        try {
            const config = await getConfig(s.guildId)
            if (!config?.joinChannelId) {
                console.error(`(interval) schedule.ts config for guild ${s.guildId} missing joinChannelId`)
                continue
            }
            
            const channel = await client.channels.fetch(config.joinChannelId)
            if (!(channel instanceof TextChannel))
                throw new Error(`(interval) schedule.ts channel is not a TextChannel`)
    
            await createLoungeQueue(config.guildId, channel, null, s.format || undefined, s.endTime)
        }
        catch(e) {
            console.error(`(interval) schedule.ts create queue failed`, e)
        }

        await dbConnect(async db => {
            return await db.execute("DELETE FROM schedule WHERE guildId = ? AND startTime = ?", [s.guildId, s.startTime])
        })  
    }
}

async function schedulesToOpen() {
    return await dbConnect(async db => {
        return await db.fetchAll<Schedule>("SELECT * FROM schedule WHERE startTime <= ?", [Date.now()])
    })  
}