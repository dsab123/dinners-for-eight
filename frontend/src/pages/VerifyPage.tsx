import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signInWithToken } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Missing sign-in token.");
      return;
    }

    api
      .verifyMagicLink(token)
      .then((res) => {
        signInWithToken(res.sessionToken, res.user);
        navigate(res.user.isAdmin ? "/admin" : "/role", { replace: true });
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "That link didn't work. Request a new one."
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="shell">
      <div className="brandmark">
        <span className="brandmark__mark">D4E</span>
        <span className="brandmark__name">Dinners for Eight</span>
      </div>
      <div className="card center-page" style={{ flexDirection: "column", gap: 12 }}>
        {error ? (
          <>
            <p className="card__title" style={{ fontSize: 20 }}>Couldn't sign you in</p>
            <p className="card__subtitle">{error}</p>
            <a className="btn btn--ghost" href="/">Request a new link</a>
          </>
        ) : (
          <p className="card__subtitle">Signing you in…</p>
        )}
      </div>
    </div>
  );
}
