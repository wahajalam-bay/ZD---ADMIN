"use server";

import { revalidatePath } from "next/cache";
import { requirePropertyAccess, requirePublisher, requireReviewer } from "@/server/permissions";
import { isoDateSchema, returnPayload, reviewDecisionPayload, uuidSchema } from "@/lib/validation";
import {
  approveSubmission,
  publishSubmission,
  publishWeekForProperty,
  returnSubmission,
} from "@/server/services/review-service";
import { weekStartOf } from "@/lib/week";
import { runAction, type ActionResult } from "./action-result";

function revalidateAfterReview() {
  revalidatePath("/review", "layout");
  revalidatePath("/entry", "layout");
  revalidatePath("/command-center", "layout");
}

export async function returnSubmissionAction(raw: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireReviewer();
    const { kind, id, reason } = returnPayload.parse(raw);
    await returnSubmission(user, kind, id, reason);
    revalidateAfterReview();
    return undefined;
  });
}

export async function approveSubmissionAction(raw: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireReviewer();
    const { kind, id, note } = reviewDecisionPayload.parse(raw);
    await approveSubmission(user, kind, id, note);
    revalidateAfterReview();
    return undefined;
  });
}

export async function publishSubmissionAction(raw: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requirePublisher();
    const { kind, id } = reviewDecisionPayload.parse(raw);
    await publishSubmission(user, kind, id);
    revalidateAfterReview();
    return undefined;
  });
}

/** Publishes every approved submission for one property + reporting week. */
export async function publishWeekAction(
  propertyId: string,
  weekStartRaw: string,
): Promise<ActionResult<{ published: number }>> {
  return runAction(async () => {
    const user = await requirePublisher();
    uuidSchema.parse(propertyId);
    const weekStart = weekStartOf(isoDateSchema.parse(weekStartRaw));
    await requirePropertyAccess(propertyId);
    const result = await publishWeekForProperty(user, propertyId, weekStart);
    revalidateAfterReview();
    return result;
  });
}
