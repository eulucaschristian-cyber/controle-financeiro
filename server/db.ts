import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, transactions, userSettings, families, familyMembers, income, creditCardTransactions, cardSettings, type InsertTransaction } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// === FAMILY HELPERS ===

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createFamily(name: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const inviteCode = generateInviteCode();
  const result = await db.insert(families).values({ name, inviteCode, createdBy: userId });
  const familyId = result[0].insertId;

  // Add creator as admin member
  await db.insert(familyMembers).values({ familyId, userId, role: "admin" });

  return { familyId, inviteCode };
}

export async function getFamilyByInviteCode(inviteCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(families).where(eq(families.inviteCode, inviteCode)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function joinFamily(familyId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if already a member
  const existing = await db
    .select()
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)))
    .limit(1);

  if (existing.length > 0) return { alreadyMember: true };

  await db.insert(familyMembers).values({ familyId, userId, role: "member" });
  return { alreadyMember: false };
}

export async function getUserFamily(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const membership = await db
    .select({
      familyId: familyMembers.familyId,
      memberRole: familyMembers.role,
      familyName: families.name,
      inviteCode: families.inviteCode,
      createdBy: families.createdBy,
    })
    .from(familyMembers)
    .innerJoin(families, eq(familyMembers.familyId, families.id))
    .where(eq(familyMembers.userId, userId))
    .limit(1);

  if (membership.length === 0) return null;

  return membership[0];
}

export async function getFamilyMembers(familyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select({
      id: familyMembers.id,
      userId: familyMembers.userId,
      role: familyMembers.role,
      joinedAt: familyMembers.joinedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(familyMembers)
    .innerJoin(users, eq(familyMembers.userId, users.id))
    .where(eq(familyMembers.familyId, familyId));
}

export async function getFamilyMemberIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get user's family
  const membership = await db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .limit(1);

  if (membership.length === 0) return [userId];

  // Get all member IDs in the family
  const members = await db
    .select({ userId: familyMembers.userId })
    .from(familyMembers)
    .where(eq(familyMembers.familyId, membership[0].familyId));

  return members.map((m) => m.userId);
}

export async function leaveFamily(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(familyMembers).where(eq(familyMembers.userId, userId));
}

// === TRANSACTION HELPERS ===

export async function createTransaction(data: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transactions).values(data);
  return result[0].insertId;
}

export async function updateTransaction(id: number, data: Partial<InsertTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(transactions).set(data).where(eq(transactions.id, id));
}

export async function getTransactionById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      date: transactions.date,
      description: transactions.description,
      category: transactions.category,
      amount: transactions.amount,
      paymentMethod: transactions.paymentMethod,
      installments: transactions.installments,
      installmentNumber: transactions.installmentNumber,
      createdAt: transactions.createdAt,
      userName: users.name,
    })
    .from(transactions)
    .innerJoin(users, eq(transactions.userId, users.id))
    .where(eq(transactions.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

function getDateRange(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { startDate, endDate };
}

export async function getTransactionsByFamilyAndMonth(memberIds: number[], year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { startDate, endDate } = getDateRange(year, month);

  return db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      date: transactions.date,
      description: transactions.description,
      category: transactions.category,
      amount: transactions.amount,
      paymentMethod: transactions.paymentMethod,
      installments: transactions.installments,
      installmentNumber: transactions.installmentNumber,
      createdAt: transactions.createdAt,
      userName: users.name,
    })
    .from(transactions)
    .innerJoin(users, eq(transactions.userId, users.id))
    .where(
      and(
        inArray(transactions.userId, memberIds),
        sql`${transactions.date} >= ${startDate}`,
        sql`${transactions.date} < ${endDate}`
      )
    )
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
}

export async function deleteTransaction(id: number, memberIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(transactions).where(and(eq(transactions.id, id), inArray(transactions.userId, memberIds)));
}

export async function getDailySummary(memberIds: number[], year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { startDate, endDate } = getDateRange(year, month);

  return db
    .select({
      date: transactions.date,
      totalSpent: sql<string>`CAST(SUM(${transactions.amount}) AS CHAR)`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.userId, memberIds),
        sql`${transactions.date} >= ${startDate}`,
        sql`${transactions.date} < ${endDate}`
      )
    )
    .groupBy(transactions.date)
    .orderBy(transactions.date);
}

export async function getCategorySummary(memberIds: number[], year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { startDate, endDate } = getDateRange(year, month);

  return db
    .select({
      category: transactions.category,
      total: sql<string>`CAST(SUM(${transactions.amount}) AS CHAR)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.userId, memberIds),
        sql`${transactions.date} >= ${startDate}`,
        sql`${transactions.date} < ${endDate}`
      )
    )
    .groupBy(transactions.category);
}

export async function getPaymentMethodSummary(memberIds: number[], year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { startDate, endDate } = getDateRange(year, month);

  return db
    .select({
      paymentMethod: transactions.paymentMethod,
      total: sql<string>`CAST(SUM(${transactions.amount}) AS CHAR)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.userId, memberIds),
        sql`${transactions.date} >= ${startDate}`,
        sql`${transactions.date} < ${endDate}`
      )
    )
    .groupBy(transactions.paymentMethod);
}

// === SETTINGS HELPERS ===

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (result.length === 0) {
    await db.insert(userSettings).values({ userId, dailyBudget: "66.00" });
    return { userId, dailyBudget: "66.00" };
  }
  return result[0];
}

export async function updateUserSettings(userId: number, dailyBudget: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(userSettings)
    .values({ userId, dailyBudget })
    .onDuplicateKeyUpdate({ set: { dailyBudget } });
}

// === INCOME HELPERS ===

