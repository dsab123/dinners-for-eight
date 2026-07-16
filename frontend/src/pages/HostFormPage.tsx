import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AddressInput } from "../components/AddressInput";
import { useMemberAddressPrefill } from "../hooks/useMemberAddressPrefill";
import { api, ApiError } from "../api/client";

export function HostFormPage() {
  const [address, setAddress] = useState("");
  const [geocoded, setGeocoded] = useState<{ lat: number; lng: number } | null>(null);
  const [targetCapacity, setTargetCapacity] = useState("6");
  const [flex, setFlex] = useState("2");
  const [notes, setNotes] = useState("");
  const [flexibleRole, setFlexibleRole] = useState(false);
  const [switchAdults, setSwitchAdults] = useState("2");
  const [switchChildren, setSwitchChildren] = useState("0");
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
    const capacityNum = Number(targetCapacity);
    if (!capacityNum || capacityNum < 1) {
      setError("Enter how many people you can comfortably host.");
      return;
    }
    const switchAdultsNum = Number(switchAdults) || 0;
    const switchChildrenNum = Number(switchChildren) || 0;
    if (flexibleRole && switchAdultsNum + switchChildrenNum < 1) {
      setError("Enter your party size for if you switch to being a guest.");
      return;
    }

    setSubmitting(true);
    try {
      await api.register({
        role: "host",
        address,
        lat: geocoded.lat,
        lng: geocoded.lng,
        targetCapacity: capacityNum,
        flex: Number(flex) || 0,
        notes: notes.trim() || undefined,
        flexibleRole,
        switchAdults: flexibleRole ? switchAdultsNum : undefined,
        switchChildren: flexibleRole ? switchChildrenNum : undefined,
      });
      navigate("/confirmation", {
        state: { role: "host", capacity: capacityNum, flex: Number(flex) || 0 },
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
        <p className="card__eyebrow">Hosting</p>
        <h1 className="card__title">Open your table</h1>
        <p className="card__subtitle">
          Give a rough headcount — it's fine to say "give or take a few."
        </p>

        <AddressInput
          value={address}
          onChange={setAddress}
          onGeocoded={(result) => setGeocoded(result)}
          prefillNote={prefillNote}
        />

        <div className="field-row">
          <div className="field">
            <label htmlFor="capacity">Comfortable headcount</label>
            <input
              id="capacity"
              type="number"
              min={1}
              max={40}
              value={targetCapacity}
              onChange={(e) => setTargetCapacity(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="flex">Give or take</label>
            <input
              id="flex"
              type="number"
              min={0}
              max={10}
              value={flex}
              onChange={(e) => setFlex(e.target.value)}
            />
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={flexibleRole}
            onChange={(e) => setFlexibleRole(e.target.checked)}
          />
          <span>
            I'm willing to be a guest instead if there are too many hosts.
          </span>
        </label>

        {flexibleRole && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="switchAdults">If a guest — adults</label>
              <input
                id="switchAdults"
                type="number"
                min={0}
                max={20}
                value={switchAdults}
                onChange={(e) => setSwitchAdults(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="switchChildren">If a guest — children</label>
              <input
                id="switchChildren"
                type="number"
                min={0}
                max={20}
                value={switchChildren}
                onChange={(e) => setSwitchChildren(e.target.value)}
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
            placeholder="Stairs to the front door, dog on site, allergies we should avoid, etc."
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Confirm as host"}
        </button>
      </form>
    </div>
  );
}
