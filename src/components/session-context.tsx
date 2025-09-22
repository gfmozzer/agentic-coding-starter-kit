"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { SessionContext } from "@/lib/auth/session";

type SessionContextValue = SessionContext | null;

const SessionContext = createContext<SessionContextValue>(null);

export function SessionContextProvider({
  value,
  children,
}: {
  value: SessionContextValue;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSessionContext() {
  return useContext(SessionContext);
}