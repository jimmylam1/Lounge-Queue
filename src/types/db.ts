import { FormatOption } from "./guildConfig";

export type sqlite3Wrapper = {
    execute: (sql: string, params?: any[]) => Promise<RunResult>;
    fetchOne: <T>(sql: string, params?: any[]) => Promise<T | undefined>;
    fetchAll: <T>(sql: string, params?: any[]) => Promise<T[]>;
}

////////////////////////////////////////
// database tables

export type Config = {
    guildId: string;
    joinChannelId: string | null;
    subChannelId: string | null;
    subPingRoleId: string | null;
    subMmrDiff: number | null;
    subMinutes: number | null;
    subStaffOnly: boolean | null;
    queuePlusOneExtensionMinutes: number | null;
    queuePlusOnePingRoleId: string | null;
}

export type StaffRoles = {
    roleDiscordId: string;
    guildId: string;
}

export type LoungeQueue = {
    id: number;
    guildId: string;
    channelId: string;
    messageId: string;
    startTime: number;
    endTime: number | null; // if number, the queue will automatically close once the time is up
    active: boolean;
    cancelled: boolean | null;
    madeRooms: boolean | null;
    format: FormatOption | null; // null requires poll when queue closes
    extended: boolean | null; // used if queue is extended due to +1 players
}

export type Players = {
    id: number;
    queue: number;
    discordId: string;
    name: string;
    mmr: number;
    roomChannelId: string;
}

export type Rooms = {
    roomChannelId: string;
    queue: number;
    createdAt: number;
    pollMessageId: string | null;
    scoreboard: string | null;
}

export type Votes = {
    roomChannelId: number;
    playerName: string;
    playerDiscordId: string;
    vote: FormatOption;
    updated: number;
}

export type Schedule = {
    guildId: string;
    startTime: number;
    endTime: number;
    format: FormatOption | null;
}

export type Subs = {
    id: number;
    queue: number;
    playerName: string;
    roomChannelId: string;
    initMessageId: string | null;
    lookingChannelId: string;
    lookingMessageId: string | null;
    minMmr: number;
    maxMmr: number;
    startTime: number;
    expires: number;
}

////////////////////////////////////////
// helper types

export type RunResult = {
    lastID: number;
    changes: number;
}

export type RoomsWithGuildId = Rooms & {
    guildId: string
}
