import { FormatOption } from "./guildConfig";

export type sqlite3Wrapper = {
    execute: (sql: string, params?: any[]) => Promise<RunResult>;
    fetchOne: <T>(sql: string, params?: any[]) => Promise<T | undefined>;
    fetchAll: <T>(sql: string, params?: any[]) => Promise<T[]>;
}

export type RunResult = {
    lastID: number;
    changes: number;
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
    format: FormatOption | null; // null requires poll when queue closes
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