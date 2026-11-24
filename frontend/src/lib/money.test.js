import { describe, expect, it } from "vitest";
import { formatPrice, parsePriceInput } from "./money";

describe("formatPrice", () => {
  it("formata centavos em reais", () => {
    expect(formatPrice(4500)).toBe("R$ 45,00");
    expect(formatPrice(0)).toBe("R$ 0,00");
  });
});

describe("parsePriceInput", () => {
  it("converte o texto digitado em centavos", () => {
    expect(parsePriceInput("45,00")).toBe(4500);
    expect(parsePriceInput("45")).toBe(4500);
    expect(parsePriceInput("12,5")).toBe(1250);
    expect(parsePriceInput("R$ 1.234,56")).toBe(123456);
    expect(parsePriceInput("abc")).toBe(null);
    expect(parsePriceInput("")).toBe(null);
  });
});
