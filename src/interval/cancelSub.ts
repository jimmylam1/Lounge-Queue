import { Client, ThreadChannel } from "discord.js"
import { dbConnect } from "../common/db/connect"
import { Subs } from "../types/db"
import { getTextChannel } from "../common/discordHelpers"
import { deleteLookingForSubMessage } from "../common/messageHelpers"
import { getConfig, removeSubRowFromDb } from "../common/dbHelpers"

export async function cancelSubs(client: Client) {
    const subs = await findSubsToCancel()

    for (let sub of subs) {
        try {
            const channel = await getTextChannel(client, sub.lookingChannelId)
            let deleteRow = true
            const successStatus = await deleteLookingForSubMessage(channel, sub.id).catch(e => {
                console.error(`(interval) cancelSub.ts deleteLookingForSubMessage() failed ${e}`)
                deleteRow = `${e}`.includes('DiscordAPIError: Unknown Message')
            })
            if (!successStatus)
                console.error(`(interval) cancelSub.ts deleteLookingForSubMessage sub.id ${sub.id} failed to delete message ${sub.lookingMessageId}`)

            await editOriginalMessageAsCancelled(client, sub).catch(e => console.error(`(interval) cancelSub.ts editOriginalMessageAsCancelled() failed`, e))

            if (deleteRow)
                await removeSubRowFromDb(sub.id)
        }
        catch(e) {
            console.error(`(interval) cancelSub.ts failed`, e)
        }
    }
}

async function findSubsToCancel() {
    const now = Date.now()
    return await dbConnect(async db => {
        return await db.fetchAll<Subs>("SELECT * FROM subs WHERE expires <= ?", [now])
    })
}

async function editOriginalMessageAsCancelled(client: Client, sub: Subs) {
    const channel = await client.channels.fetch(sub.roomChannelId)
    if (!(channel instanceof ThreadChannel))
        throw new Error(`(interval) cancelSub.ts editOriginalMessageAsCancelled() channel ${sub.roomChannelId} is not a thread channel`)
    if (!sub.initMessageId)
        throw new Error(`(interval) cancelSub.ts editOriginalMessageAsCancelled() sub.initMessageId is null`)

    // edit the original message from the slash command
    const message = await channel.messages.fetch(sub.initMessageId)
    await message.edit({content: `Cancelled looking for a sub for ${sub.playerName || 'the player'}`, components: []})
    
    // send failed to find sub message to the channel
    const config = await getConfig(channel.guildId)
    const time = config?.subMinutes ? `${config.subMinutes} minutes` : 'the time limit'
    await message.reply(`Failed to find a sub for ${sub.playerName} within ${time}`)
}