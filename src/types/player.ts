export type Player = {
    discordId: string;
    name: string;
    mmr: number;
};

export type QueuePlayer = Player & {
    id: number;
};