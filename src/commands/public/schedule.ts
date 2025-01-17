import { ApplicationCommandData, AutocompleteInteraction, CommandInteraction, Constants, GuildMember } from "discord.js";
import { autoCloseChoices } from "../../common/messageHelpers";
import { autocompleteEvent, slashCommandEvent } from "../../common/discordEvents";
import { guildConfig } from "../../common/data/guildConfig";
import { canManageLoungeQueue } from "../../common/permissions";
import { reply } from "../../common/util";
import { dbConnect } from "../../common/db/connect";
import * as chrono from 'chrono-node'
import { getConfig } from "../../common/dbHelpers";
import { Schedule } from "../../types/db";

export const data: ApplicationCommandData = {
    name: "schedule",
    description: "Manage when new Lounge Queue events should be opened automatically",
    options: [
        {
            name: "add",
            description: "Add when a queue should automatically open",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
            options: [
                {
                    name: "open-time",
                    description: "When the queue should open. Example: 'Monday 12pm pt'",
                    type: Constants.ApplicationCommandOptionTypes.STRING,
                    required: true
                },
                {
                    name: "auto-close",
                    description: "The number of minutes until the queue closes.",
                    type: Constants.ApplicationCommandOptionTypes.INTEGER,
                    choices: autoCloseChoices(false),
                    required: true
                },
                {
                    name: "format",
                    description: "Optionally specify the format. Leave blank to use a poll instead",
                    type: Constants.ApplicationCommandOptionTypes.STRING,
                    autocomplete: true,
                },
            ],
        },
        {
            name: "remove",
            description: "Remove a scheduled time",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
            options: [
                {
                    name: "open-time",
                    description: "The queue's open time. Example: 'Monday 12pm pt'",
                    type: Constants.ApplicationCommandOptionTypes.STRING,
                    required: true
                },
            ],
        },
        {
            name: "list",
            description: "List the scheduled queues",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
        },
    ]
}

autocompleteEvent.on(data.name, async (interaction) => {
    const name = interaction.options.getFocused(true).name;
    if (name === 'format')
        autocompleteFormat(interaction).catch(e => console.error(`schedule.ts autocompleteFormat()`, e))
})

slashCommandEvent.on(data.name, async (interaction) => {
    if (interaction.options.getSubcommand() == "add")
        handleAdd(interaction).catch(e => console.error(`schedule.ts handleAdd()`, e))
    else if (interaction.options.getSubcommand() == "remove")
        handleRemove(interaction).catch(e => console.error(`schedule.ts handleRemove()`, e))
    else if (interaction.options.getSubcommand() == "list")
        handleList(interaction).catch(e => console.error(`schedule.ts handleList()`, e))
})

async function autocompleteFormat(interaction: AutocompleteInteraction) {
    const userInput = interaction.options.getFocused(true).value
    const choices: string[] = guildConfig[interaction.guild!.id].formats
    const mapped = choices.map(i => ({name: i, value: i}))
    mapped.unshift({name: 'Use poll (Default)', value: ''})
    await interaction.respond(mapped.filter(i => i.name.startsWith(userInput)))
}

