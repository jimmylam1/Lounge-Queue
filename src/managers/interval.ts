import { Client } from "discord.js";
import { closePolls } from "../interval/closePolls";
import { closeQueues } from "../interval/closeQueues";
import { openMktLoungeQueue } from "../interval/openMktLoungeQueue";

var nextHour = findNextHour()

// todo: add interval to delete old rows in each table
// also should delete row if one of the unknown message errors happen

export function runInterval(client: Client) {
    // check polls every 10 seconds
    setInterval(() => {
        closePolls(client).catch(e => console.error(`interval.ts closePolls() failed ${e}`))
    }, 10000);

    // check to close and open rooms every minute, on the minute
    setTimeout(() => {
        closeAndOpenQueues(client).catch(e => console.error(`interval.ts closeAndOpenQueues() failed ${e}`))
        setInterval(() => {
            closeAndOpenQueues(client).catch(e => console.error(`interval.ts closeAndOpenQueues() failed ${e}`))
        }, 60000);
    }, delayUntilMinute());
}

async function closeAndOpenQueues(client: Client) {
    await closeQueues(client)
    
    // open mkt queues every hour
    const now = new Date()
    if (nextHour <= now) {
        nextHour = findNextHour()
        await openMktLoungeQueue(client).catch(e => console.error(`Failed to create mkt lounge queue ${e}`))
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
