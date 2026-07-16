const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN!;

export interface GeocodeResult {
  formattedAddress: string;
  lat: number;
  lng: number;
}

/**
 * Fallback location used when an address can't be geocoded (nonsense input,
 * no confident match, or NaN coordinates). Coordinates are the real geocode of
 * DEFAULT_ADDRESS, hardcoded so the fallback never itself depends on a lookup.
 */
export const DEFAULT_ADDRESS = "10900 University Blvd, Manassas, VA 20110";
export const DEFAULT_RESULT: GeocodeResult = {
  formattedAddress:
    "10900 University Boulevard, Manassas, Virginia 20110, United States",
  lat: 38.756381,
  lng: -77.521369,
};

/**
 * Mapbox returns a best-effort match for ANY input, so gibberish like
 * "unable to host" fuzzy-matches a random street (it matched "host" ->
 * "Hostílio" in Brazil). Real addresses score high; junk scores low, so we
 * reject anything under this floor rather than trust it.
 */
const MIN_RELEVANCE = 0.5;

export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      address
    )}.json?limit=1&country=us&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox geocoding failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    features: Array<{
      place_name: string;
      center: [number, number]; // [lng, lat]
      relevance?: number;
    }>;
  };

  const top = data.features?.[0];
  if (!top) return null;
  // Discard low-confidence fuzzy matches (see MIN_RELEVANCE).
  if ((top.relevance ?? 0) < MIN_RELEVANCE) return null;

  const lng = top.center?.[0];
  const lat = top.center?.[1];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    formattedAddress: top.place_name,
    lat,
    lng,
  };
}

/**
 * Geocode an address, falling back to DEFAULT_RESULT when it doesn't resolve
 * to a confident, valid location.
 */
export async function geocodeAddressOrDefault(
  address: string
): Promise<GeocodeResult> {
  const result = await geocodeAddress(address);
  return result ?? DEFAULT_RESULT;
}
