export type sqlite3Wrapper = {
    execute: (sql: string, params?: any[]) => Promise<RunResult>;
    fetchOne: <T>(sql: string, params?: any[]) => Promise<T>;
    fetchAll: <T>(sql: string, params?: any[]) => Promise<T[]>;
}

export type RunResult = {
    lastID: number;
    changes: number;
}

export type Config = {
    guildId: string;
    minFullRooms: number;
    roomSize: number;
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
    startedBy: string;
    endTime: number | null; // if number, the queue will automatically close once the time is up
    active: boolean;
    format: number | null; // if number, specifies the number of teams per room (1 for FFA). null requires poll when queue closes
}

export type Players = {
    id: number;
    queue: number;
    discordId: string;
    name: string;
    mmr: number;
}