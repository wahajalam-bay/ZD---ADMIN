/**
 * Pure, dependency-free role/permission helpers.
 * These run on server AND client (for UI affordances), but authorization is
 * only authoritative when enforced via src/server/permissions.
 */
export const ROLES = ["SITE_USER", "ASSISTANT_MANAGER", "MANAGER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SITE_USER: "Site User",
  ASSISTANT_MANAGER: "Assistant Manager",
  MANAGER_ADMIN: "Manager / Admin",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export interface AccessSubject {
  role: Role;
  propertyId: string | null;
}

/** AM and Manager/Admin see the whole portfolio; site users see one property. */
export function canViewAllProperties(role: Role): boolean {
  return role === "ASSISTANT_MANAGER" || role === "MANAGER_ADMIN";
}

export function canReview(role: Role): boolean {
  return role === "ASSISTANT_MANAGER" || role === "MANAGER_ADMIN";
}

export function canPublish(role: Role): boolean {
  return role === "ASSISTANT_MANAGER" || role === "MANAGER_ADMIN";
}

export function canAdministerUsers(role: Role): boolean {
  return role === "MANAGER_ADMIN";
}

export function canManageProperties(role: Role): boolean {
  return role === "MANAGER_ADMIN";
}

export function canManageIntegrations(role: Role): boolean {
  return role === "MANAGER_ADMIN";
}

export function canOverrideRecords(role: Role): boolean {
  return role === "MANAGER_ADMIN";
}

export function canAccessProperty(subject: AccessSubject, propertyId: string): boolean {
  if (canViewAllProperties(subject.role)) return true;
  return subject.propertyId !== null && subject.propertyId === propertyId;
}

// ─── Workflow ───────────────────────────────────────────────────────────────

export const WORKFLOW_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "APPROVED",
  "PUBLISHED",
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  RETURNED: "Returned",
  APPROVED: "Approved",
  PUBLISHED: "Published",
};

/**
 * Whether `role` may edit a submission's content in its current state.
 * Site users edit their own drafts and returned submissions; reviewers may
 * correct data up to approval; only MANAGER_ADMIN can override published data.
 */
export function canEditSubmission(role: Role, status: WorkflowStatus): boolean {
  switch (role) {
    case "SITE_USER":
      return status === "DRAFT" || status === "RETURNED";
    case "ASSISTANT_MANAGER":
      return status !== "PUBLISHED";
    case "MANAGER_ADMIN":
      return true;
  }
}

/** Legal workflow transitions per role. Used by services before any write. */
export function allowedTransitions(status: WorkflowStatus, role: Role): WorkflowStatus[] {
  const reviewer = canReview(role);
  switch (status) {
    case "DRAFT":
      return ["SUBMITTED"];
    case "SUBMITTED":
      return reviewer ? ["APPROVED", "RETURNED"] : [];
    case "RETURNED":
      return ["SUBMITTED"];
    case "APPROVED":
      return reviewer ? ["PUBLISHED", "RETURNED"] : [];
    case "PUBLISHED":
      // Published data is immutable except for MANAGER_ADMIN override flows.
      return role === "MANAGER_ADMIN" ? ["APPROVED"] : [];
  }
}

export function canTransition(
  status: WorkflowStatus,
  next: WorkflowStatus,
  role: Role,
): boolean {
  return allowedTransitions(status, role).includes(next);
}
