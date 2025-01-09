import { dbConnect } from "./db/connect"
import { StaffRoles, Votes } from "../types/db";
import { guildConfig } from "./data/guildConfig";
import { QueuePlayer } from "../types/player";
import { FormatOption } from "../types/guildConfig";
import { findRoomMmr, findTeamMmr } from "./util";
import { PollVotes } from "../types/loungeQueue";
import { getLatestQueueInChannel } from "./dbHelpers";

export async function listConfig(guildId: string) {
    let res = await dbConnect(async db => {
        const staffRoles = await db.fetchAll<StaffRoles>("SELECT * FROM staffRoles WHERE guildId = ?", [guildId])
        return { staffRoleIds: staffRoles.map(r => r.roleDiscordId) }
    }).catch(e => console.error(`config.ts list() ${e}`))

    if (!res)
        return 'There was a problem listing the server configuration'
    
    let text = "`Server configuration`\n"
             + `queue-staff: ${res.staffRoleIds.map(r => `<@&${r}>`).join(", ") || "None"}\n`
             + '\n'
             + 'The config options below can only be set by the bot developer\n'
             + `min-full-rooms: ${guildConfig[guildId].minFullRooms}\n`
             + `room-size: ${guildConfig[guildId].roomSize}\n`
             + `formats: ${guildConfig[guildId].formats.join(", ")}\n`
    return text
}

/**
 * 
 * @param players This should be a sorted array
 * @param roomNumber The room number
 */
export async function listQueueRoom(players: QueuePlayer[], roomNumber: number, threadChannelId: string) {
    let text = `**Room ${roomNumber}** -- <#${threadChannelId}>\n`
    for (let i = 0; i < players.length; i++) {
        text += `${i+1}. ${players[i].name} (${players[i].mmr} MMR)\n`
    }
    return text
}

function sortTeamsByMmr(teams: QueuePlayer[][]) {
    let arr = teams.map((team, idx) => ({idx, teamMmr: findTeamMmr(team)}))
    arr.sort((a, b) => b.teamMmr - a.teamMmr)
    return arr.map(i => teams[i.idx])
}

export function formatTeams(teams: QueuePlayer[][]) {
    const sortedTeams = sortTeamsByMmr(teams)
    const roomMmr = findRoomMmr(sortedTeams)
    let text = `**Room MMR: ${roomMmr}**\n`
    for (let i = 0; i < sortedTeams.length; i++) {
        if (sortedTeams[0].length === 1)
            text += `${i+1}. ${sortedTeams[i][0].name} (${sortedTeams[i][0].mmr} MMR)\n`
        else {
            const teamMmr = findTeamMmr(sortedTeams[i])
            text += `\`Team ${i+1}\`: ${sortedTeams[i].map(p => p.name).join(', ')} (${teamMmr} MMR)\n`
        }
    }
    return text
}

export function getScoreboard(teams: QueuePlayer[][]) {
    const sortedTeams = sortTeamsByMmr(teams)
    let text = ''
    const isFFA = sortedTeams[0].length === 1
    for (let i = 0; i < sortedTeams.length; i++) {
        if (!isFFA)
            text += `${String.fromCharCode(65+i)}\n`
        for (let player of sortedTeams[i]) {
            text += `${player.name} 0\n`
        }
    }
    return text
}

/**
 * Returns the scoreboard command as `!scoreboard # player1, player2, ...`
 */
export function scoreboardCommand(teams: QueuePlayer[][]) {
    const sortedTeams = sortTeamsByMmr(teams)
    return `!scoreboard ${sortedTeams.length} ${sortedTeams.flat().map(i => i.name).join(", ")}`
}

export async function getPollVotes(guildId: string, votesArray: Votes[], hasEnded: boolean): Promise<PollVotes> {
    function maxVoteCount(votes: {[key: string]: any[]}) {
        let count = 0
        for (let key in votes) {
            count = Math.max(count, votes[key].length)
        }
        return count
    }

    const votes: {[key: string]: Votes[]} = {}
    let bestFormat: FormatOption = guildConfig[guildId].formats[0] // either the winning vote format or the one that was voted first in a tie
    let bestCount = 0
    for (let format of guildConfig[guildId].formats) {
        votes[format] = []
    }
    for (let vote of votesArray) {
        votes[vote.vote].push(vote)
        const count = maxVoteCount(votes)
        if (count > bestCount) {
            bestCount = count
            bestFormat = vote.vote
        }
    }

    let voteText = hasEnded ? "**Poll Ended!**\n\n" : "**Poll Started!**\n\n"
    for (let format of guildConfig[guildId].formats) {
        voteText += `${format} - **${votes[format].length}** ` + (votes[format].length > 0 ? `(${votes[format].map(p => p.playerName).join(", ")})` : ``) + `\n`
    }

    if (!hasEnded) {
        voteText += "\nPlease vote for the format!\n"
             + `Poll ends in 2 minutes or when a format reaches ${Math.floor(guildConfig[guildId].roomSize/2)} votes.`
    }
    else {
        voteText += `**Winner: ${bestFormat}**`
    }
    return {voteText, winningFormat: bestFormat}
}

export function roomFooter() {
    let text = `-# Use \`/scoreboard\` to get the scoreboard. Use \`/ping-staff\` to ping Lounge Queue staff.\n`
    return text
}

export async function getLatestQueueMessageLink(channelId: string) {
    const queue = await getLatestQueueInChannel(channelId)
    if (!queue)
        return null
    return `https://discord.com/channels/${queue.guildId}/${queue.channelId}/${queue.messageId}`
}