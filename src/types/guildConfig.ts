import { Snowflake } from "discord.js";
import { QueuePlayer } from "./player";

export type FormatOption = 'FFA' | '2v2' | '3v3' | '4v4' | '5v5' | '6v6';

export type GuildConfig = {
    minFullRooms: number;
    roomSize: number;
    formats: FormatOption[];
    getMmr: (playerName: string) => Promise<number | null>;
    randomizeTeams: (players: QueuePlayer[], format: FormatOption) => QueuePlayer[][];
    deleteOldRooms: boolean;
    botAccess: Snowflake[]; // the bots to be given access to each room 
}