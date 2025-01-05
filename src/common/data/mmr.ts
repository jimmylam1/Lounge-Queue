import { MktLoungeData } from "../../types/api"

var mktCache: {[key: string]: number} = {}
var lastMktFetched = 0
export async function mmrMktLounge(playerName: string) {
    // fetch the api at most once a minute.
    // uses a cache in case the api is unavailable

    async function fetchApi() {
        const newCache: {[key: string]: number} = {}
        const response = await fetch(`http://www.mariokarttour.net/api/leaderboard?from=1&to=9999`)
        if (response.status >= 300)
            return
        const data: MktLoungeData[] = await response.json()
        for (let player of data) {
            newCache[player.name] = player.mmr
        }
        mktCache = newCache
    }

    if (lastMktFetched + 60000 < Date.now()) {
        await fetchApi().catch(e => console.error(`mmr.ts mmrMktLounge() fetchApi() failed: ${e}`))
    }
    return mktCache[playerName] || null
}
