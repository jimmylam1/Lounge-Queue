import { Client } from "discord.js";
import { closePolls } from "../interval/closePolls";
import { closeQueues } from "../interval/closeQueues";
import { openMktLoungeQueue } from "../interval/openMktLoungeQueue";
import { deleteOldRowsAndRooms } from "../interval/deleteRowsAndRooms";

export function runInterval(client: Client) {
    // check polls every 10 seconds
    setInterval(() => {
        closePolls(client).catch(e => console.error(`interval.ts closePolls() failed ${e}`))
    }, 10000);

    // check to close and open queues every minute, on the minute
    setTimeout(() => {
        closeAndOpenQueues(client).catch(e => console.error(`interval.ts closeAndOpenQueues() failed ${e}`))
        setInterval( () => {
            closeAndOpenQueues(client).catch(e => console.error(`interval.ts closeAndOpenQueues() failed ${e}`))
        }, 60000);
    }, delayUntilMinute());

    // check to delete old db rows and rooms once an hour, doesn't have to be precisely on the hour
    setInterval(() => {
        deleteOldRowsAndRooms(client).catch(e => console.error(`interval.ts deleteOldRowsAndRooms() failed ${e}`))
    }, 3600000);
}

var nextCloseOpenHour = findNextHour()
async function closeAndOpenQueues(client: Client) {
    await closeQueues(client)
    
    // custom server lounge queue intervals should be added here

    // open mkt queues every hour
    const now = new Date()
    if (nextCloseOpenHour <= now) {
        nextCloseOpenHour = findNextHour()
        // await openMktLoungeQueue(client).catch(e => console.error(`Failed to create mkt lounge queue ${e}`)) // TODO: enable
    }
}

function delayUntilMinute() {
    const now = new Date()
    const nextMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0);
    return nextMinute.getTime() - now.getTime()
}

function findNextHour() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
}
