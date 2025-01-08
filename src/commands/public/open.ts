import dotenv from "dotenv";
import { ApplicationCommandData, CommandInteraction, Constants, GuildMember } from "discord.js";
import { slashCommandEvent } from "../../common/discordEvents";
import { reply } from "../../common/util";
import { fetchLoungeQueueMessageFromLink, updateLoungeQueueMessage } from "../../common/messageHelpers";
import { canManageLoungeQueue } from "../../common/permissions";
import { openQueue } from "../../common/core";
import { fetchQueueFromDb, getActiveQueuesInChannel } from "../../common/dbHelpers";
dotenv.config()

export const data: ApplicationCommandData = {
    name: "open",
    description: "Open a queue to allow people to join or drop",
    options: [
        {
            name: "message-link",
            description: "The message link to the queue",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: true
        },
    ]
}

slashCommandEvent.on(data.name, async (interaction) => {
    handleOpen(interaction).catch(e => console.error(`open.ts handleOpen()`, e))
})

async function handleOpen(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return await reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply({ephemeral: true})
    
    const messageLink = interaction.options.getString("message-link")
    const {message, errorMessage} = await fetchLoungeQueueMessageFromLink(interaction, messageLink)
    if (!message)
        return await reply(interaction, errorMessage)

    const queue = await fetchQueueFromDb(message.id)
    if (!queue)
        return await reply(interaction, `There was a problem fetching the queue`)
    if (queue.cancelled)
        return await reply(interaction, `This queue cannot be opened because it has been cancelled.`)
    if (queue.madeRooms)
        return await reply(interaction, `This queue cannot be opened because rooms have already been created.`)
    
    const activeQueues = await getActiveQueuesInChannel(interaction.channel.id)
    if (activeQueues.length > 0) {
        const q = activeQueues[0]
        const link = `https://discord.com/channels/${q.guildId}/${q.channelId}/${q.messageId}`
        return reply(interaction, `⚠️ There is already an active queue in this channel (${link}). You will need to either close, cancel, or make rooms first`)
    }

    await openQueue(message.id)
    await updateLoungeQueueMessage(message, true)
    await reply(interaction, `Successfully opened the queue`)
}

