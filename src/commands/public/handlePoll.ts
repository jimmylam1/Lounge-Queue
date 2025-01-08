import { ButtonInteraction, GuildMember, Message } from "discord.js"
import { buttonEvent } from "../../common/discordEvents"
import { dbConnect } from "../../common/db/connect"
import { reply, replyToButton } from "../../common/util"
import { getPollVotes } from "../../common/textFormatters"
import { closePoll, pollButtons } from "../../common/messageHelpers"
import { guildConfig } from "../../common/data/guildConfig"
import { Votes } from "../../types/db"
import { getPlayersInRoom } from "../../common/dbHelpers"

buttonEvent.on('handlePoll', async (interaction) => {
    handlePoll(interaction).catch(e => {
        console.error(`handlePoll.ts handlePoll()`, e)
        replyToButton(interaction, {content: `Failed to save your vote`, ephemeral: true}).catch(e => console.error(`handlePoll.ts handlePoll() replyToButton ${e}`))
    })
})

async function handlePoll(interaction: ButtonInteraction) {
    if (!interaction.channel || !interaction.guild || !(interaction.member instanceof GuildMember))
        return
    
    await interaction.deferUpdate()

    if (!await canVote(interaction.user.id, interaction.channel.id)) {
        await replyToButton(interaction, {content: 'You are not part of this lounge queue', ephemeral: true})
        return 
    }

    const format = interaction.customId.split("|")[1]
    const query = `INSERT INTO votes (roomChannelId, playerName, playerDiscordId, vote, updated) 
        VALUES (?, ?, ?, ?, ?) 
        ON CONFLICT (roomChannelId, playerDiscordId) DO 
        UPDATE SET vote = excluded.vote, updated = excluded.updated`
    const params = [interaction.channel.id, interaction.member.displayName, interaction.user.id, format, Date.now()]
    await dbConnect(async db => {
        return await db.execute(query, params)
    })

    const votes = await dbConnect(async db => {
        return await db.fetchAll<Votes>("SELECT * FROM votes WHERE roomChannelId = ? ORDER BY updated ASC", [interaction.channel!.id])
    })

    if (pollHasWinner(interaction.guild.id, votes) && interaction.message instanceof Message) {
        return await closePoll(interaction.message)
    }

    const { voteText } = await getPollVotes(interaction.guild.id, votes, false)
    const buttons = pollButtons(guildConfig[interaction.guild.id].formats)
    if (interaction.message instanceof Message)
        await reply(interaction, {content: voteText, components: [buttons]})
}

const voteCache: {[key: string]: Set<string>} = {}
async function canVote(userId: string, roomChannelId: string) {
    if (voteCache[roomChannelId])
        return voteCache[roomChannelId].has(userId)

    const players = await getPlayersInRoom(roomChannelId)
    voteCache[roomChannelId] = new Set<string>(players.map(p => p.discordId))
    setTimeout(() => { // delete cache entry after 10 minutes
        delete voteCache[roomChannelId]
    }, 600000);
    return voteCache[roomChannelId].has(userId)
}

function pollHasWinner(guildId: string, votes: Votes[]) {
    const count: {[key: string]: number} = {}
    for (let vote of votes) {
        if (!count[vote.vote])
            count[vote.vote] = 0
        count[vote.vote]++
    }
    const target = Math.floor(guildConfig[guildId].roomSize / 2)
    for (let key in count) {
        if (count[key] >= target)
            return true
    }
    return false
}
