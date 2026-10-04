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

// F36: the regular service of a line in both directions (or one): each run is named after the stop it
// ends at, so residents read "towards X". The return trip uses the same times from the other end.
export const buildRegularService = (
  lineId: number,
  stops: { id: number; name: string }[],
  options: { dayType: DayType; first: string; last: string; everyMinutes: number; minutesBetweenStops: number; returnTrip: boolean }
) => {
  const orders = options.returnTrip ? [stops, [...stops].reverse()] : [stops];
  return orders.flatMap((order) =>
    buildDepartures(
      lineId,
      order.map((s) => s.id),
      { ...options, direction: order[order.length - 1].name }
    )
  );
};
