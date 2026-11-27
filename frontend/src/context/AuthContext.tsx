import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { User, UserRole } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: Record<string, unknown>) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {
    throw new Error("AuthProvider not initialized");
  },
  register: async () => {
    throw new Error("AuthProvider not initialized");
  },
  logout: async () => {},
  refreshProfile: async () => {},
  hasRole: () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem("ff_access_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<User>("/auth/profile/");
      setUser(res.data);
    } catch {
      localStorage.removeItem("ff_access_token");
      localStorage.removeItem("ff_refresh_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.post("/auth/login/", { email, password });
    localStorage.setItem("ff_access_token", res.data.access);
    localStorage.setItem("ff_refresh_token", res.data.refresh);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (payload: Record<string, unknown>): Promise<User> => {
    const res = await api.post("/auth/register/", payload);
    localStorage.setItem("ff_access_token", res.data.access);
    localStorage.setItem("ff_refresh_token", res.data.refresh);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    const refresh = localStorage.getItem("ff_refresh_token");
    try {
      await api.post("/auth/logout/", { refresh });
    } catch {
      // ignore
    }
    localStorage.removeItem("ff_access_token");
    localStorage.removeItem("ff_refresh_token");
    setUser(null);
  };

  const hasRole = (...roles: UserRole[]) => Boolean(user && roles.includes(user.role));

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshProfile, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
