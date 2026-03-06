// src/lib/__tests__/featureFlags.test.ts
// Unit tests for src/lib/featureFlags.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { env } from "../../config/env";

vi.mock("../../config/env", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    JWT_SECRET: "test-secret",
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    N8N_WEBHOOK_SECRET: "n8n_x",
    NODE_ENV: "test",
    JWT_EXPIRES_IN: "30d",
    BCRYPT_SALT_ROUNDS: 10,
    BOOKINGS_ENABLED: true,
    PAYOUTS_ENABLED: false,
    CREDITS_ENABLED: true,
    REFUNDS_ENABLED: true,
    WORKERS_ENABLED: true,
    USE_EVENT_BASED_NOTIFICATIONS: true,
  },
}));

// Import after mock so getters read the mutable mock object at call time
import {
  featureFlags,
  isPaymentKillSwitchActive,
  isBookingKillSwitchActive,
  requireFeature,
} from "../featureFlags";

const mutableEnv = env as Record<string, unknown>;

function resetEnv() {
  mutableEnv.BOOKINGS_ENABLED = true;
  mutableEnv.PAYOUTS_ENABLED = false;
  mutableEnv.CREDITS_ENABLED = true;
  mutableEnv.REFUNDS_ENABLED = true;
  mutableEnv.WORKERS_ENABLED = true;
  mutableEnv.USE_EVENT_BASED_NOTIFICATIONS = true;
  mutableEnv.NODE_ENV = "test";
}

beforeEach(resetEnv);

// =====================================================================
// featureFlags getters
// =====================================================================

describe("featureFlags.bookingsEnabled", () => {
  it("returns true when BOOKINGS_ENABLED is true", () => {
    mutableEnv.BOOKINGS_ENABLED = true;
    expect(featureFlags.bookingsEnabled).toBe(true);
  });

  it("returns false when BOOKINGS_ENABLED is false", () => {
    mutableEnv.BOOKINGS_ENABLED = false;
    expect(featureFlags.bookingsEnabled).toBe(false);
  });
});

describe("featureFlags.payoutsEnabled", () => {
  it("returns false when PAYOUTS_ENABLED is false", () => {
    mutableEnv.PAYOUTS_ENABLED = false;
    expect(featureFlags.payoutsEnabled).toBe(false);
  });

  it("returns true when PAYOUTS_ENABLED is true", () => {
    mutableEnv.PAYOUTS_ENABLED = true;
    expect(featureFlags.payoutsEnabled).toBe(true);
  });
});

describe("featureFlags.creditsEnabled", () => {
  it("returns true when CREDITS_ENABLED is true", () => {
    mutableEnv.CREDITS_ENABLED = true;
    expect(featureFlags.creditsEnabled).toBe(true);
  });

  it("returns false when CREDITS_ENABLED is false", () => {
    mutableEnv.CREDITS_ENABLED = false;
    expect(featureFlags.creditsEnabled).toBe(false);
  });
});

describe("featureFlags.refundsEnabled", () => {
  it("returns true when REFUNDS_ENABLED is true", () => {
    mutableEnv.REFUNDS_ENABLED = true;
    expect(featureFlags.refundsEnabled).toBe(true);
  });

  it("returns false when REFUNDS_ENABLED is false", () => {
    mutableEnv.REFUNDS_ENABLED = false;
    expect(featureFlags.refundsEnabled).toBe(false);
  });
});

describe("featureFlags.workersEnabled", () => {
  it("returns true when WORKERS_ENABLED is true", () => {
    mutableEnv.WORKERS_ENABLED = true;
    expect(featureFlags.workersEnabled).toBe(true);
  });

  it("returns false when WORKERS_ENABLED is false", () => {
    mutableEnv.WORKERS_ENABLED = false;
    expect(featureFlags.workersEnabled).toBe(false);
  });
});

describe("featureFlags.eventNotificationsEnabled", () => {
  it("returns true when USE_EVENT_BASED_NOTIFICATIONS is true", () => {
    mutableEnv.USE_EVENT_BASED_NOTIFICATIONS = true;
    expect(featureFlags.eventNotificationsEnabled).toBe(true);
  });

  it("returns false when USE_EVENT_BASED_NOTIFICATIONS is false", () => {
    mutableEnv.USE_EVENT_BASED_NOTIFICATIONS = false;
    expect(featureFlags.eventNotificationsEnabled).toBe(false);
  });
});

// =====================================================================
// isPaymentKillSwitchActive
// =====================================================================

