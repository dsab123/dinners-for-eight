import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RoleSelectPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="shell">
      <div className="brandmark">
        <span className="brandmark__mark">D4E</span>
        <span className="brandmark__name">Dinners for Eight</span>
      </div>

      <div className="card">
        <p className="card__eyebrow">Welcome{user ? `, ${user.fullName.split(" ")[0]}` : ""}</p>
        <h1 className="card__title">This Sunday, will you host or join a table?</h1>
        <p className="card__subtitle">Pick one — you can update your details anytime before Sunday.</p>

        <div className="role-grid">
          <button
            className="role-choice role-choice--host"
            onClick={() => navigate("/host")}
          >
            <div className="role-choice__label">Host a table</div>
            <div className="role-choice__desc">
              Open your home for lunch and tell us how many you can comfortably seat.
            </div>
          </button>

          <button
            className="role-choice role-choice--guest"
            onClick={() => navigate("/guest")}
          >
            <div className="role-choice__label">Join a table</div>
            <div className="role-choice__desc">
              Let us know your party size — adults and children — and we'll place you.
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
