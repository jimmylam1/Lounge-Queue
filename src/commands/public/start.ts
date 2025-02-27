import { ApplicationCommandData, AutocompleteInteraction, CommandInteraction, Constants, GuildMember, TextChannel } from "discord.js";
import { autocompleteEvent, slashCommandEvent } from "../../common/discordEvents";
import { isFormatOption, reply } from "../../common/util";
import { guildConfig } from "../../common/data/guildConfig";
import { autoCloseChoices, createLoungeQueue } from "../../common/messageHelpers";
import { canManageLoungeQueue } from "../../common/permissions";
import { getActiveQueuesInChannel } from "../../common/dbHelpers";

export const data: ApplicationCommandData = {
    name: "start",
    description: "Start a new Lounge Queue",
    options: [
        {
            name: "format",
            description: "Optionally specify the format. Leave blank to use a poll instead",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            autocomplete: true,
        },
        {
            name: "auto-close",
            description: "Optionally allow bot to close polling and make rooms after set minutes",
            type: Constants.ApplicationCommandOptionTypes.INTEGER,
            choices: autoCloseChoices(true)
        },
    ]
}

autocompleteEvent.on(data.name, async (interaction) => {
    const name = interaction.options.getFocused(true).name;
    if (name === 'format')
        autocompleteFormat(interaction).catch(e => console.error(`start.ts autocompleteFormat()`, e))
})

slashCommandEvent.on(data.name, async (interaction) => {
    handleStart(interaction).catch(e => console.error(`start.ts handleStart()`, e))
})

async function autocompleteFormat(interaction: AutocompleteInteraction) {
    const userInput = interaction.options.getFocused(true).value
    const choices: string[] = guildConfig[interaction.guild!.id].formats
    const mapped = choices.map(i => ({name: i, value: i}))
    mapped.unshift({name: 'Use poll (Default)', value: ''})
    await interaction.respond(mapped.filter(i => i.name.startsWith(userInput)))
}

async function handleStart(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply({ephemeral: true})
    console.log(`${interaction.member.displayName} started a new queue`)

    if (!(interaction.channel instanceof TextChannel)) {
        await reply(interaction, 'The text channel must be a regular text channel. Make sure it is not a thread channel.')
        return
    }

    const _format = interaction.options.getString("format")
    const autoClose = interaction.options.getInteger('auto-close')
    const format = (_format && isFormatOption(_format)) ? _format : undefined
    if (_format && !format)
        return reply(interaction, `Unknown format ${_format}. Valid formats: ${guildConfig[interaction.guild!.id].formats.join(", ")}`)

    const activeQueues = await getActiveQueuesInChannel(interaction.channel.id)
    if (activeQueues.length > 0) {
        const q = activeQueues[0]
        const link = `https://discord.com/channels/${q.guildId}/${q.channelId}/${q.messageId}`
        return reply(interaction, `⚠️ There is already an active queue in this channel (${link}). You will need to either close, cancel, or make rooms first`)
    }

    const success = await createLoungeQueue(interaction.guild!.id, interaction.channel, autoClose, format)
        .catch(e => console.error(`start.ts handleStart()`, e))
    if (success)
        return reply(interaction, `Successfully started the lounge queue`)
    return reply(interaction, `Failed to start the lounge queue`)
}
