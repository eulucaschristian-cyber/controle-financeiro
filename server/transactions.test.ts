import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

// Mock the database functions
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    createTransaction: vi.fn().mockResolvedValue(1),
    getTransactionsByFamilyAndMonth: vi.fn().mockResolvedValue([
      {
        id: 1,
        userId: 1,
        date: "2026-03-24",
        description: "Almoço",
        category: "alimentacao_fora",
        amount: "25.00",
        paymentMethod: "debito",
        installments: 1,
        installmentNumber: 1,
        createdAt: new Date(),
        userName: "Test User",
      },
      {
        id: 2,
        userId: 1,
        date: "2026-03-24",
        description: "Café",
        category: "alimentacao_fora",
        amount: "8.50",
        paymentMethod: "pix",
        installments: 1,
        installmentNumber: 1,
        createdAt: new Date(),
        userName: "Test User",
      },
    ]),
    deleteTransaction: vi.fn().mockResolvedValue(undefined),
    getDailySummary: vi.fn().mockResolvedValue([
      { date: "2026-03-24", totalSpent: "33.50" },
    ]),
    getCategorySummary: vi.fn().mockResolvedValue([
      { category: "alimentacao_fora", total: "33.50", count: 2 },
    ]),
    getPaymentMethodSummary: vi.fn().mockResolvedValue([
      { paymentMethod: "debito", total: "25.00", count: 1 },
      { paymentMethod: "pix", total: "8.50", count: 1 },
    ]),
    getUserSettings: vi.fn().mockResolvedValue({
      userId: 1,
      dailyBudget: "66.00",
    }),
    updateUserSettings: vi.fn().mockResolvedValue(undefined),
    getFamilyMemberIds: vi.fn().mockResolvedValue([1]),
  };
});

describe("transactions.create", () => {
  it("creates a single transaction with payment method", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.transactions.create({
      date: "2026-03-24",
      description: "Almoço",
      category: "alimentacao_fora",
      amount: "25.00",
      paymentMethod: "debito",
    });

    expect(result).toHaveProperty("ids");
    expect(result.ids).toHaveLength(1);
  });

  it("creates a single transaction with pix", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.transactions.create({
      date: "2026-03-24",
      description: "Café",
      category: "alimentacao_fora",
      amount: "8.50",
      paymentMethod: "pix",
    });

    expect(result.ids).toHaveLength(1);
  });

  it("creates a single transaction with dinheiro", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.transactions.create({
      date: "2026-03-24",
      description: "Lanche",
      category: "alimentacao_fora",
      amount: "15.00",
      paymentMethod: "dinheiro",
    });

    expect(result.ids).toHaveLength(1);
  });

  it("creates installment transactions for credit card", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.transactions.create({
      date: "2026-03-24",
      description: "Tênis Nike",
      category: "compras_online",
      amount: "300.00",
      paymentMethod: "credito",
      installments: 3,
    });

    expect(result.ids).toHaveLength(3);
  });

  it("creates single transaction for credit card without installments", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.transactions.create({
      date: "2026-03-24",
      description: "Jantar",
      category: "alimentacao_fora",
      amount: "80.00",
      paymentMethod: "credito",
      installments: 1,
    });

    expect(result.ids).toHaveLength(1);
  });

  it("creates 12x installment transactions", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.transactions.create({
      date: "2026-03-24",
      description: "Celular",
      category: "compras_online",
      amount: "1200.00",
      paymentMethod: "credito",
      installments: 12,
    });

    expect(result.ids).toHaveLength(12);
  });

  it("rejects empty description", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.transactions.create({
        date: "2026-03-24",
        description: "",
        category: "alimentacao_fora",
        amount: "25.00",
        paymentMethod: "debito",
      })
    ).rejects.toThrow();
  });

  it("rejects invalid amount format", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.transactions.create({
        date: "2026-03-24",
        description: "Almoço",
        category: "alimentacao_fora",
        amount: "abc",
        paymentMethod: "debito",
      })
    ).rejects.toThrow();
  });

  it("rejects invalid payment method", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.transactions.create({
        date: "2026-03-24",
        description: "Almoço",
        category: "alimentacao_fora",
        amount: "25.00",
        paymentMethod: "bitcoin" as any,
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated users", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.transactions.create({
        date: "2026-03-24",
        description: "Almoço",
        category: "alimentacao_fora",
        amount: "25.00",
        paymentMethod: "debito",
      })
    ).rejects.toThrow();
  });
});

describe("transactions.list", () => {
  it("returns transactions for a given month", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.transactions.list({
      year: 2026,
      month: 3,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("description", "Almoço");
    expect(result[0]).toHaveProperty("paymentMethod", "debito");
    expect(result[0]).toHaveProperty("userName", "Test User");
    expect(result[1]).toHaveProperty("description", "Café");
    expect(result[1]).toHaveProperty("paymentMethod", "pix");
  });

  it("rejects unauthenticated users", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.transactions.list({ year: 2026, month: 3 })
    ).rejects.toThrow();
  });
});

describe("transactions.delete", () => {
  it("deletes a transaction", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.transactions.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("dashboard.summary", () => {
  it("returns monthly summary with budget info", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.summary({
      year: 2026,
      month: 3,
    });

    expect(result).toHaveProperty("dailyBudget", 66);
    expect(result).toHaveProperty("daysInMonth", 31);
    expect(result).toHaveProperty("monthlyBudget", 66 * 31);
    expect(result).toHaveProperty("totalSpent", 33.5);
    expect(result).toHaveProperty("accumulatedBalance");
    expect(result.accumulatedBalance).toBe(66 * 31 - 33.5);
  });

  it("includes payment method summary", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.summary({
      year: 2026,
      month: 3,
    });

    expect(result.paymentMethodSummary).toHaveLength(2);
    expect(result.paymentMethodSummary[0]).toHaveProperty("paymentMethod", "debito");
    expect(result.paymentMethodSummary[1]).toHaveProperty("paymentMethod", "pix");
  });
});

describe("settings", () => {
  it("returns user settings", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.settings.get();
    expect(result).toHaveProperty("dailyBudget", "66.00");
  });

  it("updates daily budget", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.settings.update({ dailyBudget: "80.00" });
    expect(result).toEqual({ success: true });
  });

  it("rejects invalid budget format", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.settings.update({ dailyBudget: "abc" })
    ).rejects.toThrow();
  });
});
