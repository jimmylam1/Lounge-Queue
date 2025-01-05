import { LoungeQueue } from "./db";
import { FormatOption } from "./guildConfig";
import { QueuePlayer } from "./player";

export type SuccessStatus = {
    success: boolean;
    message: string;
}

export type RoomInfo = {
    rooms: QueuePlayer[][];
    latePlayers: QueuePlayer[];
    queue: LoungeQueue | null;
}

export type PollVotes = {
    voteText: string;
    winningFormat: FormatOption;
}
