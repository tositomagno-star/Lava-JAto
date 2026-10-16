import { describe, expect, it } from "vitest";
import {
  addDays,
  brl,
  DEFAULT_SCHEDULE,
  fmtDate,
  parseSchedule,
  todaySP,
  TZ,
  weekday,
  weekdayShort,
} from "./format";

describe("Brazil regional formatting", () => {
  it("uses the Minas Gerais/ Brasília date across UTC midnight boundaries", () => {
    expect(TZ).toBe("America/Sao_Paulo");
    expect(todaySP(new Date("2026-10-16T02:59:59.999Z"))).toBe("2026-10-15");
    expect(todaySP(new Date("2026-10-16T03:00:00.000Z"))).toBe("2026-10-16");
  });

  it("calculates date-only arithmetic and weekdays independently of the host timezone", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(weekday("2026-10-16")).toBe(5);
    expect(weekdayShort("2026-10-16")).toBe("Sex");
    expect(weekdayShort("2026-10-18")).toBe("Dom");
  });

  it("formats dates and Brazilian real in the requested display formats", () => {
    expect(fmtDate("2026-10-16")).toBe("16/10/2026");
    expect(brl(30).replace(/\s/g, " ")).toBe("R$ 30,00");
  });

  it("preserves the configured operating hours in 24-hour notation", () => {
    const weekdayHours = ["08:00", "10:00", "12:00", "13:30", "14:30", "15:30", "16:30"];
    const weekendHours = [
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
    ];

    expect(DEFAULT_SCHEDULE).toEqual({
      "1": weekdayHours,
      "2": weekdayHours,
      "3": weekdayHours,
      "4": weekdayHours,
      "5": weekendHours,
      "6": weekendHours,
      "0": [],
    });
    expect(DEFAULT_SCHEDULE["5"]).toContain("17:00");
    expect(DEFAULT_SCHEDULE["6"]).toContain("17:00");
    expect(DEFAULT_SCHEDULE["0"]).toEqual([]);
    expect(
      Object.values(DEFAULT_SCHEDULE)
        .flat()
        .every((time) => /^\d{2}:\d{2}$/.test(time)),
    ).toBe(true);
  });

  it("accepts a complete schedule from settings and rejects incomplete or malformed data", () => {
    expect(parseSchedule(DEFAULT_SCHEDULE)).toEqual(DEFAULT_SCHEDULE);
    expect(parseSchedule({ "1": ["08:00"] })).toBeNull();
    expect(parseSchedule({ ...DEFAULT_SCHEDULE, "2": ["not-a-time"] })).toBeNull();
    expect(parseSchedule({ ...DEFAULT_SCHEDULE, "2": ["25:00"] })).toBeNull();
    expect(parseSchedule(null)).toBeNull();
  });
});
