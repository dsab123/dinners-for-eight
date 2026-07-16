import { useState } from "react";
import { api, ApiError } from "../api/client";

interface GeocodedAddress {
  formattedAddress: string;
  lat: number;
  lng: number;
}

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onGeocoded: (result: GeocodedAddress | null) => void;
  label?: string;
  /** Shown while the field is untouched, e.g. "pre-filled from the directory". */
  prefillNote?: string;
}

export function AddressInput({
  value,
  onChange,
  onGeocoded,
  label = "Home address",
  prefillNote,
}: AddressInputProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [touched, setTouched] = useState(false);

  async function handleBlur() {
    if (!value || value.trim().length < 3) return;
    setStatus("loading");
    try {
      const result = await api.geocode(value.trim());
      setStatus("found");
      setMessage(result.formattedAddress);
      onGeocoded(result);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof ApiError ? err.message : "Couldn't locate that address.");
      onGeocoded(null);
    }
  }

  return (
    <div className="field">
      <label htmlFor="address">{label}</label>
      <input
        id="address"
        type="text"
        placeholder="123 Fellowship Ave, Springfield"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setStatus("idle");
          setTouched(true);
        }}
        onBlur={handleBlur}
        autoComplete="street-address"
      />
      {status === "idle" && !touched && prefillNote && (
        <p className="field__hint">{prefillNote}</p>
      )}
      {status === "loading" && <p className="field__hint">Looking up that address…</p>}
      {status === "found" && <p className="field__hint">Located: {message}</p>}
      {status === "error" && <p className="error-text">{message}</p>}
    </div>
  );
}
