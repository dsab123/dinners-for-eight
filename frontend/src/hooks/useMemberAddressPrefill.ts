import { useEffect, useState } from "react";
import { api } from "../api/client";

/**
 * On mount, fuzzy-looks-up the signed-in person in the church directory and,
 * if found, pre-fills their address and geocodes it. Returns a note to show
 * under the address field. Silent no-op if there's no confident match.
 */
export function useMemberAddressPrefill(
  setAddress: (value: string) => void,
  setGeocoded: (value: { lat: number; lng: number } | null) => void
): string | undefined {
  const [prefillNote, setPrefillNote] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { match } = await api.memberLookup();
        if (cancelled || !match) return;
        setAddress(match.address);
        setPrefillNote(
          "Pre-filled from the church directory — please check it's right."
        );
        try {
          const geo = await api.geocode(match.address);
          if (!cancelled) setGeocoded({ lat: geo.lat, lng: geo.lng });
        } catch {
          // Couldn't geocode the directory address; the field still shows it
          // and re-geocodes when the user edits and blurs.
          if (!cancelled) setGeocoded(null);
        }
      } catch {
        // No match or lookup failed — fall back to manual entry, no message.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setAddress, setGeocoded]);

  return prefillNote;
}
