import { sql } from "drizzle-orm";
import { db } from "../db";

export async function withTenantContext<T>(
  tenantId: string,
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local app.tenant_id = ${tenantId}::uuid`);
    return callback(tx as unknown as typeof db);
  });
}