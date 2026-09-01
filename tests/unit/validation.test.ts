import { describe, expect, it } from "vitest";
import {
  checklistEntryPayload,
  createUserPayload,
  propertyPayload,
  returnPayload,
  weeklyReportPayload,
} from "@/lib/validation";

const UUID = "3f1e9c4a-8b2d-4e5f-9a1b-2c3d4e5f6a7b";

describe("checklistEntryPayload", () => {
  it("accepts a well-formed payload", () => {
    const parsed = checklistEntryPayload.parse({
      categoryId: UUID,
      entryDate: "2026-09-01",
      fields: { [UUID]: "10234.5" },
      responses: [{ checklistItemId: UUID, op: true, cl: false, comment: "leak", severity: "HIGH" }],
      signDutyTechnician: "Tech",
      signAmAdmin: "",
      signManagerAdmin: "",
    });
    expect(parsed.responses[0]?.severity).toBe("HIGH");
  });
  it("rejects forged non-UUID ids and invalid dates", () => {
    expect(() =>
      checklistEntryPayload.parse({ categoryId: "1 OR 1=1", entryDate: "2026-09-01" }),
    ).toThrow();
    expect(() => checklistEntryPayload.parse({ categoryId: UUID, entryDate: "01-09-2026" })).toThrow();
  });
  it("rejects unknown severity values", () => {
    expect(() =>
      checklistEntryPayload.parse({
        categoryId: UUID,
        entryDate: "2026-09-01",
        responses: [{ checklistItemId: UUID, op: true, cl: true, comment: "x", severity: "EXTREME" }],
      }),
    ).toThrow();
  });
});

describe("weeklyReportPayload", () => {
  it("requires weekStart to be a Monday", () => {
    expect(() =>
      weeklyReportPayload.parse({ weekStart: "2026-09-02", trackingStatus: "ON_TRACK" }),
    ).toThrow();
    expect(
      weeklyReportPayload.parse({ weekStart: "2026-08-31", trackingStatus: "WATCH" }).trackingStatus,
    ).toBe("WATCH");
  });
  it("rejects tasks without a description and unknown statuses", () => {
    expect(() =>
      weeklyReportPayload.parse({
        weekStart: "2026-08-31",
        trackingStatus: "ON_TRACK",
        tasks: [{ task: "  ", status: "COMPLETED" }],
      }),
    ).toThrow();
    expect(() =>
      weeklyReportPayload.parse({
        weekStart: "2026-08-31",
        trackingStatus: "ON_TRACK",
        tasks: [{ task: "x", status: "BLOCKED" }],
      }),
    ).toThrow();
  });
});

describe("returnPayload", () => {
  it("requires a reason", () => {
    expect(() => returnPayload.parse({ kind: "checklist", id: UUID, reason: "" })).toThrow();
    expect(returnPayload.parse({ kind: "weekly", id: UUID, reason: "Fix dates" }).reason).toBe(
      "Fix dates",
    );
  });
});

describe("createUserPayload", () => {
  it("forces a property assignment for SITE_USER", () => {
    expect(() =>
      createUserPayload.parse({
        name: "Site User",
        email: "site@zameen.local",
        password: "longenough123",
        role: "SITE_USER",
        propertyId: null,
      }),
    ).toThrow();
  });
  it("management roles need no property", () => {
    const parsed = createUserPayload.parse({
      name: "AM",
      email: "am@zameen.local",
      password: "longenough123",
      role: "ASSISTANT_MANAGER",
    });
    expect(parsed.propertyId).toBeNull();
  });
  it("enforces password length", () => {
    expect(() =>
      createUserPayload.parse({
        name: "AM",
        email: "am@zameen.local",
        password: "short",
        role: "ASSISTANT_MANAGER",
      }),
    ).toThrow();
  });
});

describe("propertyPayload", () => {
  it("normalizes and validates the code slug", () => {
    expect(propertyPayload.parse({ code: "Opal", name: "Opal" }).code).toBe("opal");
    expect(() => propertyPayload.parse({ code: "bad code!", name: "X" })).toThrow();
  });
  it("rejects non-positive area", () => {
    expect(() => propertyPayload.parse({ code: "x", name: "X", areaSqFt: -5 })).toThrow();
  });
});
