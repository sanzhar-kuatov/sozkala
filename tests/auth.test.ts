import { beforeAll, describe, expect, it } from "vitest";
import { cabinetRoleOf, homeFor, safeNextPath } from "@/lib/auth/roles";
import { signSessionToken, verifySessionToken } from "@/lib/auth/token";

describe("cabinet routing", () => {
  it("maps roles to their home", () => {
    expect(homeFor("STUDENT")).toBe("/student");
    expect(homeFor("ADMIN")).toBe("/admin");
  });

  it("finds the owner of a path", () => {
    expect(cabinetRoleOf("/teacher/tasks/new")).toBe("TEACHER");
    expect(cabinetRoleOf("/parent")).toBe("PARENT");
    expect(cabinetRoleOf("/login")).toBeNull();
    expect(cabinetRoleOf("/students")).toBeNull(); // not a prefix match
  });
});

describe("safeNextPath (open-redirect protection)", () => {
  it("keeps a path inside the user's own cabinet", () => {
    expect(safeNextPath("/student/rewards", "STUDENT")).toBe("/student/rewards");
  });
  it("rejects another role's cabinet", () => {
    expect(safeNextPath("/admin/users", "STUDENT")).toBe("/student");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined])(
    "rejects %s",
    (next) => {
      expect(safeNextPath(next, "TEACHER")).toBe("/teacher");
    },
  );
  it("sends public pages to the cabinet", () => {
    expect(safeNextPath("/login", "PARENT")).toBe("/parent");
  });
});

describe("session token", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-123";
  });
  const future = () => new Date(Date.now() + 60_000);

  it("round-trips the claims", async () => {
    const token = await signSessionToken({ sid: "s1", uid: "u1", role: "PARENT" }, future());
    expect(await verifySessionToken(token)).toEqual({ sid: "s1", uid: "u1", role: "PARENT" });
  });

  it("rejects a tampered token (e.g. role changed to ADMIN)", async () => {
    const token = await signSessionToken({ sid: "s1", uid: "u1", role: "STUDENT" }, future());
    const [h, , sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sid: "s1", uid: "u1", role: "ADMIN" })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forged}.${sig}`)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signSessionToken({ sid: "s1", uid: "u1", role: "STUDENT" }, new Date(Date.now() - 1000));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSessionToken({ sid: "s1", uid: "u1", role: "STUDENT" }, future());
    process.env.AUTH_SECRET = "another-secret-another-secret-another-1";
    expect(await verifySessionToken(token)).toBeNull();
    process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-123";
  });

  it("rejects garbage", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
  });
});
