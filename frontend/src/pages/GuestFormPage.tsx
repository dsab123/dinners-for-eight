import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AddressInput } from "../components/AddressInput";
import { useMemberAddressPrefill } from "../hooks/useMemberAddressPrefill";
import { api, ApiError } from "../api/client";

export function GuestFormPage() {
  const [address, setAddress] = useState("");
  const [geocoded, setGeocoded] = useState<{ lat: number; lng: number } | null>(null);
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [notes, setNotes] = useState("");
  const [flexibleRole, setFlexibleRole] = useState(false);
  const [switchCapacity, setSwitchCapacity] = useState("6");
  const [switchFlex, setSwitchFlex] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const prefillNote = useMemberAddressPrefill(setAddress, setGeocoded);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!geocoded) {
      setError("Enter your address and let it locate before continuing.");
      return;
    }
    const adultsNum = Number(adults) || 0;
    const childrenNum = Number(children) || 0;
    if (adultsNum + childrenNum < 1) {
      setError("Enter at least one adult or child in your party.");
      return;
    }
    const switchCapacityNum = Number(switchCapacity) || 0;
    if (flexibleRole && switchCapacityNum < 1) {
      setError("Enter how many you could seat if you switch to hosting.");
      return;
    }

    setSubmitting(true);
    try {
      await api.register({
        role: "guest",
        address,
        lat: geocoded.lat,
        lng: geocoded.lng,
        adults: adultsNum,
        children: childrenNum,
        notes: notes.trim() || undefined,
        flexibleRole,
        switchCapacity: flexibleRole ? switchCapacityNum : undefined,
        switchFlex: flexibleRole ? Number(switchFlex) || 0 : undefined,
      });
      navigate("/confirmation", {
        state: { role: "guest", adults: adultsNum, children: childrenNum },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that. Try again.");
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
        <p className="card__eyebrow">Joining a table</p>
        <h1 className="card__title">Tell us your party</h1>
        <p className="card__subtitle">
          Count everyone coming with you from your unit — adults and children separately.
        </p>

        <AddressInput
          value={address}
          onChange={setAddress}
          onGeocoded={(result) => setGeocoded(result)}
          prefillNote={prefillNote}
        />

        <div className="field-row">
          <div className="field">
            <label htmlFor="adults">Adults</label>
            <input
              id="adults"
              type="number"
              min={0}
              max={20}
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="children">Children</label>
            <input
              id="children"
              type="number"
              min={0}
              max={20}
              value={children}
              onChange={(e) => setChildren(e.target.value)}
            />
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={flexibleRole}
            onChange={(e) => setFlexibleRole(e.target.checked)}
          />
          <span>I'm willing to host instead if we're short on hosts.</span>
        </label>

        {flexibleRole && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="switchCapacity">If hosting — headcount</label>
              <input
                id="switchCapacity"
                type="number"
                min={1}
                max={40}
                value={switchCapacity}
                onChange={(e) => setSwitchCapacity(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="switchFlex">Give or take</label>
              <input
                id="switchFlex"
                type="number"
                min={0}
                max={10}
                value={switchFlex}
                onChange={(e) => setSwitchFlex(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="notes">Anything helpful to know? (optional)</label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Allergies, mobility needs, car seats, etc."
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Confirm my party"}
        </button>
      </form>
    </div>
  );
}
