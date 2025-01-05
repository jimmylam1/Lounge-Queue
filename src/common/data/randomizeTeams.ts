import { FormatOption } from "../../types/guildConfig"
import { QueuePlayer } from "../../types/player"
import { shuffleArray } from "../util"

export function noTeams(players: QueuePlayer[], format: FormatOption) {
    return players.map(p => [p])
}

export function randomizeTeamsDefault(players: QueuePlayer[], format: FormatOption) {
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

export function randomizeTeamsMktLounge(_players: QueuePlayer[], format: FormatOption) {
    if (format !== '4v4')
        return randomizeTeamsDefault(_players, format)

    // top 2 mmr players must be on separate teams
    let players = _players.map(i => i) // make a copy
    players.sort((a, b) => b.mmr - a.mmr)
    const top2 = players.splice(0, 2)
    const shuffled = shuffleArray(players)
    const captains = Math.random() < 0.5 ? top2 : [top2[1], top2[0]]
    return [
        [captains[0], ...shuffled.slice(0, 3)], 
        [captains[1], ...shuffled.slice(3)]
    ]
}