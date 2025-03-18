import { ApplicationCommandData, ApplicationCommandOptionChoiceData, AutocompleteInteraction, ButtonInteraction, Client, CommandInteraction, Constants, Guild, GuildMember, MessageActionRow, MessageButton, TextChannel, ThreadChannel } from "discord.js";
import { autocompleteEvent, buttonEvent, slashCommandEvent } from "../../common/discordEvents";
import { findNext10Seconds, findRoomMmr, reply, replyToButton } from "../../common/util";
import { dbConnect } from "../../common/db/connect";
import { Config, Players, Subs } from "../../types/db";
import { getConfig, getPlayersInRoom, getRoom, getSubRowFromDb, queueRoomCount, removeSubRowFromDb } from "../../common/dbHelpers";
import { canManageLoungeQueue } from "../../common/permissions";
import { guildConfig } from "../../common/data/guildConfig";
import { Player } from "../../types/player";
import { getTextChannel } from "../../common/discordHelpers";
import { deleteLookingForSubMessage } from "../../common/messageHelpers";

export const data: ApplicationCommandData = {
    name: "sub",
    description: "Find a sub for the current room. Cannot use command outside LQ rooms",
    options: [
        {
            name: "player",
            description: "The player needing a sub",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: true,
            autocomplete: true
        },
        {
            name: "races-left",
            description: "The number of races left",
            type: Constants.ApplicationCommandOptionTypes.INTEGER,
            required: true,
            choices: getRacesLeftChoices()
        },
    ]
}

function getRacesLeftChoices() {
    const choices: ApplicationCommandOptionChoiceData[] = []
    for (let i = 0; i < 12; i++) {
        choices.push({name: `${i+1}`, value: i+1})
    }
    return choices
}

slashCommandEvent.on(data.name, async (interaction) => {
    handleInit(interaction).catch(e => {
        console.error(`sub.ts handleInit()`, e)
        reply(interaction, `An error ocurred`)
    })
})

buttonEvent.on(data.name, async (interaction) => {
    const cmd = interaction.customId.split("|")[1]

    if (cmd === 'cancel')
        handleCancel(interaction)
    else if (cmd === 'join') {
        handleSub(interaction)
    }
})

autocompleteEvent.on(data.name, async (interaction) => {
    const name = interaction.options.getFocused(true).name;
    if (name === 'player')
        autocompletePlayer(interaction).catch(e => console.error(`sub.ts autocompletePlayer()`, e))
})

async function autocompletePlayer(interaction: AutocompleteInteraction) {
    const userInput = interaction.options.getFocused(true).value.toLowerCase()
    const choices: string[] = (await findPlayersInRoom(interaction.channelId)).map(p => p.name)
    const mapped = choices.map(i => ({name: i, value: i}))
    await interaction.respond(mapped.filter(i => i.name.toLowerCase().startsWith(userInput)))
}

// main /sub command
async function handleInit(interaction: CommandInteraction) {
    if (!(interaction.member instanceof GuildMember))
        return
    if (!(interaction.channel instanceof ThreadChannel))
        return reply(interaction, {content: "This command is only available inside a thread channel", ephemeral: true})

    const { racesLeft, playerName, hasError } = getCommandOptions(interaction)
    if (hasError)
        return reply(interaction, {content: 'Missing one of the required command options', ephemeral: true})
    
    await interaction.deferReply()
    console.log(`${interaction.member.displayName} used /sub for ${playerName}`)

    const vars = await getInitVars(interaction, playerName).catch(e => console.error(`sub.ts getInitVars() failed`, e))
    if (!vars)
        return
    const { config, player, channel, room } = vars

    const res = await addSubToDb(room.queue, player, config, interaction.channelId, config.subChannelId!)
    // send the sub message to the join channel, then update db with the message id
    // if error, remove the row from the db
    try {
        const subMessage = await sendSubMessage(config, channel, interaction.channel.name, racesLeft, res.lastID)
        await addLookingMessageIdToDb(res.lastID, subMessage.id)
        const {content, componentRow} = await getReplyMessageComponents(config, interaction.user.id, res.lastID)
        const message = await interaction.editReply({content, components: [componentRow]})
        await addInitMessageIdToDb(res.lastID, message.id)
    }
    catch(e) {
        await removeSubRowFromDb(res.lastID)
        throw new Error(`sub.ts handleInit() failed ${e}`)
    }
}

