import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1, name: string = "Lucas"): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@example.com`,
    name,
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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("family router", () => {
  it("family.get returns null when user has no family", async () => {
    const { ctx } = createAuthContext(999, "NoFamily");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.family.get();
    expect(result).toBeNull();
  });

  it("family.create creates a family and returns invite code", async () => {
    const { ctx } = createAuthContext(1, "Lucas");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.family.create({ name: "Família Santos" });
    expect(result).toHaveProperty("familyId");
    expect(result).toHaveProperty("inviteCode");
    expect(typeof result.inviteCode).toBe("string");
    expect(result.inviteCode.length).toBe(6);
  });

  it("family.get returns family info after creation", async () => {
    const { ctx } = createAuthContext(1, "Lucas");
    const caller = appRouter.createCaller(ctx);

    const family = await caller.family.get();
    expect(family).not.toBeNull();
    // The family name is created in the first test, so it should be "Família Santos"
    expect(family?.familyName).toBeDefined();
  });

  it("family.members returns the creator as admin", async () => {
    const { ctx } = createAuthContext(1, "Lucas");
    const caller = appRouter.createCaller(ctx);

    const members = await caller.family.members();
    expect(members.length).toBeGreaterThanOrEqual(1);
    const admin = members.find((m) => m.userId === 1);
    expect(admin).toBeDefined();
    expect(admin?.role).toBe("admin");
  });

  it("family.create throws if user already in a family", async () => {
    const { ctx } = createAuthContext(1, "Lucas");
    const caller = appRouter.createCaller(ctx);

    // User 1 already has a family from the previous test
    await expect(caller.family.create({ name: "Outra Família" })).rejects.toThrow(
      "Você já faz parte de uma família"
    );
  });

  it("family.join throws with invalid invite code", async () => {
    const { ctx } = createAuthContext(998, "Stranger");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.family.join({ inviteCode: "XXXXXX" })).rejects.toThrow(
      "Código de convite inválido"
    );
  });

  it("family.leave removes user from family", async () => {
    const { ctx } = createAuthContext(1, "Lucas");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.family.leave();
    expect(result).toEqual({ success: true });

    const family = await caller.family.get();
    expect(family).toBeNull();
  });
});
