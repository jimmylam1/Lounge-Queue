import { Client, ThreadChannel } from "discord.js";
import { findPollsToClose } from "../interval/loungeQueue";
import { closePoll } from "../common/messageHelpers";

export function runInterval(client: Client) {
    setInterval(() => {
        closePolls(client).catch(e => console.error(`interval.ts closePolls() failed ${e}`))
    }, 10000);
}

const channelsToIgnore = new Set<string>()
async function closePolls(client: Client) {
    const pollsToClose = await findPollsToClose()
    for (let room of pollsToClose) {
        if (channelsToIgnore.has(room.roomChannelId))
            continue
        const channel = await client.channels.fetch(room.roomChannelId)
        if (!(channel instanceof ThreadChannel) || !room.pollMessageId)
            continue
        const message = await channel.messages.fetch(room.pollMessageId).catch(e => {
            console.error(`interval.ts closePolls() failed to fetch message ${e}`)
            if (`${e}`.includes('DiscordAPIError: Unknown Message'))
                channelsToIgnore.add(room.roomChannelId)
        })
        if (!message)
            continue
        await closePoll(message)
    }
}