async function handleCancel(interaction: ButtonInteraction) {
    const args = interaction.customId.split("|")
    cancelSub(interaction, args[2], parseInt(args[3])).catch(e => {
        console.error(`sub.ts cancelSub()`, e)
        replyToButton(interaction, {content: `An error ocurred`, ephemeral: true})
    })
}

async function handleSub(interaction: ButtonInteraction) {
    const args = interaction.customId.split("|")
    addSub(interaction, parseInt(args[2])).catch(e => {
        console.error(`sub.ts addSub()`, e)
        replyToButton(interaction, {content: `An error ocurred`, ephemeral: true})
    })
}

////////////////////////////////////////////////////////////////////////////////
// autocomplete helpers

async function findPlayersInRoom(roomChannelId: string) {
    return await dbConnect(async db => {
        return await db.fetchAll<Players>(`SELECT * FROM players WHERE roomChannelId = ?`, [roomChannelId])
    })
}

////////////////////////////////////////////////////////////////////////////////
// /sub helper functions

async function addLookingMessageIdToDb(rowId: number, messageId: string) {
    return await dbConnect(async db => {
        return await db.execute(`UPDATE subs SET lookingMessageId = ? WHERE id = ?`, [messageId, rowId])
    })
}

async function addInitMessageIdToDb(rowId: number, messageId: string) {
    return await dbConnect(async db => {
        return await db.execute(`UPDATE subs SET initMessageId = ? WHERE id = ?`, [messageId, rowId])
    })
}

function getCommandOptions(interaction: CommandInteraction) {
    let racesLeft = interaction.options.getInteger('races-left')
    let playerName = interaction.options.getString('player')
    let hasError = false
    if (!racesLeft || !playerName) {
        racesLeft = -1
        playerName = ''
        hasError = true
    }
    return { racesLeft, playerName, hasError }
}

async function getInitVars(interaction: CommandInteraction, playerName: string) {
    if (!(interaction.member instanceof GuildMember) || !(interaction.channel instanceof ThreadChannel))
        return

    const config = await getConfig(interaction.guild!.id)
    const canManage = await canManageLoungeQueue(interaction.member, interaction.guild!.id)
    if (!config?.subChannelId)
        return reply(interaction, `This command is not set up. Contact an admin to update the bot configutation`)
    if (config.subStaffOnly && !canManage)
        return reply(interaction, `Only LQ staff can use this command. Please notify them with the \`/ping-staff\` command`)

    const player = await playerInRoom(playerName, interaction.channel.id)
    if (!player)
        return reply(interaction, `The player ${playerName} is not in the current room`, {deleteTime: 10000})

    const channel = interaction.guild?.channels.resolve(config.subChannelId)
    if (!(channel instanceof TextChannel))
        throw new Error(`sub.ts handle() channel ${config.subChannelId} not text channel`)

    const alreadyLooking = await alreadyLookingForSub(player.name, interaction.channelId)
    if (alreadyLooking)
        return reply(interaction, `Already looking for a sub for ${player.name}`)

    const room = await getRoom(interaction.channelId)
    if (!room)
        throw new Error(`sub.ts handle() failed to fetch room`)

    if (room.createdAt + 7200000 <= Date.now())
        return reply(interaction, `This command cannot be used since it has been more than 2 hours since the room was created`)

    return { config, player, channel, room }
}