export async function createIncome(data: { userId: number; date: string; description: string; amount: string; source: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(income).values({
    userId: data.userId,
    date: data.date,
    description: data.description,
    amount: data.amount,
    source: data.source,
  });
  return result[0].insertId;
}

export async function getIncomeByUserAndMonth(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { startDate, endDate } = getDateRange(year, month);

  return db
    .select()
    .from(income)
    .where(
      and(
        eq(income.userId, userId),
        sql`${income.date} >= ${startDate}`,
        sql`${income.date} < ${endDate}`
      )
    )
    .orderBy(desc(income.date));
}

export async function getIncomeSummaryByMonth(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { startDate, endDate } = getDateRange(year, month);

  const result = await db
    .select({
      total: sql<string>`CAST(SUM(${income.amount}) AS CHAR)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(income)
    .where(
      and(
        eq(income.userId, userId),
        sql`${income.date} >= ${startDate}`,
        sql`${income.date} < ${endDate}`
      )
    );

  return result[0] || { total: "0", count: 0 };
}

export async function deleteIncome(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(income).where(and(eq(income.id, id), eq(income.userId, userId)));
}

// === CREDIT CARD HELPERS ===

export async function createCreditCardTransaction(data: { userId: number; date: string; description: string; amount: string; category: string; installments: number; billCycle?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Se for parcelado (installments > 1), criar múltiplas transações
  if (data.installments > 1) {
    // Parse da data corretamente
    const [year, month, day] = data.date.split('-').map(Number);
    const purchaseDate = new Date(year, month - 1, day); // month é 0-indexed
    const groupId = Math.floor(Math.random() * 1000000); // ID único para agrupar parcelas
    const insertIds: number[] = [];
    
    // Dividir o valor total pelas parcelas
    const totalAmount = parseFloat(data.amount);
    const installmentAmount = (totalAmount / data.installments).toFixed(2);
    
    for (let i = 1; i <= data.installments; i++) {
      // Calcular a data de cada parcela (primeira no mês da compra, depois nos próximos meses)
      const installmentDate = new Date(purchaseDate);
      installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
      const dateStr = `${installmentDate.getFullYear()}-${String(installmentDate.getMonth() + 1).padStart(2, '0')}-${String(installmentDate.getDate()).padStart(2, '0')}`;
      
      // Calcular o billCycle para esta parcela
      const billCycle = calculateBillCycle(dateStr);
      
      const result = await db.insert(creditCardTransactions).values({
        userId: data.userId,
        date: dateStr,
        description: data.description,
        amount: installmentAmount,
        category: data.category,
        installments: data.installments,
        installmentNumber: i,
        billCycle: billCycle,
        groupId: groupId,
      });
      insertIds.push(result[0].insertId);
    }
    return insertIds[0]; // Retorna o ID da primeira parcela
  } else {
    // Se não for parcelado, criar uma única transação
    const billCycle = data.billCycle || calculateBillCycle(data.date);
    const result = await db.insert(creditCardTransactions).values({
      userId: data.userId,
      date: data.date,
      description: data.description,
      amount: data.amount,
      category: data.category,
      installments: 1,
      installmentNumber: 1,
      billCycle: billCycle,
    });
    return result[0].insertId;
  }
}

// Função auxiliar para calcular billCycle baseado na data
function calculateBillCycle(date: string, closingDay: number = 26): string {
  // Parsear data manualmente para evitar problemas de timezone
  // Formato esperado: YYYY-MM-DD
  const [yearStr, monthStr, dayStr] = date.split('-');
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10) - 1;  // Converter para 0-indexed
  const year = parseInt(yearStr, 10);
  
  // Se o dia é ANTES do dia de fechamento, a fatura é deste mês
  // Se o dia é NO fechamento ou DEPOIS, a fatura é do próximo mês
  if (day < closingDay) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  } else {
    // Fatura do próximo mês
    let billMonth = month + 1;  // Próximo mês (0-indexed)
    let billYear = year;
    
    if (billMonth >= 12) {
      billMonth = 0;  // Janeiro do próximo ano
      billYear = year + 1;
    }
    
    // Converter para 1-indexed para o formato YYYY-MM
    return `${billYear}-${String(billMonth + 1).padStart(2, '0')}`;
  }
}

export async function getCreditCardTransactionsByUserAndBillCycle(userId: number, billCycle: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(creditCardTransactions)
    .where(
      and(
        eq(creditCardTransactions.userId, userId),
        eq(creditCardTransactions.billCycle, billCycle)
      )
    )
    .orderBy(desc(creditCardTransactions.date));
}

export async function getCreditCardSummaryByBillCycle(userId: number, billCycle: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      total: sql<string>`CAST(SUM(${creditCardTransactions.amount}) AS CHAR)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(creditCardTransactions)
    .where(
      and(
        eq(creditCardTransactions.userId, userId),
        eq(creditCardTransactions.billCycle, billCycle)
      )
    );

  return result[0] || { total: "0", count: 0 };
}

export async function deleteCreditCardTransaction(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(creditCardTransactions).where(and(eq(creditCardTransactions.id, id), eq(creditCardTransactions.userId, userId)));
}

// === CARD SETTINGS HELPERS ===

export async function getCardSettings(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(cardSettings).where(eq(cardSettings.userId, userId)).limit(1);
  if (result.length === 0) {
    await db.insert(cardSettings).values({
      userId,
      cardName: "Porto Seguro",
      closingDay: 26,
      dueDay: 1,
      limit: "5000.00",
    });
    return { userId, cardName: "Porto Seguro", closingDay: 26, dueDay: 1, limit: "5000.00" };
  }
  return result[0];
}

export async function updateCardSettings(userId: number, data: { cardName?: string; closingDay?: number; dueDay?: number; limit?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(cardSettings)
    .values({ userId, ...data })
    .onDuplicateKeyUpdate({ set: data });
}
