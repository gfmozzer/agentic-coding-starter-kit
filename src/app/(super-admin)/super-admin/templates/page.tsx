import { desc } from "drizzle-orm";

import { TemplatesClient } from "./templates-client";
import { db } from "@/lib/db";
import { renderTemplates } from "@/lib/db/schema/templates";

export default async function TemplatesPage() {
  const templates = await db
    .select({
      id: renderTemplates.id,
      name: renderTemplates.name,
      description: renderTemplates.description,
      html: renderTemplates.html,
      createdAt: renderTemplates.createdAt,
      updatedAt: renderTemplates.updatedAt,
    })
    .from(renderTemplates)
    .orderBy(desc(renderTemplates.updatedAt));

  const formatted = templates.map((template) => ({
    ...template,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <TemplatesClient templates={formatted} />
    </div>
  );
}
