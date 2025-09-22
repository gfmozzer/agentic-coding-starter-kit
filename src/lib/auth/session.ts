import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cache } from "react";

export type AppRole = "super-admin" | "operator";

export interface SessionContext {
  userId: string;
  role: AppRole;
  tenantId?: string;
  user: {
    name: string | null;
    email: string | null;
    image?: string | null;
  };
}

type SessionRecord = {
  userId: string;
  customClaims?: {
    role?: string;
    tenantId?: string;
    [key: string]: unknown;
  } | null;
};

type UserRecord = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
} | null;

type SessionResponse = {
  session?: SessionRecord | null;
  user?: UserRecord;
};

function resolveRole(session?: SessionRecord | null): AppRole {
  const claimRole = session?.customClaims?.role;
  if (claimRole === "super-admin" || claimRole === "operator") {
    return claimRole;
  }
  return "operator";
}

function resolveTenant(session?: SessionRecord | null): string | undefined {
  const tenant = session?.customClaims?.tenantId;
  return typeof tenant === "string" && tenant.trim().length > 0
    ? tenant
    : undefined;
}

function mapUser(user?: UserRecord) {
  return {
    name: user?.name ?? null,
    email: user?.email ?? null,
    image: user?.image ?? undefined,
  };
}

async function loadSessionInternal(): Promise<SessionContext | null> {
  try {
    const baseHeaders = await headers();
    const reqHeaders = new Headers(baseHeaders);
    const session = (await auth.api.getSession({
      headers: reqHeaders,
    })) as SessionResponse;

    if (!session || !session.session || !session.user) {
      return null;
    }

    return {
      userId: session.session.userId,
      role: resolveRole(session.session),
      tenantId: resolveTenant(session.session),
      user: mapUser(session.user),
    };
  } catch (error) {
    console.error("Failed to resolve session context", error);
    return null;
  }
}

export const getSessionContext = cache(loadSessionInternal);