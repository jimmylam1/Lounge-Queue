import { Snowflake } from "discord.js"

export type MktLoungeData = {
    mkcentralId: string;
    largestGain: '-' | number;
    color: string;
    largestLoss: '-' | number;
    active: boolean;
    mutes: number;
    baseMmr: number;
    verificationDate: number;
    peakMmr: number;
    guild: Snowflake;
    last10Loss: '-' | number;
    mmr: number;
    last10Gain: '-' | number;
    stats: number[];
    member: Snowflake;
    name: string;
    season: number;
    rank: number;
    winRate: '-' | number;
    playedEvents: number;
    last10Win: '-' | number;
    peakMmrColor: string;
}