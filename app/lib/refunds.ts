import { formatPrice } from "~/lib/utils";

// See GLOSSARY.md: Refund Request, Refund Window, Refund Eligibility.

export const REFUND_WINDOW_DAYS = 14;
export const REFUND_WATCH_LIMIT_SECONDS = 2 * 60 * 60;
export const REFUND_COMPLETION_LIMIT = 0.5;

export type RefundIneligibleReason =
  | "not_purchased"
  | "already_requested"
  | "claimed_team_seat"
  | "outside_window"
  | "completed_too_much"
  | "watched_too_much";

export const REFUND_INELIGIBLE_RESPONSES: Record<
  RefundIneligibleReason,
  { message: string; status: number }
> = {
  not_purchased: { message: "You have not bought this course.", status: 403 },
  already_requested: {
    message: "You have already made a Refund Request for this purchase.",
    status: 409,
  },
  claimed_team_seat: {
    message: "A claimed team seat cannot be refunded.",
    status: 403,
  },
  outside_window: {
    message: `The ${REFUND_WINDOW_DAYS}-day Refund Window has closed.`,
    status: 403,
  },
  completed_too_much: {
    message: "You have completed too much of this course to request a refund.",
    status: 403,
  },
  watched_too_much: {
    message: "You have watched too much of this course to request a refund.",
    status: 403,
  },
};

export type RefundEligibilityFacts = {
  purchasedAt: string;
  today: Date;
  hasRefundRequest: boolean;
  hasClaimedTeamSeat: boolean;
  lessonCount: number;
  completedLessonCount: number;
  watchedSeconds: number;
};

export type RefundEligibility =
  | { eligible: true; lastDayOfWindow: string }
  | { eligible: false; reason: RefundIneligibleReason };

// The window is counted in whole calendar days, not hours — someone who buys
// at 23:00 still gets the whole of their fourteenth day.
function calendarDay(when: Date): string {
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${when.getFullYear()}-${month}-${day}`;
}

export function checkRefundEligibility(
  facts: RefundEligibilityFacts
): RefundEligibility {
  // One Refund Request per purchase: Approved and Declined are final.
  if (facts.hasRefundRequest) {
    return { eligible: false, reason: "already_requested" };
  }

  if (facts.hasClaimedTeamSeat) {
    return { eligible: false, reason: "claimed_team_seat" };
  }

  const purchasedAt = new Date(facts.purchasedAt);
  const windowEnd = new Date(purchasedAt);
  windowEnd.setDate(windowEnd.getDate() + REFUND_WINDOW_DAYS);
  const lastDayOfWindow = calendarDay(windowEnd);
  const today = calendarDay(facts.today);

  if (today < calendarDay(purchasedAt) || today > lastDayOfWindow) {
    return { eligible: false, reason: "outside_window" };
  }

  if (
    facts.lessonCount > 0 &&
    facts.completedLessonCount / facts.lessonCount >= REFUND_COMPLETION_LIMIT
  ) {
    return { eligible: false, reason: "completed_too_much" };
  }

  if (facts.watchedSeconds >= REFUND_WATCH_LIMIT_SECONDS) {
    return { eligible: false, reason: "watched_too_much" };
  }

  return { eligible: true, lastDayOfWindow };
}

/**
 * The confirmation the Learner gets in their inbox. There is no mail
 * transport wired up yet, so the built message goes to the server log.
 */
export function buildRefundRequestEmail(input: {
  learnerName: string;
  learnerEmail: string;
  courseTitle: string;
  refundAmount: number;
}) {
  return {
    to: input.learnerEmail,
    subject: `Refund Request received — ${input.courseTitle}`,
    body: [
      `Hi ${input.learnerName},`,
      "",
      `We have your Refund Request for "${input.courseTitle}".`,
      `If it is approved, we will refund ${formatPrice(input.refundAmount)}, the amount you paid, and your access to the course will end.`,
      "",
      "Someone on our team reads every Refund Request. You do not need to do anything else — we will email you again once it has been approved or declined.",
      "",
      "— The Cadence team",
    ].join("\n"),
  };
}
