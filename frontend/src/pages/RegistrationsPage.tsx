import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import {
  REGISTRATION_COLUMNS,
  downloadRegistrationsCsv,
  type Registration,
} from "../lib/registrations";
import type { GuestRegistration, HostRegistration } from "../types";

export function RegistrationsPage() {
  const navigate = useNavigate();
  const [hosts, setHosts] = useState<HostRegistration[]>([]);
  const [guests, setGuests] = useState<GuestRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const registrations = await api.adminListRegistrations();
      setHosts(registrations.hosts);
      setGuests(registrations.guests);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't load registrations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Same ordering as the CSV: hosts first, then guests.
  const rows: Registration[] = [...hosts, ...guests];

  // Drop selections that no longer exist (e.g. after a reload).
  const validSelected = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const selectedCount = validSelected.length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;

  // Header checkbox shows a "partial" state when only some rows are selected.
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [selectedCount, allSelected]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.adminDeleteRegistrations(validSelected);
      setPendingDelete(false);
      setSelected(new Set());
      setInfo(`Removed ${res.removed} member${res.removed === 1 ? "" : "s"}.`);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't remove the selected members."
      );
    } finally {
      setDeleting(false);
    }
  }

  async function changeForcedRole(id: string, value: string) {
    const role = value === "auto" ? null : (value as "host" | "guest");
    setError(null);
    // Optimistically reflect the change, then resync from the server on failure.
    setHosts((hs) =>
      hs.map((r) =>
        r.id === id ? ({ ...r, forcedRole: role ?? undefined } as HostRegistration) : r
      )
    );
    setGuests((gs) =>
      gs.map((r) =>
        r.id === id ? ({ ...r, forcedRole: role ?? undefined } as GuestRegistration) : r
      )
    );
    try {
      await api.adminSetForcedRole(id, role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update the role.");
      await load();
    }
  }

  return (
    <div className="shell shell--wide">
      <div className="dashboard">
        <div className="dashboard__header">
          <div className="brandmark" style={{ marginBottom: 0 }}>
            <span className="brandmark__mark">D4E</span>
            <span className="brandmark__name">All registrations</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn--ghost" onClick={() => navigate("/admin")}>
              Back to dashboard
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => downloadRegistrationsCsv(hosts, guests)}
              disabled={loading || rows.length === 0}
            >
              Export CSV
            </button>
            <button
              className="btn btn--danger-ghost"
              onClick={() => setPendingDelete(true)}
              disabled={loading || selectedCount === 0 || deleting}
            >
              Remove selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        {info && <p className="info-text">{info}</p>}

        {pendingDelete && (
          <div className="confirm-bar">
            <span>
              Remove <strong>{selectedCount} member{selectedCount === 1 ? "" : "s"}</strong> from
              this round? This can't be undone. Re-run matching afterward if you'd
              already mapped tables.
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn--ghost"
                onClick={() => setPendingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button className="btn btn--danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Removing…" : "Yes, remove"}
              </button>
            </div>
          </div>
        )}

        <div className="panel">
          <h2 className="panel__title">
            {rows.length} registration{rows.length === 1 ? "" : "s"} ({hosts.length} host
            {hosts.length === 1 ? "" : "s"}, {guests.length} guest
            {guests.length === 1 ? "" : "s"})
          </h2>
          <p className="field__hint" style={{ marginBottom: 14 }}>
            Set <strong>force role</strong> to pin someone as a host or guest — the
            matcher will keep them in that role and won't auto-switch them. Leave on
            Auto to use what they registered as. Re-run matching to apply.
          </p>

          {loading ? (
            <p className="empty-state">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="empty-state">No registrations yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Select all registrations"
                      />
                    </th>
                    <th style={{ whiteSpace: "nowrap" }}>force role</th>
                    {REGISTRATION_COLUMNS.map((c) => (
                      <th key={c.header} style={{ whiteSpace: "nowrap" }}>
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                          aria-label={`Select ${r.fullName}`}
                        />
                      </td>
                      <td>
                        <select
                          value={r.forcedRole ?? "auto"}
                          onChange={(e) => changeForcedRole(r.id, e.target.value)}
                          aria-label={`Force role for ${r.fullName}`}
                        >
                          <option value="auto">Auto</option>
                          <option value="host">Host</option>
                          <option value="guest">Guest</option>
                        </select>
                      </td>
                      {REGISTRATION_COLUMNS.map((c) => (
                        <td key={c.header}>{c.value(r)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
