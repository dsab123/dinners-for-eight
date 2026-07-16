import { useLocation } from "react-router-dom";

export function CheckEmailPage() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  return (
    <div className="shell">
      <div className="brandmark">
        <span className="brandmark__mark">D4E</span>
        <span className="brandmark__name">Dinners for Eight</span>
      </div>
      <div className="card">
        <p className="card__eyebrow">Almost there</p>
        <h1 className="card__title">Check your email</h1>
        <p className="card__subtitle">
          {email ? (
            <>We sent a sign-in link to <strong>{email}</strong>.</>
          ) : (
            "We sent you a sign-in link."
          )}{" "}
          It expires in 15 minutes — open it on this device to continue.
        </p>
      </div>
    </div>
  );
}
