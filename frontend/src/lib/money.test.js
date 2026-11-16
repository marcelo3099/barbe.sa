import { describe, expect, it } from "vitest";
import { formatPrice } from "./money";

describe("formatPrice", () => {
  it("formata centavos em reais", () => {
    expect(formatPrice(4500)).toBe("R$ 45,00");
    expect(formatPrice(0)).toBe("R$ 0,00");
  });
});