async function handleAdd(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply()

    const config = await getConfig(interaction.guild!.id)
    if (!config?.joinChannelId)
        return reply(interaction, `The config joinChannelId is not set. Use /config to set it before using this command`)

    const openTime = interaction.options.getString("open-time")
    const autoClose = interaction.options.getInteger("auto-close")
    const format = interaction.options.getString("format")
    console.log(`${interaction.member.displayName} used /schedule openTime=${openTime} autoClose=${autoClose} format=${format}`)

    const parsedOpenTime = chrono.parseDate(openTime!, {}, {forwardDate: true})
    if (!parsedOpenTime) {
        console.error(`schedule.ts parsedOpenTime failed to parse: ${openTime}`)
        return reply(interaction, `Failed to parse the date ${openTime}`)
    }
    const startTime = parsedOpenTime.getTime()
    if (startTime < Date.now())
        return reply(interaction, `❌ The time <t:${Math.floor(startTime / 1000)}:F> is in the past`)

    const endTime = startTime + 60000*autoClose!
    const t = (time: number) => Math.floor(time / 1000)
    const overlap = await findOverlap(interaction.guild!.id, startTime, endTime)
    if (overlap)
        return reply(interaction, `The already scheduled queue <t:${t(overlap.startTime)}:D> <t:${t(overlap.startTime)}:t> - <t:${t(overlap.startTime)}:t> overlaps with <t:${t(startTime)}:t> - <t:${t(endTime)}:t>`)

    const res = await addSchedule(interaction.guild!.id, startTime, endTime, format).catch(e => console.error(`schedule.ts addSchedule`, e))
    if (!res?.changes) {
        console.error(`schedule.ts handleAdd() failed to insert data. guild=${interaction.guild!.id} openTime=${openTime} autoClose=${autoClose} format=${format}`)
        return reply(interaction, `There was a problem adding the schedule. This can happen if there is already a schedule starting at the same time.`)
    }

    const start = Math.floor(startTime / 1000)
    const end = Math.floor(endTime / 1000)
    reply(interaction, `Successfully added: **${format || 'Poll'}**: <t:${start}:f> - <t:${start}:R> - Start at <t:${end}:t>`)
}

async function handleRemove(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply()

    const openTime = interaction.options.getString("open-time")

    const parsedOpenTime = chrono.parseDate(openTime!, {}, {forwardDate: true})
    if (!parsedOpenTime)
        return reply(interaction, `Failed to parse the date ${openTime}`)

    const res = await removeQueueSchedule(interaction.guild!.id, parsedOpenTime.getTime()).catch(e => console.error(`schedule.ts removeQueueSchedule`, e))
    if (!res?.changes) {
        console.error(`schedule.ts handleRemove() failed to delete data. guild=${interaction.guild!.id} openTime=${openTime}`)
        return reply(interaction, `Unable to find the schedule. Make sure you include a timezone, like pt or utc`)
    }

    let text = "Successfully removed the scheduled queue.\n\nQueue list"
    text += await listSchedules(interaction.guild!.id)
    reply(interaction, text)
}

async function handleList(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply()

    const text = await listSchedules(interaction.guild!.id) || 'There are no schedules to list'
    reply(interaction, text)
}

async function addSchedule(guildId: string, openTime: number, closeTime: number, format: string | null) {
    return await dbConnect(async db => {
        return await db.execute("INSERT INTO schedule (guildId, startTime, endTime, format) VALUES (?, ?, ?, ?)", [guildId, openTime, closeTime, format])
    })
}

async function removeQueueSchedule(guildId: string, startTime: number) {
    return await dbConnect(async db => {
        return await db.execute("DELETE FROM schedule WHERE guildId = ? AND startTime = ?", [guildId, startTime])
    })  
}

async function listSchedules(guildId: string) {
    const schedules = await dbConnect(async db => {
        return await db.fetchAll<Schedule>("SELECT * FROM schedule WHERE guildId = ? ORDER BY startTime ASC", [guildId])
    })
    let text = ''
    for (let i = 0; i < schedules.length; i++) {
        const s = schedules[i]
        const startTime = Math.floor(s.startTime/1000)
        const endTime = Math.floor(s.endTime/1000)
        text += `\`#${i+1}\` **${s.format || 'Poll'}**: <t:${startTime}:f> - <t:${startTime}:R> - Start at <t:${endTime}:t>\n`
    }
    return text
}

async function findOverlap(guildId: string, startTime: number, endTime: number) {
    function dateRangeOverlaps(a_start: number, a_end: number, b_start: number, b_end: number) {
        // https://stackoverflow.com/questions/22784883/check-if-more-than-two-date-ranges-overlap
        if (a_start <= b_start && b_start <= a_end) return true; // b starts in a
        if (a_start <= b_end   && b_end   <= a_end) return true; // b ends in a
        if (b_start <  a_start && a_end   <  b_end) return true; // a in b
        return false;
    }
    const schedules = await dbConnect(async db => {
        return await db.fetchAll<Schedule>("SELECT * FROM schedule WHERE guildId = ? ORDER BY startTime ASC", [guildId])
    })

    for (let s of schedules) {
        if (dateRangeOverlaps(startTime, endTime, s.startTime, s.endTime))
            return s
    }
    return null
}