import { ApplicationCommandData, CommandInteraction, Constants, GuildMember, TextChannel } from "discord.js";
import { slashCommandEvent } from "../../common/discordEvents";
import { reply } from "../../common/util";
import { fetchLoungeQueueMessageFromLink, makeRooms, updateLoungeQueueMessage } from "../../common/messageHelpers";
import { canManageLoungeQueue } from "../../common/permissions";
import { closeQueue } from "../../common/core";
import { fetchQueueFromDb } from "../../common/dbHelpers";

export const data: ApplicationCommandData= {
    name: "make-rooms",
    description: "Close a queue and create the rooms",
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
    handleMakeRooms(interaction).catch(e => {
        console.error(`makeRooms.ts handleMakeRooms()`, e)
        reply(interaction, `There was a problem making the rooms`).catch(e => console.error(`makeRooms() failed to reply ${e}`))
    })
})

async function handleMakeRooms(interaction: CommandInteraction) {
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
        return await reply(interaction, `Rooms cannot be made because the queue has been cancelled.`)
    if (queue.madeRooms)
        return await reply(interaction, `Rooms cannot be made bacause rooms have already been created.`)

    await closeQueue(message.id)
    await updateLoungeQueueMessage(message, false)

    if (!message.guild) {
        await reply(interaction, 'The guild for the provided message is unavailable')
        return
    }
    if (!(message.channel instanceof TextChannel)) {
        await reply(interaction, 'The message channel must be a regular text channel. Make sure it is not a thread channel.')
        return
    }

    await makeRooms(message)

    reply(interaction, `Done`)
}
