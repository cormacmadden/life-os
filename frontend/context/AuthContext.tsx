"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  /** Call after login to reload user without a full page reload */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const base = await apiUrl();
      const res = await fetch(`${base}/api/user/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser({ id: data.id, email: data.email, name: data.name, picture: data.picture });
      } else {
        setUser(null);
        if (res.status === 401) {
          router.replace("/login");
        }
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      const base = await apiUrl();
      await fetch(`${base}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      // ignore network errors during logout
    }
    setUser(null);
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
