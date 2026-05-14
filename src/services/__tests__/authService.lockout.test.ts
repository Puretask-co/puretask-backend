// src/services/__tests__/authService.lockout.test.ts
// Unit tests for the account-lockout state machine (Playbook B.8).
//
// Mocks db/client.query and lib/auth.verifyPassword so we can drive
// loginUser through the locked / failed / success transitions without
// a real Postgres or bcrypt.

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted, so the mock fns must be created via
// vi.hoisted() (which is also hoisted) to be in scope at factory time.
const { queryMock, verifyPasswordMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
}));

vi.mock("../../db/client", () => ({
  query: queryMock,
  withTransaction: vi.fn(),
}));
vi.mock("../../lib/auth", () => ({
  hashPassword: vi.fn(),
  verifyPassword: verifyPasswordMock,
  UserRole: { client: "client", cleaner: "cleaner", admin: "admin" },
}));

import { loginUser } from "../authService";

const baseUser = {
  id: "u1",
  email: "test@example.com",
  password_hash: "$2a$10$fakehash",
  role: "client" as const,
  failed_login_attempts: 0,
  locked_until: null,
};

beforeEach(() => {
  queryMock.mockReset();
  verifyPasswordMock.mockReset();
  // Lower threshold so tests don't have to loop 5 times. authService
  // reads env at call time, so this takes effect immediately.
  process.env.LOGIN_LOCKOUT_THRESHOLD = "3";
});

function rows(...users: unknown[]) {
  return { rows: users, rowCount: users.length };
}

describe("loginUser lockout behavior (B.8)", () => {
  it("rejects already-locked accounts with 423 before bcrypt", async () => {
    const lockedUser = { ...baseUser, locked_until: new Date(Date.now() + 60_000).toISOString() };
    queryMock.mockResolvedValueOnce(rows(lockedUser)); // SELECT user

    await expect(loginUser("test@example.com", "anything")).rejects.toMatchObject({
      statusCode: 423,
      code: "ACCOUNT_LOCKED",
    });
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("increments the counter on a bad password without locking yet", async () => {
    queryMock.mockResolvedValueOnce(rows({ ...baseUser, failed_login_attempts: 1 })); // SELECT
    verifyPasswordMock.mockResolvedValueOnce(false);
    queryMock.mockResolvedValueOnce(rows()); // UPDATE

    await expect(loginUser("test@example.com", "wrong")).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });

    // The UPDATE call sets failed_login_attempts = 2, locked_until = null.
    const updateCall = queryMock.mock.calls[1]!;
    expect(updateCall[0]).toMatch(/UPDATE users/);
    expect(updateCall[1]).toEqual(["u1", 2, null]);
  });

  it("locks the account when threshold is reached", async () => {
    // Threshold is 3 — previous attempts = 2, this is the 3rd failure.
    queryMock.mockResolvedValueOnce(rows({ ...baseUser, failed_login_attempts: 2 }));
    verifyPasswordMock.mockResolvedValueOnce(false);
    queryMock.mockResolvedValueOnce(rows()); // UPDATE

    await expect(loginUser("test@example.com", "wrong")).rejects.toMatchObject({
      statusCode: 423,
      code: "ACCOUNT_LOCKED",
    });

    const updateCall = queryMock.mock.calls[1]!;
    expect(updateCall[1]![0]).toBe("u1");
    expect(updateCall[1]![1]).toBe(3);
    expect(updateCall[1]![2]).toBeInstanceOf(Date); // locked_until set
    expect((updateCall[1]![2] as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("resets counter on successful login when previously failed", async () => {
    queryMock.mockResolvedValueOnce(rows({ ...baseUser, failed_login_attempts: 2 }));
    verifyPasswordMock.mockResolvedValueOnce(true);
    queryMock.mockResolvedValueOnce(rows()); // UPDATE reset

    const user = await loginUser("test@example.com", "correct");
    expect(user.id).toBe("u1");

    const updateCall = queryMock.mock.calls[1]!;
    expect(updateCall[0]).toMatch(/failed_login_attempts = 0[\s\S]*locked_until = NULL/);
    expect(updateCall[1]).toEqual(["u1"]);
  });

  it("does not run reset UPDATE on success when counter was already 0", async () => {
    queryMock.mockResolvedValueOnce(rows(baseUser));
    verifyPasswordMock.mockResolvedValueOnce(true);

    await loginUser("test@example.com", "correct");

    // Only the initial SELECT — no reset UPDATE.
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("returns 401 (not 423) for an email that doesn't exist", async () => {
    queryMock.mockResolvedValueOnce(rows()); // no user
    await expect(loginUser("nobody@example.com", "anything")).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });
});
