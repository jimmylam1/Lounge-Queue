import { dbConnect } from "./db/connect"
import { StaffRoles, Votes } from "../types/db";
import { guildConfig } from "./data/guildConfig";
import { QueuePlayer } from "../types/player";
import { FormatOption } from "../types/guildConfig";
import { findRoomMmr, findTeamMmr, shuffleArray } from "./util";
import { PollVotes } from "../types/loungeQueue";

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
export async function listQueueRoom(players: QueuePlayer[], roomNumber: number) {
    let text = `### Room ${roomNumber}\n`
    for (let i = 0; i < players.length; i++) {
        text += `${i+1}. ${players[i].name} (${players[i].mmr} MMR)\n`
    }
    return text
}

export function defaultRandomizeTeams(players: QueuePlayer[], format: FormatOption) {
    const playersPerTeam: {[key in FormatOption]: number} = {
        'FFA': 1,
        '2v2': 2,
        '3v3': 3,
        '4v4': 4,
        '5v5': 5,
        '6v6': 6,
    }

    const shuffled = shuffleArray(players)
    const teams: QueuePlayer[][] = []
    for (let i = 0; i < players.length; i += playersPerTeam[format]) {
        teams.push(shuffled.slice(i, i+playersPerTeam[format]))
    }
    return teams
}

export function formatTeams(teams: QueuePlayer[][]) {
    const roomMmr = findRoomMmr(teams)
    let text = `**Room MMR: ${roomMmr}**\n`
    for (let i = 0; i < teams.length; i++) {
        if (teams[0].length === 1)
            text += `${i+1}. ${teams[i][0].name} (${teams[i][0].mmr} MMR)\n`
        else {
            const teamMmr = findTeamMmr(teams[i])
            text += `\`Team ${i+1}\`: ${teams[i].map(p => p.name).join(', ')} (${teamMmr} MMR)\n`
        }
    }
    return text
}

export function getScoreboard(teams: QueuePlayer[][]) {
    let text = ''
    for (let i = 0; i < teams.length; i++) {
        text += `${String.fromCharCode(65+i)}\n`
        for (let player of teams[i]) {
            text += `${player.name} 0\n`
        }
    }
    return text
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
