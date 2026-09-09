import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import { useEffect, useState } from "react";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
};

type AuthState = {
  user: AuthUser | null;
  authenticated: boolean;
  loading: boolean;
};

function useSession() {
  const [auth, setAuth] = useState<AuthState>({ user: null, authenticated: false, loading: true });

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setAuth({ user: data.user, authenticated: data.authenticated, loading: false }))
      .catch(() => setAuth({ user: null, authenticated: false, loading: false }));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuth({ user: null, authenticated: false, loading: false });
  };

  return { ...auth, logout };
}

function AuthGuard({ children, user, loading }: { children: React.ReactNode; user: AuthUser | null; loading: boolean }) {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="login-brand">
            <div className="brand-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <div>
              <strong>Daymark</strong>
              <span>student planner</span>
            </div>
          </div>
          <p className="login-subtitle" style={{ marginTop: 24 }}>Loading your planner…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

function Router({ user, logout }: { user: AuthUser | null; logout: () => void }) {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <AuthGuard user={user} loading={false}>
          <Home user={user!} onLogout={logout} />
        </AuthGuard>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const { user, loading, logout } = useSession();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="bottom-right" />
          {loading ? (
            <AuthGuard user={null} loading={true}>
              <div />
            </AuthGuard>
          ) : (
            <Router user={user} logout={logout} />
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
