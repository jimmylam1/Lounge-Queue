import { GuildConfig } from "../../types/guildConfig"
import { defaultRandomizeTeams } from "../textFormatters"

export const guildConfig: {[key: string]: GuildConfig} = {
    '0': { // jest unit tests
        minFullRooms: 1,
        roomSize: 8,
        formats: ['FFA', '2v2', '4v4'],
        getMmr: async () => null,
        randomizeTeams: defaultRandomizeTeams
    },
    '761672339716046868': { // test server
        minFullRooms: 1,
        roomSize: 8,
        formats: ['FFA', '2v2', '4v4'],
        getMmr: async () => Math.round(Math.random() * 5000),
        randomizeTeams: defaultRandomizeTeams
    }
}