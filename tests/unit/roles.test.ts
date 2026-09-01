import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  canAccessProperty,
  canAdministerUsers,
  canEditSubmission,
  canPublish,
  canReview,
  canTransition,
  canViewAllProperties,
  isRole,
} from "@/lib/roles";

const OPAL = "11111111-1111-1111-1111-111111111111";
const AURUM = "22222222-2222-2222-2222-222222222222";

describe("role helpers", () => {
  it("site users cannot see the whole portfolio; management can", () => {
    expect(canViewAllProperties("SITE_USER")).toBe(false);
    expect(canViewAllProperties("ASSISTANT_MANAGER")).toBe(true);
    expect(canViewAllProperties("MANAGER_ADMIN")).toBe(true);
  });
  it("review/publish is AM + Manager only", () => {
    expect(canReview("SITE_USER")).toBe(false);
    expect(canReview("ASSISTANT_MANAGER")).toBe(true);
    expect(canPublish("SITE_USER")).toBe(false);
    expect(canPublish("MANAGER_ADMIN")).toBe(true);
  });
  it("user administration is Manager/Admin only", () => {
    expect(canAdministerUsers("ASSISTANT_MANAGER")).toBe(false);
    expect(canAdministerUsers("MANAGER_ADMIN")).toBe(true);
  });
  it("isRole validates role strings", () => {
    expect(isRole("SITE_USER")).toBe(true);
    expect(isRole("SUPER_ADMIN")).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});

describe("canAccessProperty (horizontal isolation)", () => {
  it("a site user may only access their own property", () => {
    const opalUser = { role: "SITE_USER" as const, propertyId: OPAL };
    expect(canAccessProperty(opalUser, OPAL)).toBe(true);
    expect(canAccessProperty(opalUser, AURUM)).toBe(false);
  });
  it("a site user with no assignment can access nothing", () => {
    expect(canAccessProperty({ role: "SITE_USER", propertyId: null }, OPAL)).toBe(false);
  });
  it("management roles access every property", () => {
    expect(canAccessProperty({ role: "ASSISTANT_MANAGER", propertyId: null }, OPAL)).toBe(true);
    expect(canAccessProperty({ role: "MANAGER_ADMIN", propertyId: null }, AURUM)).toBe(true);
  });
});

describe("workflow transitions", () => {
  it("site users can only submit drafts and returned items", () => {
    expect(allowedTransitions("DRAFT", "SITE_USER")).toEqual(["SUBMITTED"]);
    expect(allowedTransitions("RETURNED", "SITE_USER")).toEqual(["SUBMITTED"]);
    expect(allowedTransitions("SUBMITTED", "SITE_USER")).toEqual([]);
    expect(allowedTransitions("APPROVED", "SITE_USER")).toEqual([]);
    expect(allowedTransitions("PUBLISHED", "SITE_USER")).toEqual([]);
  });
  it("reviewers approve/return submissions and publish approvals", () => {
    expect(allowedTransitions("SUBMITTED", "ASSISTANT_MANAGER")).toEqual(["APPROVED", "RETURNED"]);
    expect(allowedTransitions("APPROVED", "ASSISTANT_MANAGER")).toEqual(["PUBLISHED", "RETURNED"]);
  });
  it("published data is immutable except for Manager/Admin override", () => {
    expect(canTransition("PUBLISHED", "APPROVED", "ASSISTANT_MANAGER")).toBe(false);
    expect(canTransition("PUBLISHED", "APPROVED", "MANAGER_ADMIN")).toBe(true);
  });
  it("no skipping: a draft can never go straight to APPROVED or PUBLISHED", () => {
    expect(canTransition("DRAFT", "APPROVED", "MANAGER_ADMIN")).toBe(false);
    expect(canTransition("DRAFT", "PUBLISHED", "MANAGER_ADMIN")).toBe(false);
  });
});

describe("canEditSubmission", () => {
  it("site users edit drafts and returned items only", () => {
    expect(canEditSubmission("SITE_USER", "DRAFT")).toBe(true);
    expect(canEditSubmission("SITE_USER", "RETURNED")).toBe(true);
    expect(canEditSubmission("SITE_USER", "SUBMITTED")).toBe(false);
    expect(canEditSubmission("SITE_USER", "PUBLISHED")).toBe(false);
  });
  it("AM edits anything unpublished; Manager/Admin can override published", () => {
    expect(canEditSubmission("ASSISTANT_MANAGER", "SUBMITTED")).toBe(true);
    expect(canEditSubmission("ASSISTANT_MANAGER", "PUBLISHED")).toBe(false);
    expect(canEditSubmission("MANAGER_ADMIN", "PUBLISHED")).toBe(true);
  });
});
