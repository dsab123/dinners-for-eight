import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, clearSessionToken, getSessionToken, setSessionToken } from "../api/client";
import type { CurrentUser } from "../types";

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  signInWithToken: (sessionToken: string, user: CurrentUser) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => clearSessionToken())
      .finally(() => setLoading(false));
  }, []);

  const signInWithToken = (sessionToken: string, nextUser: CurrentUser) => {
    setSessionToken(sessionToken);
    setUser(nextUser);
  };

  const signOut = () => {
    clearSessionToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
