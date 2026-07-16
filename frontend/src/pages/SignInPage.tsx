import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";

export function SignInPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.requestMagicLink(email.trim(), fullName.trim());
      navigate("/check-email", { state: { email } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="shell">
      <div className="brandmark">
        <span className="brandmark__mark">D4E</span>
        <span className="brandmark__name">Dinners for Eight</span>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <p className="card__eyebrow">Sign in</p>
        <h1 className="card__title">Sunday lunch, sorted.</h1>
        <p className="card__subtitle">
          Enter your name and email — we'll send a sign-in link, no password needed.
        </p>

        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jordan Alvarez"
            required
            minLength={2}
          />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? "Sending link…" : "Email me a sign-in link"}
        </button>
      </form>
    </div>
  );
}
