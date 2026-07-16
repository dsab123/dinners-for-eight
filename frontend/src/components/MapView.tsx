import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getConfig } from "../api/client";
import type { GuestRegistration, HostRegistration, MatchRun } from "../types";

interface MapViewProps {
  hosts: HostRegistration[];
  guests: GuestRegistration[];
  matchRun?: MatchRun | null;
}

export function MapView({ hosts, guests, matchRun }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = getConfig().mapboxToken;
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      zoom: 10,
      center: [-98.5795, 39.8283],
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const escapeHtml = (s: string) =>
      s.replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
      );

    const popupHtml = (name: string, role: string, detail: string) =>
      `<div class="map-popup"><strong>${escapeHtml(name)}</strong>` +
      `<span class="map-popup__role">${role}</span>` +
      `<span class="map-popup__detail">${escapeHtml(detail)}</span></div>`;

    // Show the popup on hover rather than click.
    const addHoverMarker = (
      el: HTMLElement,
      lngLat: [number, number],
      html: string
    ) => {
      const popup = new mapboxgl.Popup({
        offset: 12,
        closeButton: false,
        closeOnClick: false,
      }).setHTML(html);
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(lngLat)
        .addTo(map);
      el.style.cursor = "pointer";
      el.addEventListener("mouseenter", () => {
        popup.setLngLat(lngLat).addTo(map);
      });
      el.addEventListener("mouseleave", () => popup.remove());
      return marker;
    };

    const applyMarkers = () => {
      document.querySelectorAll(".d4e-marker").forEach((el) => el.remove());

      const bounds = new mapboxgl.LngLatBounds();
      const points: [number, number][] = [];

      hosts.forEach((host) => {
        const el = document.createElement("div");
        el.className = "d4e-marker";
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.background = "#d69a2d";
        el.style.border = "2px solid #263129";

        addHoverMarker(
          el,
          [host.lng, host.lat],
          popupHtml(
            host.fullName,
            "Host",
            `Seats ${host.targetCapacity} (±${host.flex})`
          )
        );
        bounds.extend([host.lng, host.lat]);
        points.push([host.lng, host.lat]);
      });

      guests.forEach((guest) => {
        const el = document.createElement("div");
        el.className = "d4e-marker";
        el.style.width = "12px";
        el.style.height = "12px";
        el.style.borderRadius = "3px";
        el.style.background = "#a6452e";
        el.style.border = "2px solid #263129";

        const people = guest.adults + guest.children;
        addHoverMarker(
          el,
          [guest.lng, guest.lat],
          popupHtml(
            guest.fullName,
            "Guest",
            `${people} ${people === 1 ? "person" : "people"} · ` +
              `${guest.adults} adult${guest.adults === 1 ? "" : "s"}, ` +
              `${guest.children} child${guest.children === 1 ? "" : "ren"}`
          )
        );
        bounds.extend([guest.lng, guest.lat]);
        points.push([guest.lng, guest.lat]);
      });

      if (points.length > 0) {
        map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 });
      }
    };

    if (map.isStyleLoaded()) applyMarkers();
    else map.once("load", applyMarkers);
  }, [hosts, guests]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !matchRun) return;

    const drawLines = () => {
      if (map.getSource("assignments")) {
        map.removeLayer("assignments-layer");
        map.removeSource("assignments");
      }

      const hostsById = new Map(hosts.map((h) => [h.id, h]));
      const guestsById = new Map(guests.map((g) => [g.id, g]));

      const features = matchRun.assignments.flatMap((assignment) => {
        const host = hostsById.get(assignment.hostId);
        if (!host) return [];
        return assignment.guestIds.flatMap((guestId) => {
          const guest = guestsById.get(guestId);
          if (!guest) return [];
          return [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: [
                  [host.lng, host.lat],
                  [guest.lng, guest.lat],
                ],
              },
            },
          ];
        });
      });

      map.addSource("assignments", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });
      map.addLayer({
        id: "assignments-layer",
        type: "line",
        source: "assignments",
        paint: { "line-color": "#5c6b62", "line-width": 1.5, "line-dasharray": [2, 2] },
      });
    };

    if (map.isStyleLoaded()) drawLines();
    else map.once("load", drawLines);
  }, [matchRun, hosts, guests]);

  return (
    <div className="map-wrap">
      <div className="map-container" ref={containerRef} />
      <div className="map-legend">
        <span className="map-legend__item">
          <span className="map-legend__swatch map-legend__swatch--host" />
          Host
        </span>
        <span className="map-legend__item">
          <span className="map-legend__swatch map-legend__swatch--guest" />
          Guest
        </span>
      </div>
    </div>
  );
}
