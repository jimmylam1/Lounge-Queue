import { Client, TextChannel } from "discord.js";
import { createLoungeQueue } from "../common/messageHelpers";
import { findNextHour } from "../common/util";

var nextHour = findNextHour()
export async function openExampleLoungeQueue(client: Client) {
    // open example queues every hour
    const now = new Date()
    if (nextHour <= now) {
        nextHour = findNextHour()
        await handle(client).catch(e => console.error(`Failed to create example lounge queue ${e}`))
    }
}

async function handle(client: Client) {
    const channel = await client.channels.fetch('CHANNEL_ID')
    if (!(channel instanceof TextChannel))
        throw new Error(`openExampleLoungeQueue.ts channel is not a TextChannel`)

    // create a new lounge queue that auto closes after one hour, on the hour
    await createLoungeQueue('GUILD_ID', channel, 60, undefined, findNextHour().getTime())
}