import { GuildConfig } from "../../types/guildConfig"
import { mmrMktLounge } from "./mmr"
import { randomizeTeamsDefault, randomizeTeamsMktLounge } from "./randomizeTeams"

export const guildConfig: {[key: string]: GuildConfig} = {
    '0': { // jest unit tests
        minFullRooms: 1,
        roomSize: 8,
        formats: ['FFA', '2v2', '4v4'],
        getMmr: async () => null,
        randomizeTeams: randomizeTeamsDefault,
        deleteOldRooms: false
    },
    '761672339716046868': { // test server
        minFullRooms: 1,
        roomSize: 8,
        formats: ['FFA', '2v2', '4v4'],
        getMmr: mmrMktLounge,
        randomizeTeams: randomizeTeamsMktLounge,
        deleteOldRooms: true
    },
    '816786965818245190': { // mkt lounge
        minFullRooms: 1,
        roomSize: 8,
        formats: ['FFA', '2v2', '4v4'],
        getMmr: mmrMktLounge,
        randomizeTeams: randomizeTeamsMktLounge,
        deleteOldRooms: true
    }
}