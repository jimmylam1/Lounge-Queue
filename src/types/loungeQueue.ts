import { QueuePlayer } from "./player";

export type LoungeQueueData = {
    channelId: string;
    messageId: string;
    startTime: number;
    startedBy: string;
    endTime: number | null;
    active: boolean;
    queue: QueuePlayer[];
}

export type SuccessStatus = {
    success: boolean;
    message: string;
}

export type RoomInfo = {
    rooms: QueuePlayer[][];
    latePlayers: QueuePlayer[];
}