async function playerInRoom(playerName: string, channelId: string) {
    const res = await dbConnect(async db => {
        return await db.fetchOne<Players>(`SELECT * FROM players WHERE name = ? COLLATE NOCASE AND roomChannelId = ?`, [playerName, channelId])
    }).catch(e => console.error(`pingStaff.ts fetch roles ${e}`))
    return res
}

async function addSubToDb(queue: number, player: Players, config: Config, roomChannelId: string, lookingChannelId: string) {
    const playerName = player.name
    const players = await getPlayersInRoom(roomChannelId)
    const roomMmmr = findRoomMmr(players.map(i => [i]))
    const minMmr = Math.max(0, roomMmmr - config.subMmrDiff!)
    const maxMmr = roomMmmr + config.subMmrDiff!
    const startTime = Date.now()
    const expires = findNext10Seconds().getTime() + 60000*config.subMinutes! // 10 seconds works better for interval
    const query = `INSERT INTO subs 
        (queue, playerName, roomChannelId, lookingChannelId, minMmr, maxMmr, startTime, expires)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    const params = [queue, playerName, roomChannelId, lookingChannelId, minMmr, maxMmr, startTime, expires]
    return await dbConnect(async db => {
        return await db.execute(query, params)
    })
}

async function alreadyLookingForSub(playerName: string, roomChannelId: string) {
    const res = await dbConnect(async db => {
        return await db.fetchOne<Subs>("SELECT * FROM subs WHERE playerName = ? AND roomChannelId = ?", [playerName, roomChannelId])
    })
    return !!res
}

async function sendSubMessage(config: Config, channel: TextChannel, roomName: string, racesLeft: number, subRowId: number) {
    const sub = await getSubRowFromDb(subRowId)
    if (!sub)
        throw new Error(`sub.ts sendSubMessage() getSubRowFromDb returned null`)
    const expires = Math.floor(sub.expires/1000)
    const roomCount = await queueRoomCount(sub.queue)

    let text = `<@&${config.subPingRoleId}> - LQ ${roomName} is looking for a sub `
             + (roomCount === 1 ? 'with any MMR.\n' : `with MMR between ${sub.minMmr} - ${sub.maxMmr} for ${racesLeft} races.\n`)
             + `-# Expires <t:${expires}:R>`

    const button = new MessageButton()
        .setCustomId(`${data.name}|join|${subRowId}`)
        .setLabel('Join Room')
        .setStyle("PRIMARY")
    const componentRow = new MessageActionRow()
        .addComponents(button)

    const message = await channel.send({content: text, components: [componentRow]})
    return message
}

async function getReplyMessageComponents(config: Config, userId: string, rowId: number) {
    const expires = Math.floor((Date.now() + 60000*config.subMinutes!)/1000)
    const content = `Sent a message to <#${config.subChannelId}>.\n`
                  + `Press the button below to cancel searching for a sub.\n`
                  + `-# Expires <t:${expires}:R>`

    const button = new MessageButton()
        .setCustomId(`${data.name}|cancel|${userId}|${rowId}`)
        .setLabel('Cancel')
        .setStyle("SECONDARY")
    const componentRow = new MessageActionRow()
        .addComponents(button)

    return {content, componentRow}
}

////////////////////////////////////////////////////////////////////////////////
// cancel button

async function cancelSub(interaction: ButtonInteraction, userId: string, rowId: number) {
    await interaction.deferUpdate()

    if (!(interaction.member instanceof GuildMember))
        return

    const canManage = await canManageLoungeQueue(interaction.member, interaction.guildId!)
    if (!canManage && interaction.user.id !== userId)
        return replyToButton(interaction, `Only staff and whoever used the /sub command can cancel`)
    
    const sub = await getSubRowFromDb(rowId)
    if (!sub)
        return await reply(interaction, {content: 'Cancelled', components: []})

    const channel = await getTextChannel(interaction.client, sub.lookingChannelId)
    const successStatus = await deleteLookingForSubMessage(channel, rowId)
    if (!successStatus.success) {
        if (successStatus.message)
            await replyToButton(interaction, successStatus.message)
        return
    }

    await removeSubRowFromDb(rowId)
    await reply(interaction, {content: `Cancelled looking for a sub for ${sub.playerName || 'the player'}`, components: []})
}

