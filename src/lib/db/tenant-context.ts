import { sql } from "drizzle-orm";
import { db } from "../db";

export async function withTenantContext<T>(
  tenantId: string,
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return callback(tx as unknown as typeof db);
  });
}
