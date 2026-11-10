import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  coupons,
  lessonProgress,
  lessons,
  modules,
  purchases,
  refunds,
  videoWatchEvents,
  LessonProgressStatus,
} from "~/db/schema";
import {
  checkRefundEligibility,
  type RefundIneligibleReason,
} from "~/lib/refunds";

function getLatestPurchase(userId: number, courseId: number) {
  return db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, userId), eq(purchases.courseId, courseId)))
    .orderBy(sql`${purchases.createdAt} desc`)
    .get();
}

function getLessonIdsForCourse(courseId: number): number[] {
  return db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .all()
    .map((row) => row.id);
}

function getCompletedLessonCount(userId: number, lessonIds: number[]) {
  if (lessonIds.length === 0) return 0;

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        inArray(lessonProgress.lessonId, lessonIds)
      )
    )
    .get();

  return result?.count ?? 0;
}

function getWatchedSeconds(userId: number, lessonIds: number[]) {
  if (lessonIds.length === 0) return 0;

  return db
    .select({
      furthest: sql<number>`max(${videoWatchEvents.positionSeconds})`,
    })
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, userId),
        inArray(videoWatchEvents.lessonId, lessonIds)
      )
    )
    .groupBy(videoWatchEvents.lessonId)
    .all()
    .reduce((total, row) => total + row.furthest, 0);
}

function hasRefundRequest(purchaseId: number) {
  return Boolean(
    db
      .select({ id: refunds.id })
      .from(refunds)
      .where(eq(refunds.purchaseId, purchaseId))
      .get()
  );
}

function hasClaimedTeamSeat(purchaseId: number) {
  return Boolean(
    db
      .select({ id: coupons.id })
      .from(coupons)
      .where(
        and(eq(coupons.purchaseId, purchaseId), isNotNull(coupons.redeemedAt))
      )
      .get()
  );
}

export type RefundOffer =
  | {
      eligible: true;
      purchaseId: number;
      refundAmount: number;
      lastDayOfWindow: string;
    }
  | { eligible: false; reason: RefundIneligibleReason };

/**
 * Whether this Learner may raise a Refund Request on their latest purchase of
 * the course, and for how much. The Refund Amount is always what was paid.
 */
export function getRefundOffer(userId: number, courseId: number): RefundOffer {
  const purchase = getLatestPurchase(userId, courseId);

  if (!purchase) return { eligible: false, reason: "not_purchased" };

  const lessonIds = getLessonIdsForCourse(courseId);
  const eligibility = checkRefundEligibility({
    purchasedAt: purchase.createdAt,
    today: new Date(),
    hasRefundRequest: hasRefundRequest(purchase.id),
    hasClaimedTeamSeat: hasClaimedTeamSeat(purchase.id),
    lessonCount: lessonIds.length,
    completedLessonCount: getCompletedLessonCount(userId, lessonIds),
    watchedSeconds: getWatchedSeconds(userId, lessonIds),
  });

  if (!eligibility.eligible) return eligibility;

  return {
    eligible: true,
    purchaseId: purchase.id,
    refundAmount: purchase.amountPaid,
    lastDayOfWindow: eligibility.lastDayOfWindow,
  };
}
