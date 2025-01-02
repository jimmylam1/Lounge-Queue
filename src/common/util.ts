
export function currentFullRoomsCount(playerCount: number, roomSize: number) {
    return Math.floor(playerCount / roomSize);
}

export function playersNeededForFullRooms(playerCount: number, roomSize: number) {
    if (playerCount > 0 && playerCount % roomSize === 0)
        return 0
    return roomSize - (playerCount % roomSize);
}