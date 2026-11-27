import React, { useEffect, useRef } from "react";
import L from "leaflet";

interface Props {
  pickupLat: number;
  pickupLng: number;
  pickupLabel: string;
  dropLat: number;
  dropLng: number;
  dropLabel: string;
  riderLat?: number;
  riderLng?: number;
  riderLabel?: string;
  className?: string;
}

export const DeliveryMap: React.FC<Props> = ({
  pickupLat,
  pickupLng,
  pickupLabel,
  dropLat,
  dropLng,
  dropLabel,
  riderLat,
  riderLng,
  riderLabel = "Delivery Partner",
  className = "h-72 w-full rounded-2xl overflow-hidden border border-charcoal/10",
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      center: [(pickupLat + dropLat) / 2, (pickupLng + dropLng) / 2],
      zoom: 13,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const points: L.LatLngExpression[] = [
      [pickupLat, pickupLng],
      [dropLat, dropLng],
    ];

    const pickupIcon = L.divIcon({
      className: "",
      html: `<div style="background:#171717;color:#F7F3EA;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;border:2px solid #F47738;">Kitchen</div>`,
      iconSize: [70, 24],
      iconAnchor: [35, 12],
    });

    const dropIcon = L.divIcon({
      className: "",
      html: `<div style="background:#F47738;color:#FFFFFF;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;border:2px solid #171717;">Drop-off</div>`,
      iconSize: [70, 24],
      iconAnchor: [35, 12],
    });

    L.marker([pickupLat, pickupLng], { icon: pickupIcon }).addTo(map).bindPopup(pickupLabel);
    L.marker([dropLat, dropLng], { icon: dropIcon }).addTo(map).bindPopup(dropLabel);

    if (riderLat && riderLng) {
      const riderIcon = L.divIcon({
        className: "",
        html: `<div style="background:#858B65;color:#FFFFFF;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;border:2px solid #FFFFFF;">Fleet</div>`,
        iconSize: [56, 24],
        iconAnchor: [28, 12],
      });
      L.marker([riderLat, riderLng], { icon: riderIcon }).addTo(map).bindPopup(riderLabel);
      points.push([riderLat, riderLng]);
    }

    L.polyline(
      [
        [pickupLat, pickupLng],
        [dropLat, dropLng],
      ],
      { color: "#F47738", weight: 3, dashArray: "6 6" }
    ).addTo(map);

    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [pickupLat, pickupLng, pickupLabel, dropLat, dropLng, dropLabel, riderLat, riderLng, riderLabel]);

  return <div ref={containerRef} className={className} />;
};
