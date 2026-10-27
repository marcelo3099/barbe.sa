import { describe, expect, it } from "vitest";
import { dayRange, formatDate, formatTime, todayISODate } from "./datetime";

describe("datetime", () => {
  it("formatTime mostra o horário de São Paulo", () => {
    expect(formatTime("2026-11-03T09:00:00-03:00")).toBe("09:00");
    expect(formatTime("2026-11-03T12:00:00Z")).toBe("09:00");
  });
  it("formatDate mostra dia da semana e dd/MM", () => {
    expect(formatDate("2026-11-03T09:00:00-03:00")).toBe("ter., 03/11");
  });
  it("todayISODate usa o fuso de São Paulo", () => {
    expect(todayISODate(new Date("2026-11-04T02:00:00Z"))).toBe("2026-11-03");
  });
  it("dayRange devolve o dia inteiro em -03:00", () => {
    expect(dayRange("2026-11-03")).toEqual({ from: "2026-11-03T00:00:00-03:00", to: "2026-11-03T23:59:59-03:00" });
  });
});
