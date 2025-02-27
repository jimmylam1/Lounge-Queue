import { Client } from "discord.js";
import { closePolls } from "../interval/closePolls";
import { closeQueues } from "../interval/closeQueues";
import { deleteOldRowsAndRooms } from "../interval/deleteRowsAndRooms";
import { openExampleLoungeQueue } from "../interval/exampleOpenLoungeQueue";
import { findNext10Seconds, findNextHour, sleep } from "../common/util";
import { openScheduledQueues } from "../interval/schedule";
import { cancelSubs } from "../interval/cancelSub";

export function runInterval(client: Client) {
    mainIntervalHandler(client)

    // check to delete old db rows and rooms once an hour
    setTimeout(() => {
        deleteOldRowsAndRooms(client).catch(e => console.error(`interval.ts deleteOldRowsAndRooms() failed`, e))
        setInterval(() => {
            deleteOldRowsAndRooms(client).catch(e => console.error(`interval.ts deleteOldRowsAndRooms() failed`, e))
        }, 3600000);
    }, findNextHour().getTime() - Date.now());
}

// need to check if function is running since they may take longer than the 10 second interval
var pollsIsRunning = false
var queuesIsRunning = false
var subsIsRunning = false
async function mainIntervalHandler(client: Client) {
    // run every 10 seconds.
    // use while loop instead of setInterval to better handle drift over time, running on :10 is important
    while (true) {
        await sleep(findNext10Seconds().getTime() - Date.now())
        // check for polls that should close
        if (!pollsIsRunning) {
            pollsIsRunning = true
            closePolls(client)
                .catch(e => console.error(`interval.ts closePolls() failed ${e}`))
                .finally(() => pollsIsRunning = false)
        }
        // check for queues that should close as well as any server open intervals
        if (!queuesIsRunning) {
            closeAndOpenQueues(client)
                .catch(e => console.error(`interval.ts closeAndOpenQueues() failed ${e}`))
                .finally(() => queuesIsRunning = false)
        }
        // check for sub messages to cancel
        if (!subsIsRunning) {
            cancelSubs(client)
                .catch(e => console.error(`interval.ts cancelSubs() failed ${e}`))
                .finally(() => subsIsRunning = false)
        }
    }
}

async function closeAndOpenQueues(client: Client) {
    await closeQueues(client)
    await openScheduledQueues(client)

    // custom server lounge queue intervals should be added here
    // await openExampleLoungeQueue(client)
}
