import { Client, CommandInteraction, Message, MessageActionRow, MessageButton, MessageEmbedOptions, TextChannel, ThreadChannel } from "discord.js";
import { dbConnect } from "./db/connect";
import { getRooms, list } from "./core";
import { LoungeQueue, Votes } from "../types/db";
import { guildConfig } from "./data/guildConfig";
import { formatTeams, getPollVotes, getScoreboard, listQueueRoom } from "./textFormatters";
import { ThreadAutoArchiveDuration } from "discord-api-types/v10";
import { sleep } from "./util";
import { FormatOption } from "../types/guildConfig";
import { QueuePlayer } from "../types/player";

export const blankQueueList = "`Queue List`\n"
                            + "\n"
                            + "(+8 players for 1 full rooms)"

export function queueMessageEmbed(queueList: string, active: boolean, format?: FormatOption) {
    const embedOptions: MessageEmbedOptions = {
        description: queueList,
        color: active ? '#1e7fd4' : undefined
    }
    if (format)
        embedOptions.footer = {text: `Lounge Queue format: ${format}`}
    else
        embedOptions.footer = {text: `A poll will be created in each room once this queue closes.`}

    return embedOptions
}

export function queueButtons() {
    const joinButton = new MessageButton()
        .setCustomId(`handleJoinDrop|join`)
        .setLabel('Join')
        .setStyle("SUCCESS")
    const dropButton = new MessageButton()
        .setCustomId(`handleJoinDrop|drop`)
        .setLabel('Drop')
        .setStyle("DANGER")
    const componentRow = new MessageActionRow()
        .addComponents(joinButton)
        .addComponents(dropButton)

    return componentRow
}

/**
 * Create a new lounge queue message. Returns true if successful
 */
export async function createLoungeQueue(guildId: string, channel: TextChannel, autoClose: number | null, format?: FormatOption) {
    const message = await channel.send({embeds: [{description: 'Initializing...'}]})

    const query = `INSERT INTO loungeQueue 
        (guildId, channelId, messageId, startTime, endTime, active, format)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
    const now = Date.now()
    const params = [
        guildId,
        channel.id,
        message.id,
        now,
        autoClose ? now + 60000*autoClose : null,
        true,
        format || null
    ]
    const res = await dbConnect(async db => {
        return await db.execute(query, params)
    })

    if (res.changes === 1) {
        const embed = queueMessageEmbed(blankQueueList, true, format)
        const buttons = queueButtons()
        await message.edit({embeds: [embed], components: [buttons]})
        return true
    }
    return false
}

export async function updateLoungeQueueMessage(message: Message, active: boolean) {
    const queueList = await list(message.id)
    if (!queueList.success)
        return

    const queue = await dbConnect(async db => {
        return await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE messageId = ?", [message.id])
    })

    const embed = queueMessageEmbed(queueList.message, active, queue?.format || undefined)
    const buttons = queueButtons()
    const components = active ? [buttons] : []
    await message.edit({embeds: [embed], components})
}

export async function fetchLoungeQueueMessage(client: Client, messageId: string) {
    const res = await dbConnect(async db => {
        return await db.fetchOne<LoungeQueue>("SELECT * FROM loungeQueue WHERE messageId = ?", [messageId])
    })
    if (!res)
        return null

    const channel = await client.channels.fetch(res.channelId)
    if (!(channel instanceof TextChannel || channel instanceof ThreadChannel))
        return null

    const message = await channel.messages.fetch(messageId)
    return message
}

export async function fetchLoungeQueueMessageFromLink(interaction: CommandInteraction, messageLink: string | null) {
    if (!messageLink || !messageLink.startsWith('https://discord.com'))
        return {message: null, errorMessage: 'The message link needs to start with `https://discord.com`'}
    const linkArgs = messageLink.split("/")
    const messageId = linkArgs[linkArgs.length-1]

    const message = await fetchLoungeQueueMessage(interaction.client, messageId)
    if (!message || message.author.id != process.env.CLIENT_ID)
        return {message: null, errorMessage: `Failed to fetch the queue. This can happen if the message link is not from the bot or if it has been over 24 hours since the queue was initialized.`}
    return {message, errorMessage: ''}
}

