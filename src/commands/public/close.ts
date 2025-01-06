import dotenv from "dotenv";
import { ApplicationCommandData, CommandInteraction, Constants, GuildMember } from "discord.js";
import { slashCommandEvent } from "../../common/discordEvents";
import { reply } from "../../common/util";
import { fetchLoungeQueueMessageFromLink, updateLoungeQueueMessage } from "../../common/messageHelpers";
import { canManageLoungeQueue } from "../../common/permissions";
import { closeQueue } from "../../common/core";
dotenv.config()

export const data: ApplicationCommandData= {
    name: "close",
    description: "Close a queue to prevent people from joining or dropping",
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
    handleClose(interaction).catch(e => console.error(`close.ts handleClose()`, e))
})

async function handleClose(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply({ephemeral: true})
    
    const messageLink = interaction.options.getString("message-link")
    const {message, errorMessage} = await fetchLoungeQueueMessageFromLink(interaction, messageLink)
    if (!message)
        return reply(interaction, errorMessage)

    await closeQueue(message.id)
    await updateLoungeQueueMessage(message, false)
    reply(interaction, `Successfully closed the queue`)
}
