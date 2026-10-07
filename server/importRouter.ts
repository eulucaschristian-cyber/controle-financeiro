import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";

import { getDb, getCardSettings, calculateBillCycle } from "./db";
import { getNomesProdutosConhecidos } from "./precosRouter";
import { creditCardTransactions } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Sonnet 5.5: lê cupom/fatura com boa precisão a ~40% do custo do Opus 4.5
const READER_MODEL = "claude-sonnet-5-5";

// Pega o primeiro bloco de texto da resposta (pode haver blocos de outro tipo antes)
function extrairTextoResposta(data: any): string {
  if (data?.stop_reason === "refusal") throw new Error("A IA recusou processar este conteúdo.");
  const bloco = (data?.content ?? []).find((b: any) => b?.type === "text");
  return bloco?.text ?? "";
}

export const importRouter = router({

  analisarTexto: protectedProcedure
    .input(
      z.object({
        texto: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const hoje = new Date();
      const mesAtual = `${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
      const cardSettingsData = await getCardSettings(ctx.user.id);
      // Usa closingDay fixo (26 por padrão) — mais preciso para a maioria dos bancos BR
      const closingDay = cardSettingsData.closingDay ?? 26;

      const prompt = `Você é um parser especializado em faturas de cartão de crédito brasileiro.

Analise o texto abaixo e extraia TODAS as transações sem exceção.

TEXTO DA FATURA:
---
${input.texto.slice(0, 12000)}
---

REGRAS CRÍTICAS:
1. Extraia ABSOLUTAMENTE TODAS as linhas de compras/pagamentos
2. DATAS TRUNCADAS — As datas aparecem no formato DD/MM/A onde A é apenas 1 dígito do ano (ex: "31/07/2", "05/04/2"). Você deve inferir o ano completo assim:
   - A fatura é de ${mesAtual}
   - Monte o ano completo: 202A (ex: "2" → pode ser 2025 ou 2026)
   - Regra: se DD/MM/202A for POSTERIOR ao vencimento da fatura (${mesAtual}), use o ano anterior (202A - 1)
   - Exemplos com fatura ${mesAtual}: "05/04/2" = 05/04/2026 (abril 2026 é antes de maio 2026 ✓), "31/07/2" = 31/07/2025 (julho 2026 seria futuro ✗, usa 2025 ✓)
3. Parcelas: "03/08" no final da descrição = parcela atual=3, total=8
4. Valores BR: "1.234,56"=1234.56, "328,33"=328.33
5. Valores negativos ou precedidos de (-) = crédito/estorno, tipo "income"
6. Ignore apenas linhas de TOTAIS e CABEÇALHOS. INCLUA multas, IOF, juros de mora e encargos — categorize-os como "juros"
7. Para faturas Porto Seguro com múltiplos cartões: processe TODOS os cartões

IMPORTANTE SOBRE PARCELAS:
- Se uma linha tem "03/08" = é a parcela 3 de 8
- O valor já é o valor desta parcela individual (NÃO divida)
- Retorne parcela: { atual: 3, total: 8 }
- Se não tem parcelamento, parcela: null

CATEGORIAS DISPONÍVEIS (use exatamente estes valores):
- "restaurante" → restaurantes, lanchonetes, padarias, cafés, bares, fast food, delivery de comida (iFood, Rappi), sorveterias
- "supermercado" → supermercados, mercados, mercearias, hortifruti, açougue, varejão, mini-mercado
- "gasolina" → postos de gasolina, combustível, auto posto
- "despesas_carro" → manutenção automotiva, estacionamento, pedágio, lavagem de carro, oficinas, peças
- "compras_online" → lojas online, e-commerce, Amazon, Shopee, Mercado Livre, AliExpress, compras diversas
- "lazer" → entretenimento, cinema, shows, viagens, hotéis, Airbnb, parques, academia de dança
- "assinatura" → Netflix, Spotify, YouTube, iCloud, serviços de assinatura recorrente, TikTok Shop
- "academia" → academia de ginástica, pilates, crossfit, natação
- "pet" → pet shop, veterinário, ração, remédio animal
- "saude" → farmácia, médico, dentista, laboratório, plano de saúde, psicólogo
- "educacao" → escola, faculdade, cursos, livros educativos, material escolar
- "moradia" → aluguel, condomínio, energia, água, internet, reforma, móveis
- "juros" → juros, multas, encargos financeiros

RETORNE APENAS JSON VÁLIDO sem markdown, sem texto antes ou depois:
{
  "dataFatura": "MM/YYYY",
  "transacoes": [
    {
      "dataCompra": "DD/MM/YYYY",
      "descricao": "texto limpo sem numero de parcela",
      "valor": 123.45,
      "tipo": "expense",
      "categoria": "supermercado",
      "parcela": { "atual": 3, "total": 8 }
    }
  ]
}

tipo: "expense" para despesas, "income" para créditos/estornos
categoria: use um dos valores listados acima — escolha o mais adequado pela descrição
parcela: null se não parcelado`;

      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: READER_MODEL,
          // Sem raciocínio estendido: extração direta é suficiente e evita gastar tokens de thinking
          thinking: { type: "between_tools" },
          max_tokens: 8000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!anthropicResponse.ok) {
        const err = await anthropicResponse.text();
        throw new Error("Anthropic API error: " + err);
      }

      const anthropicData = await anthropicResponse.json();
      const raw = extrairTextoResposta(anthropicData);
      if (!raw) throw new Error("IA não retornou resposta");

      const texto = typeof raw === "string" ? raw : JSON.stringify(raw);
      const limpo = texto.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

      let parsed: any;
      try {
        parsed = JSON.parse(limpo);
      } catch {
        const match = limpo.match(/\{[\s\S]*\}/);
        if (match) {
          try { parsed = JSON.parse(match[0]); }
          catch { throw new Error("Resposta da IA em formato inválido"); }
        } else {
          throw new Error("Resposta da IA em formato inválido");
        }
      }

      const VALID_CATEGORIES = new Set([
        "restaurante","supermercado","gasolina","despesas_carro","compras_online",
        "lazer","assinatura","academia","pet","saude","educacao","moradia","juros",
      ]);

      // Parse bill month from Claude's dataFatura ("MM/YYYY") — used as base for installment billCycles
      let billYear = hoje.getFullYear();
      let billMonth0 = hoje.getMonth(); // 0-indexed
      if (parsed.dataFatura) {
        const fp = (parsed.dataFatura as string).split("/");
        if (fp.length === 2) {
          const m = parseInt(fp[0]);
          const y = parseInt(fp[1]);
          if (!isNaN(m) && !isNaN(y)) {
            billMonth0 = m - 1;
            billYear = y;
          }
        }
      }

      const transacoesFinais: any[] = [];

      for (const t of (parsed.transacoes || [])) {
        const partes = (t.dataCompra || "").split("/");
        let dataBase: Date;
        if (partes.length === 3) {
          const dia = parseInt(partes[0]);
          const mes = parseInt(partes[1]) - 1;
          const ano = parseInt(partes[2]);
          dataBase = new Date(ano, mes, dia);
          if (isNaN(dataBase.getTime())) dataBase = new Date();
        } else {
          dataBase = new Date();
        }

        const valor = Math.abs(parseFloat(String(t.valor)) || 0);
        if (valor === 0) continue;

        const categoria = VALID_CATEGORIES.has(t.categoria) ? t.categoria : "compras_online";

        const parcela = t.parcela?.atual
          ? { atual: t.parcela.atual, total: t.parcela.total }
          : null;

        const dateStr = `${dataBase.getFullYear()}-${String(dataBase.getMonth() + 1).padStart(2, "0")}-${String(dataBase.getDate()).padStart(2, "0")}`;

        if (parcela && parcela.total > 1) {
          // Each installment j maps to (billMonth0 + diff) where diff = j - parcela.atual
          // billCycle is derived directly from bill month, not from purchase date calculation
          for (let j = parcela.atual; j <= parcela.total; j++) {
            const diff = j - parcela.atual;
            const totalMonths = billMonth0 + diff;
            const cycleYear = billYear + Math.floor(totalMonths / 12);
            const cycleMonth = (totalMonths % 12) + 1;
            const billCycle = `${cycleYear}-${String(cycleMonth).padStart(2, "0")}`;
            transacoesFinais.push({
              date: dateStr,
              billCycle,
              amount: valor,
              type: t.tipo === "income" ? "income" : "expense",
              category: categoria,
              description: `${t.descricao} ${j}/${parcela.total}`,
              parcela: { atual: j, total: parcela.total },
            });
          }
        } else {
          transacoesFinais.push({
            date: dateStr,
            billCycle: calculateBillCycle(dateStr, { closingDay }),
            amount: valor,
            type: t.tipo === "income" ? "income" : "expense",
            category: categoria,
            description: t.descricao,
            parcela: null,
          });
        }
      }

      return {
        dataFatura: parsed.dataFatura || null,
        transactions: transacoesFinais,
        count: transacoesFinais.length,
      };
    }),

  confirmarTransacoes: protectedProcedure
    .input(
      z.object({
        billCycle: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        transactions: z.array(
          z.object({
            date: z.string(),
            amount: z.number(),
            type: z.enum(["expense", "income"]),
            description: z.string(),
            category: z.string().optional(),
            billCycle: z.string().optional(),
            parcela: z.object({
              atual: z.number(),
              total: z.number(),
            }).nullable().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const cardSettingsData = await getCardSettings(ctx.user.id);
      const closingDay = cardSettingsData.closingDay ?? 26;

      let importedCount = 0;
      let skippedCount = 0;

      for (const txn of input.transactions) {
        try {
          const descricaoBase = txn.description.replace(/\s+\d+\/\d+$/, "").trim().toLowerCase();
          const parcelaAtual = txn.parcela?.atual ?? null;

          // Usa billCycle pré-calculado pela transação (vem de analisarTexto) ou recalcula
          const billCycle: string = (txn as any).billCycle || calculateBillCycle(txn.date, { closingDay });

          // Deduplicação: descrição base + número da parcela + billCycle + valor
          // Inclui o valor para não descartar múltiplas compras com mesma descrição genérica
          // (ex: Porto Seguro usa "PARC COMPRA A VISTA 02/02" para compras diferentes)
          const existentes = await db
            .select({
              description: creditCardTransactions.description,
              installmentNumber: creditCardTransactions.installmentNumber,
              amount: creditCardTransactions.amount,
            })
            .from(creditCardTransactions)
            .where(
              and(
                eq(creditCardTransactions.userId, ctx.user.id),
                eq(creditCardTransactions.billCycle, billCycle)
              )
            );

          const valorStr = txn.amount.toFixed(2);
          const jaExiste = existentes.some((ex) => {
            const exBase = ex.description.replace(/\s+\d+\/\d+$/, "").trim().toLowerCase();
            return (
              exBase === descricaoBase &&
              (ex.installmentNumber ?? null) === parcelaAtual &&
              parseFloat(ex.amount).toFixed(2) === valorStr
            );
          });

          if (jaExiste) {
            skippedCount++;
            continue;
          }

          // Insere diretamente — valor já é o da parcela individual, SEM dividir
          await db.insert(creditCardTransactions).values({
            userId: ctx.user.id,
            date: txn.date,
            description: txn.description,
            amount: txn.amount.toFixed(2),
            category: txn.category || "compras_online",
            installments: txn.parcela?.total ?? 1,
            installmentNumber: txn.parcela?.atual ?? 1,
            billCycle,
          });

          importedCount++;
        } catch (error) {
          console.error("Erro ao importar transação:", error);
        }
      }

      return { success: true, importedCount, skippedCount };
    }),

  limparFatura: protectedProcedure
    .input(z.object({ billCycle: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { rowsAffected } = await db
        .delete(creditCardTransactions)
        .where(
          and(
            eq(creditCardTransactions.userId, ctx.user.id),
            eq(creditCardTransactions.billCycle, input.billCycle)
          )
        );

      return { success: true, deletedCount: rowsAffected };
    }),

  scanComprovante: protectedProcedure
    .input(z.object({
      imagens: z.array(z.object({
        base64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      })).min(1).max(4),
    }))
    .mutation(async ({ ctx, input }) => {
      const nomesConhecidos = await getNomesProdutosConhecidos(ctx.user.id).catch(() => [] as string[]);
      const blocoNomes = nomesConhecidos.length
        ? `\nPRODUTOS JÁ CADASTRADOS (se o item for um destes, use EXATAMENTE o mesmo "nome"):\n${nomesConhecidos.map((n) => `- ${n}`).join("\n")}\n`
        : "";

      const prompt = `Você é um extrator de dados de comprovantes brasileiros (cupom fiscal, NFC-e, recibo, nota).
${input.imagens.length > 1 ? `\nAs ${input.imagens.length} imagens são partes do MESMO comprovante, em ordem. Não duplique itens que apareçam em duas fotos.\n` : ""}
Analise a imagem e extraia as informações do comprovante.

RETORNE APENAS JSON VÁLIDO sem markdown:
{
  "estabelecimento": "nome do estabelecimento/loja",
  "data": "DD/MM/YYYY",
  "valor": 123.45,
  "descricao": "descrição curta (ex: Compra Supermercado Extra)",
  "categoria": "supermercado",
  "itens": [
    { "nomeCupom": "LEITE INTEG ITALAC 1L", "nome": "Leite Integral Italac 1L", "quantidade": 2, "unidade": "un", "precoUnitario": 5.49, "precoTotal": 10.98 }
  ]
}

REGRAS DOS ITENS:
- Liste TODOS os produtos do cupom, um por linha do cupom
- "nomeCupom": texto exatamente como está impresso
- "nome": nome legível e padronizado — produto + marca + tamanho (ex: "Arroz Branco Camil 5kg", "Banana Prata", "Coca-Cola 2L")
- "unidade": "un" para unidades, "kg" para itens pesados (frutas, carnes, frios a granel), "l" se vendido por litro
- Itens pesados: "quantidade" = peso em kg (ex: 0.785) e "precoUnitario" = preço por kg
- "precoTotal" = valor final da linha. Se houver desconto no item, aplique no precoTotal e recalcule precoUnitario
- "valor" = total pago na nota (após descontos)
- Se não for nota de compra com itens (ex: comprovante de Pix), retorne "itens": []
${blocoNomes}
CATEGORIAS (use exatamente):
- "restaurante" → restaurantes, lanchonetes, fast food, delivery
- "supermercado" → supermercados, mercados, hortifruti
- "gasolina" → postos de combustível
- "despesas_carro" → estacionamento, pedágio, oficina
- "compras_online" → lojas online, e-commerce
- "lazer" → cinema, shows, entretenimento
- "assinatura" → serviços recorrentes
- "academia" → academias, esportes
- "pet" → pet shop, veterinário
- "saude" → farmácia, médico, dentista
- "educacao" → escola, cursos
- "moradia" → materiais, condomínio
- "juros" → encargos, multas
- "pagamento_cartao" → pagamento de fatura
- "compras_online" → outros

Se não conseguir ler algum campo, use null.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: READER_MODEL,
          // Sem raciocínio estendido: extração direta é suficiente e evita gastar tokens de thinking
          thinking: { type: "between_tools" },
          // Nota de mercado com 50+ itens em JSON passa fácil de 1k tokens
          max_tokens: 8000,
          messages: [{
            role: "user",
            content: [
              ...input.imagens.map((img) => ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: img.mimeType,
                  data: img.base64,
                },
              })),
              { type: "text", text: prompt },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error("Erro na API: " + err);
      }

      const data = await response.json();
      if (data?.stop_reason === "max_tokens") {
        throw new Error("Nota grande demais para uma leitura. Tente dividir em fotos menores.");
      }
      const raw = extrairTextoResposta(data);
      const limpo = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

      let parsed: any;
      try {
        parsed = JSON.parse(limpo);
      } catch {
        const match = limpo.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("Não foi possível ler o comprovante.");
      }

      // Converte data BR para ISO
      let dateISO = new Date().toISOString().slice(0, 10);
      if (parsed.data) {
        const parts = parsed.data.split("/");
        if (parts.length === 3) {
          dateISO = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }

      const num = (v: unknown) => {
        const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
        return isNaN(n) ? 0 : Math.abs(n);
      };
      const itens = (Array.isArray(parsed.itens) ? parsed.itens : [])
        .filter((i: any) => i && typeof i === "object")
        .map((i: any) => {
          const quantidade = num(i.quantidade) || 1;
          const precoTotal = num(i.precoTotal);
          const precoUnitario = num(i.precoUnitario) || (precoTotal ? precoTotal / quantidade : 0);
          const nomeCupom = String(i.nomeCupom ?? i.nome ?? "").trim();
          return {
            rawName: nomeCupom,
            productName: String(i.nome ?? nomeCupom).trim(),
            quantity: quantidade,
            unit: ["un", "kg", "l"].includes(i.unidade) ? i.unidade : "un",
            unitPrice: Math.round(precoUnitario * 100) / 100,
            totalPrice: Math.round((precoTotal || precoUnitario * quantidade) * 100) / 100,
          };
        })
        .filter((i: any) => i.rawName && i.totalPrice > 0);

      return {
        estabelecimento: parsed.estabelecimento ?? "Estabelecimento",
        date: dateISO,
        amount: num(parsed.valor),
        description: parsed.descricao ?? parsed.estabelecimento ?? "Compra",
        category: parsed.categoria ?? "compras_online",
        itens,
      };
    }),
});
