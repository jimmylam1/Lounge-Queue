import { expect, test } from "@jest/globals"
import { getQueuePlayers } from "./util"
import { getScoreboard, scoreboardCommand } from "../src/common/textFormatters"

test('Test scoreboard', () => {
    const p = getQueuePlayers(8)

    // FFA
    const teamFfa = p.map(i => [i])
    let expected = "Player 7 0\n"
                 + "Player 6 0\n"
                 + "Player 5 0\n"
                 + "Player 4 0\n"
                 + "Player 3 0\n"
                 + "Player 2 0\n"
                 + "Player 1 0\n"
                 + "Player 0 0\n"
    expect(getScoreboard(teamFfa)).toEqual(expected)

    // 2v2
    const team2v2 = [[p[0], p[1]], [p[2], p[3]], [p[4], p[5]], [p[6], p[7]]]
    expected = "A\n"
             + "Player 6 0\n"
             + "Player 7 0\n"
             + "B\n"
             + "Player 4 0\n"
             + "Player 5 0\n"
             + "C\n"
             + "Player 2 0\n"
             + "Player 3 0\n"
             + "D\n"
             + "Player 0 0\n"
             + "Player 1 0\n"
    expect(getScoreboard(team2v2)).toEqual(expected)

    // 4v4
    const team4v4 = [[p[0], p[1], p[2], p[3]], [p[4], p[5], p[6], p[7]]]
    expected = "A\n"
             + "Player 4 0\n"
             + "Player 5 0\n"
             + "Player 6 0\n"
             + "Player 7 0\n"
             + "B\n"
             + "Player 0 0\n"
             + "Player 1 0\n"
             + "Player 2 0\n"
             + "Player 3 0\n"
    expect(getScoreboard(team4v4)).toEqual(expected)
})

test('Test scoreboardCommand()', () => {
    function getExpected(teams: number, nums: number[]) {
        const players: string[] = []
        for (let n of nums) {
            players.push(`Player ${n}`)
        }
        return `!scoreboard ${teams} ${players.join(", ")}`
    }

    const p = getQueuePlayers(8)
    expect(scoreboardCommand(p.map(p => [p]))).toEqual(getExpected(8, [7, 6, 5, 4, 3, 2, 1, 0]))

    const team2v2 = [[p[0], p[1]], [p[2], p[3]], [p[4], p[5]], [p[6], p[7]]]
    expect(scoreboardCommand(team2v2)).toEqual(getExpected(4, [6, 7, 4, 5, 2, 3, 0, 1]))

    const team4v4 = [[p[0], p[1], p[2], p[3]], [p[4], p[5], p[6], p[7]]]
    expect(scoreboardCommand(team4v4)).toEqual(getExpected(2, [4, 5, 6, 7, 0, 1, 2, 3]))
})