export async function makeRooms(message: Message) {
    if (!message.guild)
        throw new Error('The guild for the provided message is unavailable')
    if (!(message.channel instanceof TextChannel))
        throw new Error('The message channel must be a regular text channel')

    const roomInfo = await getRooms(message.id)
    if (!roomInfo.queue) {
        console.error(`messageHelpers.ts makeRooms() roomInfo queue is null`)
        await message.reply(`There was a problem making the rooms`)
        return
    }

    if (roomInfo.rooms.length < guildConfig[message.guild.id].minFullRooms) {
        await message.reply(`This queue is cancelled because it needs a minimum of ${guildConfig[message.guild.id].minFullRooms} full rooms.`)
        return
    }

    for (let i = 0; i < roomInfo.rooms.length; i++) {
        const roomText = await listQueueRoom(roomInfo.rooms[i], i+1)
        await message.channel.send(roomText)
        
        const channel = await message.channel.threads.create({
            name: `Room ${i+1}`,
            type: 'GUILD_PRIVATE_THREAD',
            invitable: false,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneDay
        })

        await setPlayerRooms(roomInfo.rooms[i], roomInfo.queue.id, channel.id)

        let channelText = `${roomInfo.rooms[i].map(p => `<@${p.discordId}>`).join(', ')}\n\n`

        // if the queue format is specified, randomize the rooms then attach it to the message.
        // otherwise, just send the pings then create a new poll
        if (roomInfo.queue.format) {
            const teams = guildConfig[channel.guild.id].randomizeTeams(roomInfo.rooms[i], roomInfo.queue.format)
            channelText += `${formatTeams(teams)}\n`
            channelText += `-# Use /scoreboard to get the scoreboard\n`
            const scoreboard = getScoreboard(teams)
            await dbConnect(async db => {
                return await db.execute("INSERT INTO rooms (roomChannelId, createdAt, scoreboard) VALUES (?, ?, ?)", [channel.id, Date.now(), scoreboard])
            })
        }
        await channel.send(channelText)
        if (!roomInfo.queue.format)
            await createPoll(channel)
        await sleep(1000)
    }

    if (roomInfo.latePlayers.length) {
        let text = `### Late Players\n`
        for (let i = 0; i < roomInfo.latePlayers.length; i++) {
            text += `${i+1}. ${roomInfo.latePlayers[i].name} (${roomInfo.latePlayers[i].mmr} MMR)\n`
        }
        await message.reply(text)
    }
}

async function setPlayerRooms(players: QueuePlayer[], queueId: number, roomChannelId: string) {
    const whereClauses = []
    const params: any[] = [roomChannelId]
    for (let player of players) {
        whereClauses.push("(discordId = ? AND queue = ?)")
        params.push(player.discordId)
        params.push(queueId)
    }
    const query = `UPDATE players SET roomChannelId = ? WHERE ${whereClauses.join(" OR ")}`

    const res = await dbConnect(async db => {
        return await db.execute(query, params)
    })

    if (res.changes !== players.length) {
        console.error(`messageHelpers.ts setPlayerRooms() issue setting player room. Expected ${players.length} but got ${res.changes}`)
    }
    return res.changes === players.length
}

export function pollButtons(formats: FormatOption[]) {
    const componentRow = new MessageActionRow()
    for (let format of formats) {
        const button = new MessageButton()
            .setCustomId(`handlePoll|${format}`)
            .setLabel(format)
            .setStyle('PRIMARY')
            componentRow.addComponents(button)
    }

    return componentRow
}

export async function getPlayersInRoom(roomChannelId: string) {
    return await dbConnect(async db => {
        return await db.fetchAll<QueuePlayer>("SELECT * FROM players WHERE roomChannelId = ?", [roomChannelId])
    })
}

async function createPoll(channel: ThreadChannel) {
    const { voteText } = await getPollVotes(channel.guild.id, [], false)
    const buttons = pollButtons(guildConfig[channel.guild.id].formats)
    const message = await channel.send({content: voteText, components: [buttons]})
    await dbConnect(async db => {
        return await db.execute("INSERT INTO rooms (roomChannelId, createdAt, pollMessageId) VALUES (?, ?, ?)", [channel.id, Date.now(), message.id])
    })
}

/**
 * @param message The poll message
 */
export async function closePoll(message: Message) {
    if (!message.guild)
        return

    const votes = await dbConnect(async db => {
        return await db.fetchAll<Votes>("SELECT * FROM votes WHERE roomChannelId = ? ORDER BY updated ASC", [message.channel.id])
    })

    await message.delete()
    const { voteText, winningFormat } = await getPollVotes(message.guild.id, votes, true)
    const players = await getPlayersInRoom(message.channel.id)
    const teams = guildConfig[message.guild.id].randomizeTeams(players, winningFormat)
    let text = voteText + `\n\n${formatTeams(teams)}\n`
                + `-# (Use /scoreboard to get the scoreboard)\n`
    const scoreboard = getScoreboard(teams)
    await dbConnect(async db => {
        return await db.execute("UPDATE rooms SET scoreboard = ? WHERE roomChannelId = ?", [scoreboard, message.channel.id])
    })
    await message.channel.send(text)
    return
}