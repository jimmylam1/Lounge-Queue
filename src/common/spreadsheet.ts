import fetch from 'node-fetch'
import { RawScheduleRow } from '../types/spreadsheet'

export function spreadsheetIsEnabled(guildId: string) {
    const guildIds = [
        '761672339716046868', // test server
        '816786965818245190', // mkt lounge
    ]
    return guildIds.includes(guildId)
}

export async function fetchSchedulesFromSheet(guildId: string) {
    const sheetId = process.env[`SHEET_${guildId}`]
    if (!sheetId) {
        console.log(`The google sheets ID for guild ${guildId} is null`)
        return {
            success: false,
            data: []
        }
    }
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`)
    if (res.status !== 200) {
        console.log(`Error fetching from google sheets for guild ${guildId}`)
        return {
            success: false,
            data: []
        }
    }

    const text = await res.text()
    const data: RawScheduleRow[] = []
    const lines = text.split("\n")
    const validMinutes = ['30', '45', '60', '75', '90']
    const validFormats = ['Poll', 'FFA', '2v2', '4v4']
    const openTimes = new Set<string>()
    let errors: string[] = []
    for (let i = 1; i < lines.length; i++) {
        let [openTime, autoCloseMinutes, format] = lines[i].split(",")
        if (!openTime) // if blank
            continue
        if (!validMinutes.includes(autoCloseMinutes))
            errors.push(autoCloseMinutes ? `Invalid minute "${autoCloseMinutes}" in row ${i+1}` : `Row ${i+1} is missing Auto Close Minutes`)
        if (!validFormats.includes(format))
            errors.push(format ? `Invalid format "${format}" in row ${i+1}` : `Row ${i+1} is missing the LQ format`)
        if (format === 'Poll')
            format = ''

        if (openTimes.has(openTime))
            errors.push(`The open time for row ${i+1} already exists`)
        openTimes.add(openTime)
        data.push({
            row: i+1, 
            openTimeText: openTime, 
            autoCloseMinutes: parseInt(autoCloseMinutes), 
            format
        })
    }

    return {
        success: errors.length === 0,
        data,
        errorText: errors.join("\n")
    }
}
