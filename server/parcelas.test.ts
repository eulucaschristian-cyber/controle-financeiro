import { describe, it, expect } from "vitest";
import { dividirEmParcelas } from "./db";

describe("dividirEmParcelas", () => {
  it("põe o centavo que sobra na 1ª parcela e fecha o total", () => {
    expect(dividirEmParcelas("100.00", 3)).toEqual(["33.34", "33.33", "33.33"]);
    expect(dividirEmParcelas("287.45", 3)).toEqual(["95.83", "95.81", "95.81"]);
  });

  it("divisão exata e à vista", () => {
    expect(dividirEmParcelas("90.00", 3)).toEqual(["30.00", "30.00", "30.00"]);
    expect(dividirEmParcelas("19.90", 1)).toEqual(["19.90"]);
  });
});
