import type { DayType } from "@prisma/client";
import { hhmmToMinutes, minutesToHHMM } from "./datetime";

// F36: builds a regular timetable for a line: one departure every `everyMinutes`
// from the first stop, reaching each following stop `minutesBetweenStops` later.
export const buildDepartures = (
  lineId: number,
  stopIds: number[],
  options: {
    dayType: DayType;
    first: string;
    last: string;
    everyMinutes: number;
    minutesBetweenStops: number;
    direction?: string;
  }
) => {
  const rows: { line_id: number; stop_id: number; day_type: DayType; time: string; direction?: string }[] = [];
  const last = hhmmToMinutes(options.last);
  for (let start = hhmmToMinutes(options.first); start <= last; start += options.everyMinutes) {
    stopIds.forEach((stopId, index) => {
      const minutes = start + index * options.minutesBetweenStops;
      if (minutes >= 24 * 60) return;
      rows.push({
        line_id: lineId,
        stop_id: stopId,
        day_type: options.dayType,
        time: minutesToHHMM(minutes),
        direction: options.direction,
      });
    });
  }
  return rows;
};
