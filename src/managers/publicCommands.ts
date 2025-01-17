import { data as cancelData } from '../commands/public/cancel'
import { data as closeData } from '../commands/public/close'
import { data as configData } from '../commands/public/config'
import '../commands/public/handleQueueButtons'
import '../commands/public/handlePoll'
import { data as makeRoomsData } from '../commands/public/makeRooms'
import { data as openData } from '../commands/public/open'
import { data as pingStaffData } from '../commands/public/pingStaff'
import { data as scheduleData } from '../commands/public/schedule'
import { data as scoreboardData } from '../commands/public/scoreboard'
import { data as startData } from '../commands/public/start'
import { data as subData } from '../commands/public/sub'

export const commandData = [
    cancelData,
    closeData,
    configData,
    makeRoomsData,
    openData,
    pingStaffData,
    scheduleData,
    scoreboardData,
    startData,
    subData
]