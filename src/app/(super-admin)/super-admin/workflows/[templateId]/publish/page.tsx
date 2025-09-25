import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { PublishWorkflowClient } from "./publish-client";
import { db } from "@/lib/db";
import { workflowTemplates } from "@/lib/db/schema/workflows";
import { workflowTemplateTenants } from "@/lib/db/schema/workflow-publishing";
import { tenants, tenantMembers } from "@/lib/db/schema/tenants";

interface PublishWorkflowPageProps {
  params: {
    templateId: string;
  };
}

export default async function PublishWorkflowPage({ params }: PublishWorkflowPageProps) {
  const template = await db
    .select({
      id: workflowTemplates.id,
      name: workflowTemplates.name,
      description: workflowTemplates.description,
    })
    .from(workflowTemplates)
    .where(eq(workflowTemplates.id, params.templateId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!template) {
    notFound();
  }

  const tenantRows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      memberCount: sql<number>`count(distinct ${tenantMembers.id})`,
      bindingId: workflowTemplateTenants.id,
      isDefault: workflowTemplateTenants.isDefault,
      publishedAt: workflowTemplateTenants.publishedAt,
      unpublishedAt: workflowTemplateTenants.unpublishedAt,
    })
    .from(tenants)
    .leftJoin(
      workflowTemplateTenants,
      and(
        eq(workflowTemplateTenants.tenantId, tenants.id),
        eq(workflowTemplateTenants.workflowTemplateId, template.id)
      )
    )
    .leftJoin(tenantMembers, eq(tenantMembers.tenantId, tenants.id))
    .groupBy(
      tenants.id,
      tenants.name,
      tenants.slug,
      workflowTemplateTenants.id,
      workflowTemplateTenants.isDefault,
      workflowTemplateTenants.publishedAt,
      workflowTemplateTenants.unpublishedAt
    )
    .orderBy(tenants.name);

  const tenantsData = tenantRows.map((row) => {
    const isPublished = Boolean(row.bindingId) && !row.unpublishedAt;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      memberCount: Number(row.memberCount ?? 0),
      isPublished,
      isDefault: isPublished && Boolean(row.isDefault),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <PublishWorkflowClient
        templateId={template.id}
        workflow={{
          id: template.id,
          name: template.name,
          description: template.description ?? undefined,
        }}
        tenants={tenantsData}
      />
    </div>
  );
}
