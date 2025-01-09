import dotenv from "dotenv";
import { ApplicationCommandData, CommandInteraction, Constants, GuildMember } from "discord.js";
import { slashCommandEvent } from "../../common/discordEvents";
import { reply } from "../../common/util";
import { checkQueueMessageLink, fetchLoungeQueueMessageFromLink, updateLoungeQueueMessage } from "../../common/messageHelpers";
import { canManageLoungeQueue } from "../../common/permissions";
import { closeQueue } from "../../common/core";
import { fetchQueueFromDb } from "../../common/dbHelpers";
dotenv.config()

export const data: ApplicationCommandData= {
    name: "close",
    description: "Close the latest queue in this channel",
    options: [
        {
            name: "message-link",
            description: "The message link to the queue, if not the latest",
            type: Constants.ApplicationCommandOptionTypes.STRING,
        },
    ]
}

slashCommandEvent.on(data.name, async (interaction) => {
    handleClose(interaction).catch(e => console.error(`close.ts handleClose()`, e))
})

async function handleClose(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply({ephemeral: true})
    
    const messageLink = await checkQueueMessageLink(interaction)
    if (messageLink === null)
        return reply(interaction, `Unable to automatically fetch the latest queue in this channel. You will need to include the \`message-link\` option with this command.`)
    const {message, errorMessage} = await fetchLoungeQueueMessageFromLink(interaction, messageLink)
    if (!message)
        return reply(interaction, errorMessage)

    const queue = await fetchQueueFromDb(message.id)
    if (!queue)
        return await reply(interaction, `There was a problem fetching the queue`)
    if (!queue.active)
        return await reply(interaction, `The queue is already closed.`)

    await closeQueue(message.id)
    await updateLoungeQueueMessage(message, false)
    reply(interaction, `Successfully closed the queue`)
}
