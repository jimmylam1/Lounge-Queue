import { ApplicationCommandData, AutocompleteInteraction, ButtonInteraction, CommandInteraction, Constants, GuildMember, InteractionReplyOptions, Message, MessageActionRow, MessageButton, MessageEmbedOptions } from "discord.js";
import { autoCloseChoices, updateStickyScheduleMessage } from "../../common/messageHelpers";
import { autocompleteEvent, buttonEvent, slashCommandEvent } from "../../common/discordEvents";
import { guildConfig } from "../../common/data/guildConfig";
import { canManageLoungeQueue } from "../../common/permissions";
import { reply, replyToButton, splitText } from "../../common/util";
import { dbConnect } from "../../common/db/connect";
import * as chrono from 'chrono-node'
import { getConfig } from "../../common/dbHelpers";
import { Schedule, StickySchedule } from "../../types/db";
import { fetchSchedulesFromSheet } from "../../common/spreadsheet";
import { ScheduleRow } from "../../types/spreadsheet";
import { listSchedules } from "../../common/textFormatters";

export const data: ApplicationCommandData = {
    name: "schedule",
    description: "Manage when new Lounge Queue events should be opened automatically",
    options: [
        {
            name: "add",
            description: "Add when a queue should auto open",
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
            name: "add-from-spreadsheet",
            description: "Add queues from Google Sheets",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
        },
        {
            name: "remove-one",
            description: "Remove a scheduled queue",
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
            name: "remove-all",
            description: "Remove all scheduled queues",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
        },
        {
            name: "list",
            description: "List the scheduled queues",
            type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
        },
        {
            name: "sticky-schedule",
            description: "List up to the next 20 scheduled queues. Will auto update msg",
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
    else if (interaction.options.getSubcommand() == "add-from-spreadsheet")
        handleAddFromSpreadsheet(interaction).catch(e => console.error(`schedule.ts handleAddFromSpreadsheet()`, e))
    else if (interaction.options.getSubcommand() == "remove-one")
        handleRemove(interaction).catch(e => console.error(`schedule.ts handleRemove()`, e))
    else if (interaction.options.getSubcommand() == "remove-all")
        handleRemoveAll(interaction).catch(e => console.error(`schedule.ts handleRemoveAll()`, e))
    else if (interaction.options.getSubcommand() == "list")
        handleList(interaction).catch(e => console.error(`schedule.ts handleList()`, e))
    else if (interaction.options.getSubcommand() == "sticky-schedule")
        handleStickySchedule(interaction).catch(e => console.error(`schedule.ts handleStickySchedule()`, e))
})

buttonEvent.on(data.name, async (interaction) => {
    const args = interaction.customId.split("|")
    if (args[1] === 'add')
        handleButtonAdd(interaction).catch(e => console.error(`schedule.ts handleButtonAdd()`, e))
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
    updateStickyScheduleMessage(interaction.client, interaction.guildId!)
}

var addFromSpreadsheetCache: {[key:string]: ScheduleRow[]} = {}
async function handleAddFromSpreadsheet(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply({ephemeral: true})

    const config = await getConfig(interaction.guild!.id)
    if (!config?.joinChannelId)
        return reply(interaction, `The config joinChannelId is not set. Use /config to set it before using this command`)

    const dataFromSpreadsheet = await fetchSchedulesFromSheet(interaction.guild!.id)
    if (!dataFromSpreadsheet.success) {
        const text = dataFromSpreadsheet.errorText || 'There was a problem adding the schedules from the spreadsheet'
        return reply(interaction, text)
    }

    const scheduleRows: ScheduleRow[] = []
    const errors: string[] = []
    for (let row of dataFromSpreadsheet.data) {
        const parsedOpenTime = chrono.parseDate(row.openTimeText, {}, {forwardDate: true})
        if (!parsedOpenTime) {
            console.error(`schedule.ts handleAddFromSpreadsheet failed to parse: ${row.openTimeText}`)
            errors.push(`Failed to parse the date ${row.openTimeText} in row ${row.row}`)
            continue
        }
        const startTime = parsedOpenTime.getTime()
        if (startTime < Date.now()) {
            errors.push(`The time <t:${Math.floor(startTime / 1000)}:F> in row ${row.row} is in the past`)
            continue
        }

        scheduleRows.push({
            openTimeText: row.openTimeText,
            openTimeTimestamp: startTime,
            autoCloseMinutes: row.autoCloseMinutes,
            format: row.format
        })
    }
    if (errors.length) {
        return reply(interaction, errors.join("\n").slice(0, 2000))
    }
    const lines: string[] = []
    for (let i = 0; i < scheduleRows.length; i++) {
        const {openTimeTimestamp, autoCloseMinutes, format} = scheduleRows[i]
        const endTime = openTimeTimestamp + 60000*autoCloseMinutes
        const start = Math.floor(openTimeTimestamp / 1000)
        const end = Math.floor(endTime / 1000)
        lines.push(`${i+1}. **${format || 'Poll'}**: <t:${start}:f> - <t:${start}:R> - Start at <t:${end}:t>`)
    }
    addFromSpreadsheetCache[interaction.id] = scheduleRows

    const button = new MessageButton()
        .setCustomId(`${data.name}|add|${interaction.id}`)
        .setLabel('Add')
        .setStyle("PRIMARY")
    const componentRow = new MessageActionRow()
        .addComponents(button)

    const texts = splitText(`If the dates are correct, push the button below to add them\n\n${lines.join("\n")}`, "\n", 4000)
    for (let i = 0; i < texts.length; i++) {
        const payload: InteractionReplyOptions = {embeds: [
            {description: texts[i]}
        ]}
        if (i === texts.length - 1)
            payload.components = [componentRow]
        if (i === 0)
            await reply(interaction, payload)
        else 
            await interaction.followUp({...payload, ephemeral: true}).catch(e => console.error(`schedule.ts followup failed: ${e}`))
    }
}

async function handleButtonAdd(interaction: ButtonInteraction) {
    if (!(interaction.member instanceof GuildMember))
        return
    
    await interaction.deferUpdate()
    const args = interaction.customId.split("|")

    const cacheData = addFromSpreadsheetCache[args[2]]
    if (!cacheData) {
        console.log(`schedule.ts handleButtonAdd() cachedata for guild ${interaction.guild!.id} was not found`)
        return replyToButton(interaction, {content: `Unable to add schedules. Please use the command again`, ephemeral: true})
    }

    const errors: string[] = []
    let successCount = 0
    for (let i = 0; i < cacheData.length; i++) {
        let err: string = "unknown error"
        const {openTimeTimestamp, openTimeText, autoCloseMinutes, format} = cacheData[i]
        const endTime = openTimeTimestamp + 60000*autoCloseMinutes
        const res = await addSchedule(interaction.guild!.id, openTimeTimestamp, endTime, format).catch(e => {
            err = `${e}`.includes("UNIQUE constraint failed") ? "already exists" : `${e}`
        })
        if (!res?.changes) {
            console.error(`schedule.ts handleButtonAdd() (add from spreadsheet) failed, ${err}. guild=${interaction.guild!.id} openTime=${openTimeText} autoClose=${autoCloseMinutes} format=${format}`)
            errors.push(openTimeText)
        }
        else {
            successCount++
        }
    }
    const schedules = successCount > 1 ? 'schedules' : 'schedule'
    if (errors.length)
        return replyToButton(interaction, {content: `Successfully added ${successCount} ${schedules}, but the following schedules were not added: ${errors.join(", ")}. This will happen if they already exist`, ephemeral: true})
    delete addFromSpreadsheetCache[args[2]]
    replyToButton(interaction, {content: `Successfully added ${successCount} ${schedules}`, ephemeral: true})
    updateStickyScheduleMessage(interaction.client, interaction.guildId!)
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

    let text = "Successfully removed the scheduled queue.\n\nQueue list\n"
    text += await listSchedules(interaction.guild!.id, 4000)
    reply(interaction, {embeds: [{description: text}]})
}

async function handleRemoveAll(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply()

    const res = await dbConnect(async db => {
        return await db.execute("DELETE FROM schedule WHERE guildId = ?", [interaction.guildId])
    }) 
    
    if (!res.changes)
        return reply(interaction, `There are no scheduled queues to remove`)
    const queues = res.changes > 1 ? 'queues' : 'queue'
    reply(interaction, `Successfully removed ${res.changes} ${queues}`)
}

async function handleList(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply()

    const text = await listSchedules(interaction.guild!.id, 20000)
    const texts = splitText(text, "\n", 4000)
    for (let i = 0; i < texts.length; i++) {
        const embed: MessageEmbedOptions = {
            title: i === 0 ? 'Queue Schedule' : undefined,
            description: texts[i]
        }
        
        if (i === 0)
            await reply(interaction, {embeds: [embed]})
        else
            await interaction.channel.send({embeds: [embed]}).catch(e => console.error(`schedule.ts handleList() channel.send failed: ${e}`))
    }
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

async function handleStickySchedule(interaction: CommandInteraction) {
    if (!interaction.channel || !(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!canManage)
        return reply(interaction, {content: 'You do not have permission to use this command', ephemeral: true})

    await interaction.deferReply({ephemeral: true})

    // send the initial sticky message
    const schedulesText = await listSchedules(interaction.guild!.id, 4000, true)
    let msg: Message;

    try {
        msg = await interaction.channel.send({embeds: [{title: `Queue List`, description: schedulesText}]})
    }
    catch(e) {
        console.error(`schedule.ts handleStickySchedule() send initial message failed: ${e}`)
        return reply(interaction, `There was a problem sending the sticky schedule message in this channel`)
    }

    const existingStickySchedule = await dbConnect(async db => {
        return await db.fetchOne<StickySchedule>("SELECT * FROM stickySchedule WHERE guildId = ?", [interaction.guildId])
    })

    await dbConnect(async db => {
        await db.execute("DELETE FROM stickySchedule WHERE guildId = ?", [interaction.guildId])
        await db.execute("INSERT INTO stickySchedule (guildId, channelId, messageId) VALUES (?, ?, ?)", [interaction.guildId, interaction.channelId, msg.id])
    })

    const added = existingStickySchedule ? "updated" : "added"
    let text = `Successfully ${added} the sticky schedule. `
    if (existingStickySchedule) {
        const link = `https://discord.com/channels/${existingStickySchedule.guildId}/${existingStickySchedule.channelId}/${existingStickySchedule.messageId}`
        text += `The [previous sticky schedule](${link}) in this server has been disabled and can be deleted`
    }
    return reply(interaction, text)
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