////////////////////////////////////////////////////////////////////////////////
// add sub button

async function addSub(interaction: ButtonInteraction, rowId: number) {
    await interaction.deferUpdate()

    const sub = await addSubChecks(interaction, rowId)
    if (!sub)
        return

    await addSubToRoom(interaction.guild!, sub.roomChannelId, interaction.user.id, sub.playerName)
    await replyToButton(interaction, {content: `<@${interaction.user.id}> Join the room here: <#${sub.roomChannelId}>`, ephemeral: true})
    await subCleanup(interaction.guild!, sub)
}

async function addSubChecks(interaction: ButtonInteraction, rowId: number) {
    if (!(interaction.member instanceof GuildMember))
        return

    const mmr = await guildConfig[interaction.guild!.id].getMmr(interaction.member.displayName)
    if (mmr === null)
        return replyToButton(interaction, {content: "Unable to join the queue because your MMR couldn't be found", ephemeral: true})

    const sub = await getSubRowFromDb(rowId)
    if (!sub)
        return replyToButton(interaction, {content: `An error ocurred`, ephemeral: true})

    if (await isInQueue(sub.queue, interaction.user.id))
        return replyToButton(interaction, {content: `You cannot sub because you are already playing in the queue`, ephemeral: true})

    const roomCount = await queueRoomCount(sub.queue)
    if (roomCount !== 1 && (mmr < sub.minMmr || mmr > sub.maxMmr))
        return replyToButton(interaction, {content: `Your ${mmr} MMR is outside the range ${sub.minMmr} - ${sub.maxMmr}`, ephemeral: true})

    return sub
}

async function isInQueue(queueId: number, userId: string) {
    const res = await dbConnect(async db => {
        return await db.fetchOne<Player>("SELECT * FROM players WHERE queue = ? AND discordId = ? AND roomChannelId IS NOT NULL", [queueId, userId])
    })
    return !!res
}

async function addSubToRoom(guild: Guild, roomChannelId: string, userId: string, subbingOutName: string) {
    const channel = await guild.channels.fetch(roomChannelId)
    if (!(channel instanceof ThreadChannel))
        throw new Error(`sub.ts addSubToRoom() channel ${roomChannelId} is not a thread channel`)
    await channel.send(`<@${userId}> is subbing for ${subbingOutName}`)
}

async function subCleanup(guild: Guild, sub: Subs) {
    // delete looking for sub message
    const lookingChannel = await guild.channels.fetch(sub.lookingChannelId)
    if (!(lookingChannel instanceof TextChannel))
        throw new Error(`sub.ts subCleanup() lookingChannel ${sub.lookingChannelId} is not a text channel`)
    if (!sub.lookingMessageId)
        throw new Error(`sub.ts subCleanup() lookingMessageId ${sub.lookingMessageId} is null`)
    const lookingMessage = await lookingChannel.messages.fetch(sub.lookingMessageId)
    await lookingMessage.delete()
    
    // edit the message the /sub command was used from
    const initChannel = await guild.channels.fetch(sub.roomChannelId)
    if (!(initChannel instanceof ThreadChannel))
        throw new Error(`sub.ts subCleanup() initChannel ${sub.roomChannelId} is not a text channel`)
    if (!sub.initMessageId)
        throw new Error(`sub.ts subCleanup() initMessageId ${sub.lookingMessageId} is null`)
    const initMessage = await initChannel.messages.fetch(sub.initMessageId)
    await initMessage.edit({content: 'Successfully found a sub', components: []})

    // delete sub row in db
    await removeSubRowFromDb(sub.id)
}
