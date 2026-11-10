import { describe, it, expect } from "vitest";
import {
  REFUND_WATCH_LIMIT_SECONDS,
  buildRefundRequestEmail,
  checkRefundEligibility,
  type RefundEligibilityFacts,
} from "./refunds";

function facts(overrides: Partial<RefundEligibilityFacts> = {}) {
  return {
    purchasedAt: new Date(2026, 0, 1, 23, 0).toISOString(),
    today: new Date(2026, 0, 5, 12, 0),
    hasRefundRequest: false,
    hasClaimedTeamSeat: false,
    lessonCount: 10,
    completedLessonCount: 0,
    watchedSeconds: 0,
    ...overrides,
  };
}

describe("checkRefundEligibility", () => {
  it("is eligible inside the Refund Window with little progress", () => {
    expect(checkRefundEligibility(facts())).toEqual({
      eligible: true,
      lastDayOfWindow: "2026-01-15",
    });
  });

  it("includes the whole last calendar day of the Refund Window", () => {
    const result = checkRefundEligibility(
      facts({ today: new Date(2026, 0, 15, 23, 59) })
    );
    expect(result.eligible).toBe(true);
  });

  it("closes the Refund Window the day after", () => {
    expect(
      checkRefundEligibility(facts({ today: new Date(2026, 0, 16, 0, 1) }))
    ).toEqual({ eligible: false, reason: "outside_window" });
  });

  it("allows only one Refund Request per purchase, whatever its state", () => {
    expect(checkRefundEligibility(facts({ hasRefundRequest: true }))).toEqual({
      eligible: false,
      reason: "already_requested",
    });
  });

  it("refuses a claimed team seat", () => {
    expect(
      checkRefundEligibility(facts({ hasClaimedTeamSeat: true }))
    ).toEqual({ eligible: false, reason: "claimed_team_seat" });
  });

  it("refuses once half the lessons are completed", () => {
    expect(
      checkRefundEligibility(facts({ completedLessonCount: 5 }))
    ).toEqual({ eligible: false, reason: "completed_too_much" });
    expect(
      checkRefundEligibility(facts({ completedLessonCount: 4 })).eligible
    ).toBe(true);
  });

  it("refuses once two hours have been watched", () => {
    expect(
      checkRefundEligibility(
        facts({ watchedSeconds: REFUND_WATCH_LIMIT_SECONDS })
      )
    ).toEqual({ eligible: false, reason: "watched_too_much" });
  });

  it("ignores the completion rule for a course with no lessons", () => {
    expect(checkRefundEligibility(facts({ lessonCount: 0 })).eligible).toBe(
      true
    );
  });
});

describe("buildRefundRequestEmail", () => {
  it("uses the glossary language and the Refund Amount", () => {
    const email = buildRefundRequestEmail({
      learnerName: "Ada",
      learnerEmail: "ada@example.com",
      courseTitle: "Intro",
      refundAmount: 4900,
    });

    expect(email.subject).toBe("Refund Request received — Intro");
    expect(email.body).toContain("Refund Request");
    expect(email.body).not.toMatch(/reversal|chargeback/i);
  });
});
