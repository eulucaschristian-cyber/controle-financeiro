import { Express } from "express";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export function registerOAuthRoutes(app: Express, baseURL: string) {
  console.log("[Auth] Using local auth mode");

  app.get("/auth/login", async (req, res) => {
    const db = await getDb();
    if (!db) return res.redirect("/");

    let user = await db.select().from(users).where(eq(users.openId, "local-user")).limit(1);

    if (user.length === 0) {
      await db.insert(users).values({
        openId: "local-user",
        name: "Lucas",
        email: "lucas@local.dev",
        loginMethod: "local",
        role: "admin",
        lastSignedIn: new Date(),
      });
      user = await db.select().from(users).where(eq(users.openId, "local-user")).limit(1);
    }

    res.cookie("session", JSON.stringify({ userId: user[0].id, openId: "local-user" }), {
      httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.redirect("/");
  });

  app.get("/auth/logout", (req, res) => {
    res.clearCookie("session");
    res.redirect("/");
  });
}

export function initOAuth(app: Express, baseURL: string) {
  return registerOAuthRoutes(app, baseURL);
}

export function getLoginUrl(baseURL?: string) {
  return "/auth/login";
}

export function getLogoutUrl(baseURL?: string) {
  return "/auth/logout";
}
