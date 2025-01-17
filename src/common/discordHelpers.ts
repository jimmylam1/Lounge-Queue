import { Client, TextChannel } from "discord.js"

export async function getTextChannel(client: Client, channelId: string) {
    const channel = await client.channels.fetch(channelId)
    if (!(channel instanceof TextChannel))
        throw new Error(`sub.ts deleteLookingForSubMessage() Channel ${channel?.id} is not a text channel`)
    return channel
}