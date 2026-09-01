import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  checklistCategories,
  checklistFieldDefinitions,
  checklistItems,
  properties,
} from "@/db/schema";
import { CHECKLIST_DEFINITIONS, fieldKeyFromLabel } from "./checklist-definitions";

/**
 * Current production portfolio: the three BUILT AND FUNCTIONAL properties.
 * Master data (location, type, area, development status) comes from the
 * reference Command Center where it is clearly identified as property master
 * information. Weekly sample operational figures from the reference are demo
 * content and are NOT seeded here. Additional properties under construction
 * are added later by Manager/Admin at /admin/properties — the whole system is
 * property-driven, nothing is hard-coded to these three.
 */
const PORTFOLIO: Array<Partial<typeof properties.$inferInsert> & { code: string; name: string }> = [
  {
    code: "opal",
    name: "Opal",
    location: "Lahore, Pakistan",
    propertyType: "Residential Apartments",
    areaSqFt: 300000,
    areaLabel: "300,000+ Sft",
    developmentStatus: "Completed",
    statusIndicator: "green",
  },
  {
    code: "aurum",
    name: "Aurum",
    location: "Lahore, Pakistan",
    propertyType: "Residential Apartments",
    areaSqFt: 163000,
    areaLabel: "163,000 Sft",
    developmentStatus: "Constructed",
    statusIndicator: "green",
  },
  {
    code: "quadrangle",
    name: "Quadrangle",
    location: "Lahore, Pakistan",
    propertyType: "Residential Apartments",
    areaSqFt: 252000,
    areaLabel: "252,000+ Sft",
    developmentStatus: "Completed",
    statusIndicator: "green",
  },
];

export async function runBaselineSeed() {
  console.log("Seeding properties…");
  for (const [i, p] of PORTFOLIO.entries()) {
    const existing = await db.select().from(properties).where(eq(properties.code, p.code));
    if (existing.length === 0) {
      await db.insert(properties).values({
        ...p,
        displayOrder: (i + 1) * 10,
        active: true,
      });
      console.log(`  + property ${p.name}`);
    }
  }

  console.log("Seeding checklist definitions (22 reference categories)…");
  for (const [i, def] of CHECKLIST_DEFINITIONS.entries()) {
    let category = (
      await db.select().from(checklistCategories).where(eq(checklistCategories.key, def.key))
    )[0];
    if (!category) {
      const inserted = await db
        .insert(checklistCategories)
        .values({ key: def.key, name: def.name, type: def.type, sortOrder: (i + 1) * 10 })
        .returning();
      category = inserted[0]!;
      console.log(`  + category ${def.name} (${def.type})`);
    }

    const existingItems = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.categoryId, category.id));
    if (existingItems.length === 0 && def.items?.length) {
      await db.insert(checklistItems).values(
        def.items.map((name, j) => ({
          categoryId: category.id,
          name,
          sortOrder: (j + 1) * 10,
        })),
      );
    }

    const existingFields = await db
      .select()
      .from(checklistFieldDefinitions)
      .where(eq(checklistFieldDefinitions.categoryId, category.id));
    if (existingFields.length === 0 && def.topFields?.length) {
      await db.insert(checklistFieldDefinitions).values(
        def.topFields.map((label, j) => ({
          categoryId: category.id,
          key: fieldKeyFromLabel(label),
          label,
          fieldType: "text",
          required: false,
          sortOrder: (j + 1) * 10,
        })),
      );
    }
  }
  console.log("Baseline seed done.");
}
