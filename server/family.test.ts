import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// State simulado para os testes
const familyStore: Record<number, { familyId: number; familyName: string; role: string }> = {};
const families: Record<number, { id: number; name: string; inviteCode: string; createdBy: number }> = {};
let nextFamilyId = 1;

vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    getUserFamily: vi.fn().mockImplementation(async (userId: number) => {
      return familyStore[userId] ?? null;
    }),
    createFamily: vi.fn().mockImplementation(async (name: string, userId: number) => {
      const familyId = nextFamilyId++;
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      families[familyId] = { id: familyId, name, inviteCode, createdBy: userId };
      familyStore[userId] = { familyId, familyName: name, role: "admin" };
      return { familyId, inviteCode };
    }),
    getFamilyByInviteCode: vi.fn().mockImplementation(async (code: string) => {
      return Object.values(families).find((f) => f.inviteCode === code) ?? null;
    }),
    joinFamily: vi.fn().mockImplementation(async (familyId: number, userId: number) => {
      const alreadyMember = !!familyStore[userId];
      if (!alreadyMember) {
        const family = families[familyId];
        familyStore[userId] = { familyId, familyName: family?.name ?? "", role: "member" };
      }
      return { alreadyMember };
    }),
    getFamilyMembers: vi.fn().mockImplementation(async (familyId: number) => {
      return Object.entries(familyStore)
        .filter(([, v]) => v.familyId === familyId)
        .map(([userId, v]) => ({
          userId: Number(userId),
          name: `User ${userId}`,
          role: v.role,
          joinedAt: new Date(),
        }));
    }),
    leaveFamily: vi.fn().mockImplementation(async (userId: number) => {
      delete familyStore[userId];
    }),
    getFamilyMemberIds: vi.fn().mockResolvedValue([1]),
  };
});

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
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
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
