
export type RawScheduleRow = {
    row: number;
    openTimeText: string;
    autoCloseMinutes: number;
    format: string;
}

export type ScheduleRow = {
    openTimeText: string;
    openTimeTimestamp: number;
    autoCloseMinutes: number;
    format: string;
}