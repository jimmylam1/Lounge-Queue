import { ApplicationCommandData, CommandInteraction, Constants, GuildMember, TextChannel } from "discord.js";
import { slashCommandEvent } from "../../common/discordEvents";
import { reply } from "../../common/util";
import { fetchLoungeQueueMessageFromLink, updateLoungeQueueMessage } from "../../common/messageHelpers";
import { canManageLoungeQueue } from "../../common/permissions";
import { cancelQueue } from "../../common/core";
import { fetchQueueFromDb } from "../../common/dbHelpers";

export const data: ApplicationCommandData= {
    name: "cancel",
    description: "Cancel a queue",
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
    handleCancel(interaction).catch(e => {
        console.error(`makeRooms.ts handleCancel()`, e)
        reply(interaction, `There was a problem making the rooms`).catch(e => console.error(`makeRooms() failed to reply ${e}`))
    })
})

async function handleCancel(interaction: CommandInteraction) {
    if (!interaction.channel || !interaction.guild || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply({ephemeral: true})
    
    const messageLink = interaction.options.getString("message-link")
    const {message, errorMessage} = await fetchLoungeQueueMessageFromLink(interaction, messageLink)
    if (!message)
        return reply(interaction, errorMessage)

    const queue = await fetchQueueFromDb(message.id)
    if (!queue)
        return await reply(interaction, `There was a problem fetching the queue`)
    if (queue.cancelled)
        return await reply(interaction, `The queue has already been cancelled.`)
    if (queue.madeRooms)
        return await reply(interaction, `This queue cannot be cancelled because rooms have already been created.`)

    await cancelQueue(message.id)
    await updateLoungeQueueMessage(message, false)

    if (!message.guild) {
        await reply(interaction, 'The guild for the provided message is unavailable')
        return
    }
    if (!(message.channel instanceof TextChannel)) {
        await reply(interaction, 'The message channel must be a regular text channel. Make sure it is not a thread channel.')
        return
    }

    await message.reply(`This queue has been cancelled.`)

    reply(interaction, `Done`)
}
