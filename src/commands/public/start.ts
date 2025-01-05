import { ApplicationCommandData, ApplicationCommandOptionChoiceData, AutocompleteInteraction, CommandInteraction, Constants, GuildMember, TextChannel } from "discord.js";
import { autocompleteEvent, slashCommandEvent } from "../../common/discordEvents";
import { slashReply } from "../../common/util";
import { guildConfig } from "../../common/data/guildConfig";
import { createLoungeQueue } from "../../common/messageHelpers";
import { canManageLoungeQueue } from "../../common/permissions";

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
            choices: autoCloseChoices()
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

function autoCloseChoices() {
    const choices: ApplicationCommandOptionChoiceData[] = [{name: 'None (Default)', value: 0}]
    for (let i = 30; i <= 120; i += 15) {
        if (i >= 60) {
            const hours = Math.floor(i/60)
            const minutes = i % 60
            let name = `${hours} hours`
            if (minutes)
                name += ` ${minutes} minutes`
            choices.push({name, value: i})
        }
        else
            choices.push({name: `${i} minutes`, value: i})
    }
    return choices
}

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
        return slashReply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply({ephemeral: true})

    if (!(interaction.channel instanceof TextChannel)) {
        await slashReply(interaction, 'The text channel must be a regular text channel. Make sure it is not a thread channel.')
        return
    }

    const format = interaction.options.getString("format")
    const autoClose = interaction.options.getInteger('auto-close')

    // @ts-ignore
    const success = await createLoungeQueue(interaction.guild!.id, interaction.channel, autoClose, format)
        .catch(e => console.error(`start.ts handleStart()`, e))
    if (success)
        return slashReply(interaction, `Successfully started the lounge queue`)
    return slashReply(interaction, `Failed to start the lounge queue`)
}
