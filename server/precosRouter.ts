import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb, getFamilyMemberIds } from "./db";
import { groceryPrices } from "../drizzle/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

// Minúsculas e sem acento — "Açúcar" e "acucar" casam na busca
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Todas as palavras da busca precisam aparecer (no nome padronizado ou no do cupom), em qualquer ordem
export function casaBusca(termo: string, ...campos: string[]): boolean {
  const palavras = normalizarTexto(termo).split(" ").filter(Boolean);
  if (palavras.length === 0) return true;
  const alvo = normalizarTexto(campos.join(" "));
  return palavras.every((p) => alvo.includes(p));
}

type LinhaPreco = {
  id: number;
  productName: string;
  rawName: string;
  store: string;
  purchaseDate: string;
  unit: string;
  unitPrice: string;
};

export type ResumoProduto = {
  productName: string;
  unit: string;
  ultimo: { preco: number; store: string; date: string };
  anterior: { preco: number; store: string; date: string } | null;
  menor: { preco: number; store: string; date: string };
  compras: number;
};

// Espera as linhas já ordenadas da mais recente para a mais antiga
export function resumirPorProduto(linhas: LinhaPreco[]): ResumoProduto[] {
  const grupos = new Map<string, LinhaPreco[]>();
  for (const l of linhas) {
    const chave = normalizarTexto(l.productName);
    const g = grupos.get(chave);
    if (g) g.push(l);
    else grupos.set(chave, [l]);
  }

  const resumos: ResumoProduto[] = [];
  for (const g of Array.from(grupos.values())) {
    const toPonto = (l: LinhaPreco) => ({ preco: parseFloat(l.unitPrice), store: l.store, date: l.purchaseDate });
    const ultimo = toPonto(g[0]);
    // "Anterior" = compra mais recente feita em outro dia (mesma nota com o item repetido não conta)
    const ant = g.find((l) => l.purchaseDate !== g[0].purchaseDate);
    const menor = g.reduce((m, l) => (parseFloat(l.unitPrice) < parseFloat(m.unitPrice) ? l : m), g[0]);
    resumos.push({
      productName: g[0].productName,
      unit: g[0].unit,
      ultimo,
      anterior: ant ? toPonto(ant) : null,
      menor: toPonto(menor),
      compras: g.length,
    });
  }
  return resumos;
}

const itemSchema = z.object({
  rawName: z.string().min(1).max(255),
  productName: z.string().min(1).max(150),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(10),
  unitPrice: z.number().positive(),
  totalPrice: z.number().positive(),
});

async function buscarLinhasFamilia(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ids = await getFamilyMemberIds(userId);
  return db
    .select({
      id: groceryPrices.id,
      productName: groceryPrices.productName,
      rawName: groceryPrices.rawName,
      store: groceryPrices.store,
      purchaseDate: groceryPrices.purchaseDate,
      quantity: groceryPrices.quantity,
      unit: groceryPrices.unit,
      unitPrice: groceryPrices.unitPrice,
      totalPrice: groceryPrices.totalPrice,
    })
    .from(groceryPrices)
    .where(inArray(groceryPrices.userId, ids))
    .orderBy(desc(groceryPrices.purchaseDate), desc(groceryPrices.id))
    .limit(5000);
}

// Nomes já usados — vão no prompt do scan para o Claude reaproveitar o mesmo nome do produto
export async function getNomesProdutosConhecidos(userId: number, max = 300): Promise<string[]> {
  const linhas = await buscarLinhasFamilia(userId);
  const vistos = new Map<string, string>();
  for (const l of linhas) {
    const k = normalizarTexto(l.productName);
    if (!vistos.has(k)) vistos.set(k, l.productName);
    if (vistos.size >= max) break;
  }
  return Array.from(vistos.values());
}

export const precosRouter = router({
  salvarItens: protectedProcedure
    .input(
      z.object({
        store: z.string().min(1).max(150),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        itens: z.array(itemSchema).min(1).max(300),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Evita duplicar se a mesma nota for escaneada duas vezes (mesmo dia + mercado + item + valor)
      const ids = await getFamilyMemberIds(ctx.user.id);
      const existentes = await db
        .select({ rawName: groceryPrices.rawName, store: groceryPrices.store, totalPrice: groceryPrices.totalPrice })
        .from(groceryPrices)
        .where(and(inArray(groceryPrices.userId, ids), eq(groceryPrices.purchaseDate, input.date)));
      const chave = (store: string, raw: string, total: number) =>
        `${normalizarTexto(store)}|${normalizarTexto(raw)}|${total.toFixed(2)}`;
      const jaSalvos = new Set(existentes.map((e) => chave(e.store, e.rawName, parseFloat(e.totalPrice))));

      const novos = input.itens.filter((i) => !jaSalvos.has(chave(input.store, i.rawName, i.totalPrice)));
      if (novos.length > 0) {
        await db.insert(groceryPrices).values(
          novos.map((i) => ({
            userId: ctx.user.id,
            purchaseDate: input.date,
            store: input.store.trim(),
            rawName: i.rawName.trim(),
            productName: i.productName.trim(),
            quantity: i.quantity.toFixed(3),
            unit: i.unit.trim().toLowerCase(),
            unitPrice: i.unitPrice.toFixed(2),
            totalPrice: i.totalPrice.toFixed(2),
          }))
        );
      }
      return { salvos: novos.length, ignorados: input.itens.length - novos.length };
    }),

  buscar: protectedProcedure
    .input(z.object({ termo: z.string().max(100).default("") }))
    .query(async ({ ctx, input }) => {
      const linhas = await buscarLinhasFamilia(ctx.user.id);
      const filtradas = linhas.filter((l) => casaBusca(input.termo, l.productName, l.rawName));
      return resumirPorProduto(filtradas).slice(0, 100);
    }),

  historico: protectedProcedure
    .input(z.object({ productName: z.string().min(1).max(150) }))
    .query(async ({ ctx, input }) => {
      const linhas = await buscarLinhasFamilia(ctx.user.id);
      const alvo = normalizarTexto(input.productName);
      return linhas.filter((l) => normalizarTexto(l.productName) === alvo);
    }),

  excluir: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const ids = await getFamilyMemberIds(ctx.user.id);
      await db
        .delete(groceryPrices)
        .where(and(eq(groceryPrices.id, input.id), inArray(groceryPrices.userId, ids)));
      return { success: true };
    }),
});
