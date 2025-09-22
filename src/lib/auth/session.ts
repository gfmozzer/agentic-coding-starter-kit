import { auth } from "@/lib/auth";
import type { InferSession, InferUser } from "better-auth";
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

type AuthSession = InferSession<typeof auth>;
type AuthUser = InferUser<typeof auth>;

type RawSessionResponse = Awaited<ReturnType<typeof auth.api.getSession>>;

function resolveRole(session?: AuthSession | null): AppRole {
  const claimRole = session?.customClaims?.role;
  if (claimRole === "super-admin" || claimRole === "operator") {
    return claimRole;
  }
  return "operator";
}

function resolveTenant(session?: AuthSession | null): string | undefined {
  const tenant = session?.customClaims?.tenantId;
  return typeof tenant === "string" && tenant.trim().length > 0
    ? tenant
    : undefined;
}

function mapUser(user?: AuthUser | null) {
  return {
    name: user?.name ?? null,
    email: user?.email ?? null,
    image: user?.image,
  };
}

async function loadSessionInternal(): Promise<SessionContext | null> {
  try {
    const session = (await auth.api.getSession({
      headers: headers(),
    })) as RawSessionResponse;

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