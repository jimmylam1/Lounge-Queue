import { ApplicationCommandData, CommandInteraction, Constants, GuildMember, TextChannel } from "discord.js";
import { slashCommandEvent } from "../../common/discordEvents";
import { slashReply } from "../../common/util";
import { fetchLoungeQueueMessageFromLink, makeRooms, updateLoungeQueueMessage } from "../../common/messageHelpers";
import { canManageLoungeQueue } from "../../common/permissions";
import { closeQueue } from "../../common/core";

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
        slashReply(interaction, `There was a problem making the rooms`).catch(e => console.error(`makeRooms() failed to reply ${e}`))
    })
})

async function handleMakeRooms(interaction: CommandInteraction) {
    if (!interaction.channel || !interaction.guild || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return slashReply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply({ephemeral: true})
    
    const messageLink = interaction.options.getString("message-link")
    const {message, errorMessage} = await fetchLoungeQueueMessageFromLink(interaction, messageLink)
    if (!message)
        return slashReply(interaction, errorMessage)

    await closeQueue(message.id)
    await updateLoungeQueueMessage(message, false)

    if (!message.guild) {
        await slashReply(interaction, 'The guild for the provided message is unavailable')
        return
    }
    if (!(message.channel instanceof TextChannel)) {
        await slashReply(interaction, 'The message channel must be a regular text channel. Make sure it is not a thread channel.')
        return
    }

    await makeRooms(message)

    slashReply(interaction, `Done`)
}
