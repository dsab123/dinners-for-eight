import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { MapView } from "../components/MapView";
import { useAuth } from "../context/AuthContext";
import { downloadRegistrationsCsv } from "../lib/registrations";
import type { AppSettings, HostRegistration, GuestRegistration, MatchRun } from "../types";

const EMPTY_SETTINGS: AppSettings = { eventDate: "", emailSubject: "", emailBody: "" };

export function AdminDashboardPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [hosts, setHosts] = useState<HostRegistration[]>([]);
  const [guests, setGuests] = useState<GuestRegistration[]>([]);
  const [guestPeopleCount, setGuestPeopleCount] = useState(0);
  const [matchRun, setMatchRun] = useState<MatchRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<null | "wipe" | "email">(null);
  const [busy, setBusy] = useState<null | "wipe" | "email" | "simulate">(null);
  const [settings, setSettings] = useState<AppSettings>(EMPTY_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsInfo, setSettingsInfo] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [registrations, matches, settingsRes] = await Promise.all([
        api.adminListRegistrations(),
        api.adminGetLatestMatch(),
        api.adminGetSettings(),
      ]);
      setHosts(registrations.hosts);
      setGuests(registrations.guests);
      setGuestPeopleCount(registrations.guestPeopleCount);
      setMatchRun(matches.latestRun);
      setSettings(settingsRes.settings);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsInfo(null);
    try {
      const res = await api.adminUpdateSettings(settings);
      setSettings(res.settings);
      setSettingsInfo("Saved.");
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : "Couldn't save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleMatch() {
    setMatching(true);
    setError(null);
    try {
      const res = await api.adminRunMatch();
      setMatchRun(res.run);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Matching failed. Try again.");
    } finally {
      setMatching(false);
    }
  }

  async function handleWipe() {
    setBusy("wipe");
    setError(null);
    setInfo(null);
    try {
      await api.adminWipe();
      setPendingConfirm(null);
      setInfo("Cleared all registrations and match results.");
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Wipe failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSimulate() {
    setBusy("simulate");
    setError(null);
    setInfo(null);
    try {
      const res = await api.adminSimulate();
      setInfo(`Loaded ${res.added} test registrations (${res.total} total).`);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load test data.");
    } finally {
      setBusy(null);
    }
  }

  async function handleEmailGroups() {
    setBusy("email");
    setError(null);
    setInfo(null);
    try {
      const res = await api.adminEmailGroups();
      setPendingConfirm(null);
      const parts = [`Emailed ${res.emailed} group(s)`];
      if (res.skipped) parts.push(`${res.skipped} skipped (no guests)`);
      if (res.failed.length) parts.push(`${res.failed.length} failed`);
      setInfo(parts.join(", ") + ".");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't email the groups.");
    } finally {
      setBusy(null);
    }
  }

  // Resolve names regardless of registered role, since the matcher may flip a
  // flexible person (a guest can end up hosting a table, and vice-versa).
  const nameById = new Map(
    [...hosts, ...guests].map((r) => [r.id, r.fullName])
  );

  return (
    <div className="shell shell--wide">
      <div className="dashboard">
        <div className="dashboard__header">
          <div className="brandmark" style={{ marginBottom: 0 }}>
            <span className="brandmark__mark">D4E</span>
            <span className="brandmark__name">Admin dashboard</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn--ghost" onClick={loadData} disabled={loading}>
              Refresh
            </button>
            <button
              className="btn btn--ghost"
              onClick={handleSimulate}
              disabled={busy === "simulate"}
            >
              {busy === "simulate" ? "Loading…" : "Load test data"}
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => navigate("/admin/registrations")}
              disabled={loading || hosts.length + guests.length === 0}
            >
              View all details
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => downloadRegistrationsCsv(hosts, guests)}
              disabled={loading || hosts.length + guests.length === 0}
            >
              Export CSV
            </button>
            <button className="btn btn--primary" onClick={handleMatch} disabled={matching || hosts.length === 0}>
              {matching ? "Mapping tables…" : "Map hosts to guests"}
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => setPendingConfirm("email")}
              disabled={!matchRun || busy !== null}
              title={matchRun ? "" : "Run matching first"}
            >
              Email groups
            </button>
            <button className="btn btn--ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        {info && <p className="info-text">{info}</p>}

        {pendingConfirm === "wipe" && (
          <div className="confirm-bar">
            <span>
              Delete <strong>all {hosts.length + guests.length} registration(s)</strong> and any
              match results? This can't be undone.
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn--ghost" onClick={() => setPendingConfirm(null)} disabled={busy === "wipe"}>
                Cancel
              </button>
              <button className="btn btn--danger" onClick={handleWipe} disabled={busy === "wipe"}>
                {busy === "wipe" ? "Wiping…" : "Yes, wipe everything"}
              </button>
            </div>
          </div>
        )}

        {pendingConfirm === "email" && (
          <div className="confirm-bar confirm-bar--neutral">
            <span>
              Send a kickoff email to <strong>{matchRun?.assignments.length ?? 0} matched group(s)</strong>?
              Each host and their guests are emailed together so they can reply-all to plan.
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn--ghost" onClick={() => setPendingConfirm(null)} disabled={busy === "email"}>
                Cancel
              </button>
              <button className="btn btn--primary" style={{ width: "auto" }} onClick={handleEmailGroups} disabled={busy === "email"}>
                {busy === "email" ? "Sending…" : "Yes, email groups"}
              </button>
            </div>
          </div>
        )}

        {pendingConfirm === null && (
          <button
            className="btn btn--danger-ghost"
            onClick={() => setPendingConfirm("wipe")}
            disabled={loading || hosts.length + guests.length === 0}
          >
            Wipe all data
          </button>
        )}

        <div className="stat-row">
          <div className="stat">
            <div className="stat__label">Hosts registered</div>
            <div className="stat__value">{hosts.length}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Guest households</div>
            <div className="stat__value">{guests.length}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Guests (people)</div>
            <div className="stat__value">{guestPeopleCount}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Seats offered</div>
            <div className="stat__value">
              {hosts.reduce((sum, h) => sum + h.targetCapacity, 0)}
            </div>
          </div>
          {matchRun && (
            <div className="stat">
              <div className="stat__label">Unmatched households</div>
              <div className="stat__value">{matchRun.unmatchedGuestIds.length}</div>
            </div>
          )}
        </div>

        <div className="panel" style={{ marginBottom: 24 }}>
          <h2 className="panel__title">Event & email settings</h2>
          <p className="field__hint" style={{ marginTop: -8, marginBottom: 16 }}>
            Changes apply immediately — no redeploy needed.
          </p>

          <div className="field">
            <label htmlFor="eventDate">Event date</label>
            <input
              id="eventDate"
              type="text"
              placeholder="e.g. July 19, 2026"
              value={settings.eventDate}
              onChange={(e) => setSettings({ ...settings, eventDate: e.target.value })}
            />
            <p className="field__hint">
              Shown in the group email. Leave blank to ask each group to pick their own date.
            </p>
          </div>

          <div className="field">
            <label htmlFor="emailSubject">Email subject override (optional)</label>
            <input
              id="emailSubject"
              type="text"
              placeholder='Default: "Your Dinners for Eight group — on <date>"'
              value={settings.emailSubject}
              onChange={(e) => setSettings({ ...settings, emailSubject: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="emailBody">Email message override (optional)</label>
            <textarea
              id="emailBody"
              rows={6}
              placeholder="Leave blank to use the default message."
              value={settings.emailBody}
              onChange={(e) => setSettings({ ...settings, emailBody: e.target.value })}
            />
            <p className="field__hint">
              Placeholders: {"{{eventDate}}"}, {"{{roster}}"}, {"{{hostName}}"}, {"{{hostAddress}}"}
            </p>
          </div>

          {settingsError && <p className="error-text">{settingsError}</p>}
          {settingsInfo && <p className="info-text">{settingsInfo}</p>}

          <button
            className="btn btn--primary"
            style={{ width: "auto" }}
            onClick={handleSaveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? "Saving…" : "Save settings"}
          </button>
        </div>

        <div className="dashboard-grid">
          <div className="panel">
            <h2 className="panel__title">Map</h2>
            {loading ? (
              <p className="empty-state">Loading…</p>
            ) : hosts.length === 0 && guests.length === 0 ? (
              <p className="empty-state">No registrations with locations yet.</p>
            ) : (
              <MapView hosts={hosts} guests={guests} matchRun={matchRun} />
            )}
          </div>

          <div className="panel">
            <h2 className="panel__title">
              {matchRun ? "Latest table assignments" : "Hosts & guests"}
            </h2>

            {matchRun ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Host</th>
                    <th>Fill</th>
                    <th>Guests seated</th>
                  </tr>
                </thead>
                <tbody>
                  {matchRun.assignments.map((assignment) => {
                    return (
                      <tr key={assignment.hostId}>
                        <td>{nameById.get(assignment.hostId) ?? "—"}</td>
                        <td>
                          {assignment.assignedCount} / {assignment.targetCapacity}
                        </td>
                        <td>
                          {assignment.guestIds
                            .map((id) => nameById.get(id) ?? "—")
                            .join(", ") || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {[...hosts, ...(guests as (HostRegistration | GuestRegistration)[])]
                    .sort((a, b) => a.fullName.localeCompare(b.fullName))
                    .map((r) => (
                      <tr key={r.id}>
                        <td>{r.fullName}</td>
                        <td>
                          <span className={`pill pill--${r.role}`}>{r.role}</span>
                        </td>
                        <td>
                          {r.role === "host"
                            ? `${r.targetCapacity} (±${r.flex})`
                            : `${r.adults} adult(s), ${r.children} child(ren)`}
                          {r.flexibleRole && (
                            <span className="field__hint" style={{ display: "inline", marginLeft: 6 }}>
                              · flexible
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {matchRun && matchRun.unmatchedGuestIds.length > 0 && (
              <p className="field__hint" style={{ marginTop: 12 }}>
                Unmatched: {matchRun.unmatchedGuestIds
                  .map((id) => nameById.get(id) ?? "—")
                  .join(", ")}
              </p>
            )}

            {matchRun && matchRun.switched && matchRun.switched.length > 0 && (
              <p className="field__hint" style={{ marginTop: 12 }}>
                Role switches to balance the numbers:{" "}
                {matchRun.switched
                  .map(
                    (s) =>
                      `${nameById.get(s.id) ?? "—"} (${s.fromRole}→${s.toRole})`
                  )
                  .join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
