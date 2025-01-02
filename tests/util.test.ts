import { expect, test } from '@jest/globals';
import { currentFullRoomsCount, playersNeededForFullRooms } from "../src/common/util";

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