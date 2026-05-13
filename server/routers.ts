import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createTransaction,
  getTransactionsByFamilyAndMonth,
  deleteTransaction,
  updateTransaction,
  getDailySummary,
  getCategorySummary,
  getPaymentMethodSummary,
  getUserSettings,
  updateUserSettings,
  createFamily,
  getFamilyByInviteCode,
  joinFamily,
  getUserFamily,
  getFamilyMembers,
  getFamilyMemberIds,
  leaveFamily,
  createIncome,
  getIncomeByUserAndMonth,
  getIncomeSummaryByMonth,
  deleteIncome,
  createCreditCardTransaction,
  getCreditCardTransactionsByUserAndBillCycle,
  getCreditCardSummaryByBillCycle,
  deleteCreditCardTransaction,
  getCardSettings,
  updateCardSettings,
  getDb,
} from "./db";
import { creditCardTransactions } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const categoryEnum = z.enum([
  "alimentacao_fora",
  "lazer",
  "compras_online",
  "mimos_outros",
  "supermercado",
  "pet",
]);

const paymentMethodEnum = z.enum([
  "debito",
  "credito",
  "pix",
  "dinheiro",
]);

const incomeSourceEnum = z.enum([
  "comissão",
  "salário",
  "freelance",
  "outro",
]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  family: router({
    // Get current user's family info
    get: protectedProcedure.query(async ({ ctx }) => {
      return getUserFamily(ctx.user.id);
    }),

    // Create a new family
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        // Check if user already in a family
        const existing = await getUserFamily(ctx.user.id);
        if (existing) {
          throw new Error("Você já faz parte de uma família. Saia primeiro para criar outra.");
        }
        return createFamily(input.name, ctx.user.id);
      }),

    // Join a family by invite code
    join: protectedProcedure
      .input(z.object({ inviteCode: z.string().min(4).max(8) }))
      .mutation(async ({ ctx, input }) => {
        // Check if user already in a family
        const existing = await getUserFamily(ctx.user.id);
        if (existing) {
          throw new Error("Você já faz parte de uma família. Saia primeiro para entrar em outra.");
        }

        const family = await getFamilyByInviteCode(input.inviteCode.toUpperCase());
        if (!family) {
          throw new Error("Código de convite inválido. Verifique e tente novamente.");
        }

        const result = await joinFamily(family.id, ctx.user.id);
        if (result.alreadyMember) {
          throw new Error("Você já é membro desta família.");
        }

        return { familyName: family.name };
      }),

    // Get family members
    members: protectedProcedure.query(async ({ ctx }) => {
      const family = await getUserFamily(ctx.user.id);
      if (!family) return [];
      return getFamilyMembers(family.familyId);
    }),

    // Leave family
    leave: protectedProcedure.mutation(async ({ ctx }) => {
      await leaveFamily(ctx.user.id);
      return { success: true };
    }),
  }),

  transactions: router({
    create: protectedProcedure
      .input(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          description: z.string().min(1).max(255),
          category: categoryEnum,
          amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
          paymentMethod: paymentMethodEnum,
          installments: z.number().int().min(1).max(48).default(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const ids: number[] = [];

        if (input.paymentMethod === "credito" && input.installments > 1) {
          const totalAmount = parseFloat(input.amount);
          const installmentAmount = (totalAmount / input.installments).toFixed(2);

          for (let i = 1; i <= input.installments; i++) {
            const baseDate = new Date(input.date + "T12:00:00");
            const installmentDate = new Date(baseDate);
            installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
            const dateStr = `${installmentDate.getFullYear()}-${String(installmentDate.getMonth() + 1).padStart(2, "0")}-${String(installmentDate.getDate()).padStart(2, "0")}`;

            const id = await createTransaction({
              userId: ctx.user.id,
              date: dateStr,
              description: input.description,
              category: input.category,
              amount: installmentAmount,
              paymentMethod: input.paymentMethod,
              installments: input.installments,
              installmentNumber: i,
            });
            ids.push(id);
          }
        } else {
          const id = await createTransaction({
            userId: ctx.user.id,
            date: input.date,
            description: input.description,
            category: input.category,
            amount: input.amount,
            paymentMethod: input.paymentMethod,
            installments: 1,
            installmentNumber: 1,
          });
          ids.push(id);
        }

        return { ids };
      }),

    list: protectedProcedure
      .input(
        z.object({
          year: z.number().int().min(2020).max(2100),
          month: z.number().int().min(1).max(12),
        })
      )
      .query(async ({ ctx, input }) => {
        const memberIds = await getFamilyMemberIds(ctx.user.id);
        return getTransactionsByFamilyAndMonth(memberIds, input.year, input.month);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        // Family members can delete each other's transactions
        const memberIds = await getFamilyMemberIds(ctx.user.id);
        await deleteTransaction(input.id, memberIds);
        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          description: z.string().min(1).max(255).optional(),
          category: categoryEnum.optional(),
          amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
          paymentMethod: paymentMethodEnum.optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...updateData } = input;
        await updateTransaction(id, updateData);
        return { success: true };
      }),
  }),

  dashboard: router({
    summary: protectedProcedure
      .input(
        z.object({
          year: z.number().int().min(2020).max(2100),
          month: z.number().int().min(1).max(12),
        })
      )
      .query(async ({ ctx, input }) => {
        const memberIds = await getFamilyMemberIds(ctx.user.id);

        const [dailySummary, categorySummary, paymentMethodSummary, settings] = await Promise.all([
          getDailySummary(memberIds, input.year, input.month),
          getCategorySummary(memberIds, input.year, input.month),
          getPaymentMethodSummary(memberIds, input.year, input.month),
          getUserSettings(ctx.user.id),
        ]);

        const dailyBudget = parseFloat(settings.dailyBudget);
        const daysInMonth = new Date(input.year, input.month, 0).getDate();
        const monthlyBudget = dailyBudget * daysInMonth;

        const totalSpent = dailySummary.reduce(
          (acc, day) => acc + parseFloat(day.totalSpent),
          0
        );

        const accumulatedBalance = monthlyBudget - totalSpent;

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();

        let daysElapsed: number;
        if (input.year === currentYear && input.month === currentMonth) {
          daysElapsed = currentDay;
        } else if (
          input.year < currentYear ||
          (input.year === currentYear && input.month < currentMonth)
        ) {
          daysElapsed = daysInMonth;
        } else {
          daysElapsed = 0;
        }

        return {
          dailyBudget,
          daysInMonth,
          monthlyBudget,
          totalSpent,
          accumulatedBalance,
          daysElapsed,
          averageDaily: daysElapsed > 0 ? totalSpent / daysElapsed : 0,
          dailySummary,
          categorySummary,
          paymentMethodSummary,
        };
      }),
  }),

  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getUserSettings(ctx.user.id);
    }),
    update: protectedProcedure
      .input(z.object({ dailyBudget: z.string().regex(/^\d+(\.\d{1,2})?$/) }))
      .mutation(async ({ ctx, input }) => {
        await updateUserSettings(ctx.user.id, input.dailyBudget);
        return { success: true };
      }),
  }),

  income: router({
    create: protectedProcedure
      .input(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          description: z.string().min(1).max(255),
          amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
          source: incomeSourceEnum.default("comissão"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = await createIncome({
          userId: ctx.user.id,
          date: input.date,
          description: input.description,
          amount: input.amount,
          source: input.source,
        });
        return { id };
      }),

    list: protectedProcedure
      .input(
        z.object({
          year: z.number().int().min(2020).max(2100),
          month: z.number().int().min(1).max(12),
        })
      )
      .query(async ({ ctx, input }) => {
        return getIncomeByUserAndMonth(ctx.user.id, input.year, input.month);
      }),

    summary: protectedProcedure
      .input(
        z.object({
          year: z.number().int().min(2020).max(2100),
          month: z.number().int().min(1).max(12),
        })
      )
      .query(async ({ ctx, input }) => {
        return getIncomeSummaryByMonth(ctx.user.id, input.year, input.month);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await deleteIncome(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  creditCard: router({
    create: protectedProcedure
      .input(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          description: z.string().min(1).max(255),
          amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
          category: z.string().min(1).max(100),
          installments: z.number().int().min(1).max(48).default(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const ids: number[] = [];
        const settings = await getCardSettings(ctx.user.id);
        const closingDay = settings.closingDay;

        function calculateBillCycle(dateStr: string, closingDay: number): string {
          const [year, month, day] = dateStr.split("-").map(Number);
          const dateNum = day;

          if (dateNum < closingDay) {
            return `${year}-${String(month).padStart(2, "0")}`;
          } else {
            const nextMonth = month === 12 ? 1 : month + 1;
            const nextYear = month === 12 ? year + 1 : year;
            return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
          }
        }

        // A função createCreditCardTransaction já cuida da distribuição de parcelas
        const id = await createCreditCardTransaction({
          userId: ctx.user.id,
          date: input.date,
          description: input.description,
          amount: input.amount,
          category: input.category,
          installments: input.installments,
        });

        return { ids: [id] };
      }),

    listByBillCycle: protectedProcedure
      .input(z.object({ billCycle: z.string().regex(/^\d{4}-\d{2}$/) }))
      .query(async ({ ctx, input }) => {
        return getCreditCardTransactionsByUserAndBillCycle(ctx.user.id, input.billCycle);
      }),

    summaryByBillCycle: protectedProcedure
      .input(z.object({ billCycle: z.string().regex(/^\d{4}-\d{2}$/) }))
      .query(async ({ ctx, input }) => {
        return getCreditCardSummaryByBillCycle(ctx.user.id, input.billCycle);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await deleteCreditCardTransaction(input.id, ctx.user.id);
        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          description: z.string().min(1).max(255).optional(),
          amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
          category: z.string().min(1).max(100).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const updates: Record<string, any> = {};
        if (input.date) updates.date = input.date;
        if (input.description) updates.description = input.description;
        if (input.amount) updates.amount = input.amount;
        if (input.category) updates.category = input.category;

        await db
          .update(creditCardTransactions)
          .set(updates)
          .where(and(eq(creditCardTransactions.id, input.id), eq(creditCardTransactions.userId, ctx.user.id)));

        return { success: true };
      }),
  }),

  cardSettings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getCardSettings(ctx.user.id);
    }),
    update: protectedProcedure
      .input(
        z.object({
          cardName: z.string().min(1).max(100).optional(),
          closingDay: z.number().int().min(1).max(31).optional(),
          dueDay: z.number().int().min(1).max(31).optional(),
          limit: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateCardSettings(ctx.user.id, input);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
