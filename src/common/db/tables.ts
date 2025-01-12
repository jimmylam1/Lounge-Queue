const config = `CREATE TABLE IF NOT EXISTS config(
    guildId TEXT PRIMARY KEY NOT NULL,
    joinChannelId TEXT
) WITHOUT ROWID`

const staffRoles = `CREATE TABLE IF NOT EXISTS staffRoles(
    roleDiscordId TEXT NOT NULL,
    guildId TEXT NOT NULL,
    PRIMARY KEY (roleDiscordId, guildId)
) WITHOUT ROWID`

const loungeQueue = `CREATE TABLE IF NOT EXISTS loungeQueue(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    channelId TEXT NOT NULL,
    messageId TEXT NOT NULL UNIQUE,
    startTime INTEGER NOT NULL,
    endTime INTEGER,
    active BOOLEAN NOT NULL,
    cancelled BOOLEAN,
    madeRooms BOOLEAN,
    format TEXT
)`

const players = `CREATE TABLE IF NOT EXISTS players(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue INTEGER NOT NULL REFERENCES loungeQueue(id),
    discordId TEXT NOT NULL,
    name TEXT NOT NULL,
    mmr INTEGER NOT NULL,
    roomChannelId TEXT,
    UNIQUE(queue, discordId)
)`

const rooms = `CREATE TABLE IF NOT EXISTS rooms(
    roomChannelId TEXT PRIMARY KEY NOT NULL,
    queue INTEGER NOT NULL REFERENCES loungeQueue(id),
    createdAt INT NOT NULL,
    pollMessageId TEXT,
    scoreboard TEXT
) WITHOUT ROWID`

const votes = `CREATE TABLE IF NOT EXISTS votes(
    roomChannelId TEXT NOT NULL REFERENCES rooms(roomChannelId),
    playerName TEXT NOT NULL,
    playerDiscordId TEXT NOT NULL,
    vote TEXT NOT NULL,
    updated INT NOT NULL,
    PRIMARY KEY (roomChannelId, playerDiscordId)
) WITHOUT ROWID`

const openSchedule = `CREATE TABLE IF NOT EXISTS openSchedule(
    guildId TEXT NOT NULL,
    startTime INTEGER NOT NULL,
    endTime INTEGER NOT NULL,
    format TEXT,
    PRIMARY KEY (guildid, startTime)
) WITHOUT ROWID`

export const tables = [config, staffRoles, loungeQueue, players, rooms, votes, openSchedule]