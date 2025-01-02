const config = `CREATE TABLE IF NOT EXISTS config(
    guildId TEXT PRIMARY KEY,
    queueSize INTEGER NOT NULL
) WITHOUT ROWID`

const staffRoles = `CREATE TABLE IF NOT EXISTS staffRoles(
    roleDiscordId INTEGER NOT NULL,
    guildId TEXT NOT NULL REFERENCES config(guildId),
    PRIMARY KEY (roleDiscordId, guildId)
) WITHOUT ROWID`

const loungeQueue = `CREATE TABLE IF NOT EXISTS loungeQueue(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    channelId TEXT NOT NULL,
    messageId TEXT NOT NULL UNIQUE,
    startTime INTEGER NOT NULL,
    startedBy TEXT NOT NULL,
    endTime INTEGER,
    active BOOLEAN NOT NULL
)`

const players = `CREATE TABLE IF NOT EXISTS players(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue INTEGER NOT NULL REFERENCES loungeQueue(id),
    discordId TEXT NOT NULL,
    name TEXT NOT NULL,
    mmr INTEGER NOT NULL,
    UNIQUE(queue, discordId)
)`

export const tables = [config, staffRoles, loungeQueue, players]