describe("isPaymentKillSwitchActive", () => {
  it("returns true when payouts disabled and env is production", () => {
    mutableEnv.PAYOUTS_ENABLED = false;
    mutableEnv.NODE_ENV = "production";
    expect(isPaymentKillSwitchActive()).toBe(true);
  });

  it("returns false when payouts are enabled in production", () => {
    mutableEnv.PAYOUTS_ENABLED = true;
    mutableEnv.NODE_ENV = "production";
    expect(isPaymentKillSwitchActive()).toBe(false);
  });

  it("returns false when env is not production even if payouts disabled", () => {
    mutableEnv.PAYOUTS_ENABLED = false;
    mutableEnv.NODE_ENV = "test";
    expect(isPaymentKillSwitchActive()).toBe(false);
  });

  it("returns false when env is development", () => {
    mutableEnv.PAYOUTS_ENABLED = false;
    mutableEnv.NODE_ENV = "development";
    expect(isPaymentKillSwitchActive()).toBe(false);
  });

  it("returns false when both payouts enabled and env is production", () => {
    mutableEnv.PAYOUTS_ENABLED = true;
    mutableEnv.NODE_ENV = "production";
    expect(isPaymentKillSwitchActive()).toBe(false);
  });
});

// =====================================================================
// isBookingKillSwitchActive
// =====================================================================

describe("isBookingKillSwitchActive", () => {
  it("returns false when bookings are enabled", () => {
    mutableEnv.BOOKINGS_ENABLED = true;
    expect(isBookingKillSwitchActive()).toBe(false);
  });

  it("returns true when bookings are disabled", () => {
    mutableEnv.BOOKINGS_ENABLED = false;
    expect(isBookingKillSwitchActive()).toBe(true);
  });

  it("is independent of NODE_ENV", () => {
    mutableEnv.BOOKINGS_ENABLED = false;
    mutableEnv.NODE_ENV = "test";
    expect(isBookingKillSwitchActive()).toBe(true);

    mutableEnv.NODE_ENV = "production";
    expect(isBookingKillSwitchActive()).toBe(true);
  });
});

// =====================================================================
// requireFeature
// =====================================================================

describe("requireFeature", () => {
  it("does not throw when feature is enabled", () => {
    mutableEnv.BOOKINGS_ENABLED = true;
    expect(() => requireFeature("bookingsEnabled", "create a booking")).not.toThrow();
  });

  it("throws when feature is disabled", () => {
    mutableEnv.BOOKINGS_ENABLED = false;
    expect(() => requireFeature("bookingsEnabled", "create a booking")).toThrow(
      "Feature bookingsEnabled is disabled. Cannot create a booking."
    );
  });

  it("throws for payoutsEnabled when disabled", () => {
    mutableEnv.PAYOUTS_ENABLED = false;
    expect(() => requireFeature("payoutsEnabled", "process payout")).toThrow(
      "Feature payoutsEnabled is disabled. Cannot process payout."
    );
  });

  it("does not throw for payoutsEnabled when enabled", () => {
    mutableEnv.PAYOUTS_ENABLED = true;
    expect(() => requireFeature("payoutsEnabled", "process payout")).not.toThrow();
  });

  it("throws for creditsEnabled when disabled", () => {
    mutableEnv.CREDITS_ENABLED = false;
    expect(() => requireFeature("creditsEnabled", "purchase credits")).toThrow(
      "Feature creditsEnabled is disabled"
    );
  });

  it("throws for refundsEnabled when disabled", () => {
    mutableEnv.REFUNDS_ENABLED = false;
    expect(() => requireFeature("refundsEnabled", "issue refund")).toThrow(
      "Feature refundsEnabled is disabled"
    );
  });

  it("throws for workersEnabled when disabled", () => {
    mutableEnv.WORKERS_ENABLED = false;
    expect(() => requireFeature("workersEnabled", "run worker")).toThrow(
      "Feature workersEnabled is disabled"
    );
  });

  it("throws for eventNotificationsEnabled when disabled", () => {
    mutableEnv.USE_EVENT_BASED_NOTIFICATIONS = false;
    expect(() =>
      requireFeature("eventNotificationsEnabled", "send notification")
    ).toThrow("Feature eventNotificationsEnabled is disabled");
  });

  it("error message includes the action name", () => {
    mutableEnv.BOOKINGS_ENABLED = false;
    expect(() => requireFeature("bookingsEnabled", "book a cleaner")).toThrow(
      "Cannot book a cleaner"
    );
  });
});
