import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

import { CATEGORIES } from '../utils/constants.js';

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#2563eb',
  low: '#6b7280',
};

const SEVERITY_RADIUS = {
  critical: 9,
  high: 8,
  medium: 6,
  low: 5,
};

export default function ChallengesMap({
  challenges,
  center,
  zoom = 8,
  userLocation,
}) {
  return (
    <div className="h-[420px] overflow-hidden rounded-xl border border-gray-200 sm:h-[520px]">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <CircleMarker
            center={[userLocation[0], userLocation[1]]}
            radius={7}
            pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.9 }}
          >
            <Popup>You are here (approximate)</Popup>
          </CircleMarker>
        )}

        {challenges.map((ch) => (
          <CircleMarker
            key={ch._id}
            center={[ch.coordinates[1], ch.coordinates[0]]}
            radius={SEVERITY_RADIUS[ch.severity] || 6}
            pathOptions={{
              color: SEVERITY_COLORS[ch.severity] || '#6b7280',
              fillColor: SEVERITY_COLORS[ch.severity] || '#6b7280',
              fillOpacity: 0.65,
              weight: 2,
            }}
          >
            <Popup>
              <div className="min-w-[180px] text-sm">
                <p className="font-semibold">{ch.title}</p>
                <p className="mt-1 text-xs capitalize text-gray-600">
                  {CATEGORIES.find((c) => c.value === ch.category)?.label || ch.category}
                  {' · '}
                  <span className="capitalize">{ch.severity}</span> severity
                </p>
                <p className="text-xs text-gray-600">
                  Status: <span className="capitalize">{String(ch.status).replace(/_/g, ' ')}</span>
                  {ch.distanceKm !== undefined && ` · ${ch.distanceKm} km away`}
                </p>
                <Link
                  to={`/challenges/${ch._id}`}
                  className="mt-2 inline-block rounded bg-johar-green-700 px-2.5 py-1 text-xs font-semibold text-white"
                >
                  View Challenge
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
