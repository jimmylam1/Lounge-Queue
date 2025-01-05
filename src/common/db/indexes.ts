
export const indexes = [
    `CREATE INDEX IF NOT EXISTS findVotes ON 
        votes (roomChannelId, updated ASC)`,
    `CREATE INDEX IF NOT EXISTS findRooms ON 
        rooms (roomChannelId)`,
    `CREATE INDEX IF NOT EXISTS listPlayers ON 
        players (queue, id ASC)`,
    `CREATE INDEX IF NOT EXISTS playersInRoom ON 
        players (roomChannelId) WHERE roomChannelId IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS pollsCheck ON 
        rooms (createdAt, pollMessageId) WHERE pollMessageId IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS queueCheck ON 
        loungeQueue (endTime, active) WHERE active = 1`,
    `CREATE INDEX IF NOT EXISTS deleteQueue ON 
        loungeQueue (startTime, active) WHERE active = 0`,
    `CREATE INDEX IF NOT EXISTS deleteRooms ON 
        rooms (createdAt)`,
]
    