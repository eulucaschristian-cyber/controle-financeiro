import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", [
    "debito",
    "credito",
    "pix",
    "dinheiro",
  ]).notNull().default("debito"),
  installments: int("installments").default(1).notNull(),
  installmentNumber: int("installmentNumber").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  dailyBudget: decimal("dailyBudget", { precision: 10, scale: 2 }).notNull().default("66.00"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;

export const families = mysqlTable("families", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  inviteCode: varchar("inviteCode", { length: 8 }).notNull().unique(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Family = typeof families.$inferSelect;
export type InsertFamily = typeof families.$inferInsert;

export const familyMembers = mysqlTable("family_members", {
  id: int("id").autoincrement().primaryKey(),
  familyId: int("familyId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("memberRole", ["admin", "member"]).default("member").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = typeof familyMembers.$inferInsert;

export const income = mysqlTable("income", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  source: varchar("source", { length: 100 }).notNull().default("comissão"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Income = typeof income.$inferSelect;
export type InsertIncome = typeof income.$inferInsert;

export const creditCardTransactions = mysqlTable("credit_card_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  installments: int("installments").default(1).notNull(),
  installmentNumber: int("installmentNumber").default(1).notNull(),
  billCycle: varchar("billCycle", { length: 20 }).notNull(),
  groupId: int("groupId"), // ID da compra original para rastrear parcelas
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditCardTransaction = typeof creditCardTransactions.$inferSelect;
export type InsertCreditCardTransaction = typeof creditCardTransactions.$inferInsert;

export const cardSettings = mysqlTable("card_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  cardName: varchar("cardName", { length: 100 }).notNull().default("Porto Seguro"),
  closingDay: int("closingDay").notNull().default(26),
  closingInterval: int("closingInterval").notNull().default(5),
  dueDay: int("dueDay").notNull().default(1),
  limit: decimal("limit", { precision: 10, scale: 2 }).notNull().default("5000.00"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CardSettings = typeof cardSettings.$inferSelect;
export type InsertCardSettings = typeof cardSettings.$inferInsert;

export const invoicePayments = mysqlTable("invoice_payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  billCycle: varchar("billCycle", { length: 20 }).notNull(),
  paidAt: date("paidAt", { mode: "string" }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type InsertInvoicePayment = typeof invoicePayments.$inferInsert;

export const customCategories = mysqlTable("custom_categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull().default("📦"),
  color: varchar("color", { length: 100 }).notNull().default("bg-gray-100 text-gray-700"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomCategory = typeof customCategories.$inferSelect;
export type InsertCustomCategory = typeof customCategories.$inferInsert;
