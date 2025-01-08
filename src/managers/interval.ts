import { Client } from "discord.js";
import { closePolls } from "../interval/closePolls";
import { closeQueues } from "../interval/closeQueues";
import { deleteOldRowsAndRooms } from "../interval/deleteRowsAndRooms";
import { openExampleLoungeQueue } from "../interval/exampleOpenLoungeQueue";
import { findNext10Seconds, findNextHour } from "../common/util";

export function runInterval(client: Client) {
    // run every 10 seconds, including on the minute
    setTimeout(() => {
        mainIntervalHandler(client)
        setInterval(() => {
            mainIntervalHandler(client)
        }, 10000);  
    }, findNext10Seconds().getTime() - Date.now());

    // check to delete old db rows and rooms once an hour
    setTimeout(() => {
        deleteOldRowsAndRooms(client).catch(e => console.error(`interval.ts deleteOldRowsAndRooms() failed ${e}`))
        setInterval(() => {
            deleteOldRowsAndRooms(client).catch(e => console.error(`interval.ts deleteOldRowsAndRooms() failed ${e}`))
        }, 3600000);
    }, findNextHour().getTime() - Date.now());
}

// need to check if function is running since they may take longer than the 10 second interval
var pollsIsRunning = false
var queuesIsRunning = false
function mainIntervalHandler(client: Client) {
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
}

async function closeAndOpenQueues(client: Client) {
    await closeQueues(client)
    
    // custom server lounge queue intervals should be added here
    // await openExampleLoungeQueue(client)
}
