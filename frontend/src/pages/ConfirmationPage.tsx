import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ConfirmationState {
  role: "host" | "guest";
  capacity?: number;
  flex?: number;
  adults?: number;
  children?: number;
}

export function ConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = location.state as ConfirmationState | null;

  if (!state) {
    return (
      <div className="shell">
        <div className="card">
          <p className="card__subtitle">Nothing to confirm yet.</p>
          <button className="btn btn--ghost" onClick={() => navigate("/role")}>
            Back to start
          </button>
        </div>
      </div>
    );
  }

  const isHost = state.role === "host";

  return (
    <div className="shell">
      <div className="brandmark">
        <span className="brandmark__mark">D4E</span>
        <span className="brandmark__name">Dinners for Eight</span>
      </div>

      <div className="ticket">
        <div className="ticket__main">
          <p className="ticket__eyebrow">{isHost ? "Hosting confirmed" : "Party confirmed"}</p>
          <h1 className="ticket__title">
            {isHost ? "Your table is on the list" : "You're on the list"}
          </h1>
          <p className="ticket__detail">{user?.fullName}</p>
          <p className="ticket__detail">
            {isHost
              ? `Comfortable for ${state.capacity} (±${state.flex ?? 0})`
              : `${state.adults ?? 0} adult(s), ${state.children ?? 0} child(ren)`}
          </p>
          <p className="ticket__detail" style={{ marginTop: 12 }}>
            We'll match tables closer to Sunday. You can update your details anytime
            by signing in again.
          </p>
        </div>
        <div className="ticket__stub">
          <span className="ticket__stub-label">Role</span>
          <span className="ticket__stub-value">{isHost ? "Host" : "Guest"}</span>
        </div>
      </div>

      <button
        className="btn btn--ghost"
        style={{ marginTop: 20 }}
        onClick={() => navigate("/role")}
      >
        Update my details
      </button>
    </div>
  );
}
