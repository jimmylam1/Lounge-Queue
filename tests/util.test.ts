import { expect, test } from '@jest/globals';
import { currentFullRoomsCount, playersNeededForFullRooms, findRoomMmr, findTeamMmr } from "../src/common/util";
import { getQueuePlayers } from './util';

test('Test currentFullRoomsCount()', () => {
    expect(currentFullRoomsCount(0, 8)).toEqual(0)
    expect(currentFullRoomsCount(1, 8)).toEqual(0)
    expect(currentFullRoomsCount(7, 8)).toEqual(0)
    expect(currentFullRoomsCount(8, 8)).toEqual(1)
    expect(currentFullRoomsCount(9, 8)).toEqual(1)
    expect(currentFullRoomsCount(15, 8)).toEqual(1)
    expect(currentFullRoomsCount(16, 8)).toEqual(2)
    expect(currentFullRoomsCount(17, 8)).toEqual(2)
})

test('Test playersNeededForFullRooms()', () => {
    expect(playersNeededForFullRooms(0, 8)).toEqual(8)
    expect(playersNeededForFullRooms(1, 8)).toEqual(7)
    expect(playersNeededForFullRooms(7, 8)).toEqual(1)
    expect(playersNeededForFullRooms(8, 8)).toEqual(0)
    expect(playersNeededForFullRooms(9, 8)).toEqual(7)
    expect(playersNeededForFullRooms(15, 8)).toEqual(1)
    expect(playersNeededForFullRooms(16, 8)).toEqual(0)
    expect(playersNeededForFullRooms(17, 8)).toEqual(7)
})

test('Test roomMmr()', () => {
    const teamFfa = getQueuePlayers(8).map(i => [i])
    expect(findRoomMmr(teamFfa)).toEqual(7)

    const p = getQueuePlayers(8)
    const team2v2 = [[p[0], p[1]], [p[2], p[3]], [p[4], p[5]], [p[6], p[7]]]
    expect(findRoomMmr(team2v2)).toEqual(7)

    const team4v4 = [[p[0], p[1], p[2], p[3]], [p[4], p[5], p[6], p[7]]]
    expect(findRoomMmr(team4v4)).toEqual(7)
})

test('Test teamMmr()', () => {
    const p = getQueuePlayers(8)
    expect(findTeamMmr([p[0], p[1]])).toEqual(1)
    expect(findTeamMmr([p[2], p[3]])).toEqual(5)
    expect(findTeamMmr([p[4], p[5]])).toEqual(9)
    expect(findTeamMmr([p[6], p[7]])).toEqual(13)
})