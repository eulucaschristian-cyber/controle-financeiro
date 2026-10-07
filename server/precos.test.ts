import { describe, it, expect } from "vitest";
import { normalizarTexto, casaBusca, resumirPorProduto } from "./precosRouter";

const linha = (id: number, productName: string, store: string, purchaseDate: string, unitPrice: string, unit = "un") => ({
  id, productName, rawName: productName.toUpperCase(), store, purchaseDate, unit, unitPrice,
});

describe("busca de preços", () => {
  it("ignora acento e maiúscula", () => {
    expect(normalizarTexto("  Açúcar  Refinado ")).toBe("acucar refinado");
    expect(casaBusca("acucar", "Açúcar União 1kg")).toBe(true);
  });

  it("exige todas as palavras, em qualquer ordem, e procura também no nome do cupom", () => {
    expect(casaBusca("arroz 5kg", "Arroz Branco Camil 5kg")).toBe(true);
    expect(casaBusca("arroz 1kg", "Arroz Branco Camil 5kg")).toBe(false);
    expect(casaBusca("integ", "Leite Integral", "LEITE INTEG ITALAC")).toBe(true);
    expect(casaBusca("", "qualquer")).toBe(true);
  });
});

describe("resumirPorProduto", () => {
  it("usa a compra mais recente como último preço e a de outro dia como anterior", () => {
    const r = resumirPorProduto([
      linha(3, "Leite Integral Italac 1L", "Pão de Açúcar", "2026-10-05", "5.99"),
      linha(2, "leite integral italac 1l", "Pão de Açúcar", "2026-10-05", "5.99"),
      linha(1, "Leite Integral Italac 1L", "Assaí", "2026-09-20", "4.89"),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].ultimo).toEqual({ preco: 5.99, store: "Pão de Açúcar", date: "2026-10-05" });
    expect(r[0].anterior).toEqual({ preco: 4.89, store: "Assaí", date: "2026-09-20" });
    expect(r[0].menor.store).toBe("Assaí");
    expect(r[0].compras).toBe(3);
  });

  it("produto com uma compra não tem anterior", () => {
    const r = resumirPorProduto([linha(1, "Banana Prata", "Hortifruti", "2026-10-01", "6.99", "kg")]);
    expect(r[0].anterior).toBeNull();
    expect(r[0].unit).toBe("kg");
  });
});
