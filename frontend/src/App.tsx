import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { SignInPage } from "./pages/SignInPage";
import { CheckEmailPage } from "./pages/CheckEmailPage";
import { VerifyPage } from "./pages/VerifyPage";
import { RoleSelectPage } from "./pages/RoleSelectPage";
import { HostFormPage } from "./pages/HostFormPage";
import { GuestFormPage } from "./pages/GuestFormPage";
import { ConfirmationPage } from "./pages/ConfirmationPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { RegistrationsPage } from "./pages/RegistrationsPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="shell"><p className="card__subtitle">Loading…</p></div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="shell"><p className="card__subtitle">Loading…</p></div>;
  if (!user) return <Navigate to="/" replace />;
  if (!user.isAdmin) return <Navigate to="/role" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<SignInPage />} />
      <Route path="/check-email" element={<CheckEmailPage />} />
      <Route path="/verify" element={<VerifyPage />} />

      <Route
        path="/role"
        element={
          <RequireAuth>
            <RoleSelectPage />
          </RequireAuth>
        }
      />
      <Route
        path="/host"
        element={
          <RequireAuth>
            <HostFormPage />
          </RequireAuth>
        }
      />
      <Route
        path="/guest"
        element={
          <RequireAuth>
            <GuestFormPage />
          </RequireAuth>
        }
      />
      <Route
        path="/confirmation"
        element={
          <RequireAuth>
            <ConfirmationPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminDashboardPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/registrations"
        element={
          <RequireAdmin>
            <RegistrationsPage />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
