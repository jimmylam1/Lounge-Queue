import { QueuePlayer } from "../src/types/player"

export function getQueuePlayers(count: number) {
    const players: QueuePlayer[] = []
    for (let i = 0; i < count; i++) {
        players.push({
            id: i,
            name: `Player ${i}`,
            mmr: i*2,
            discordId: i.toString(),
        })
    }
    return players
}