import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  listChallenges,
  getNearbyChallenges,
  getAreaSummary,
} from '../services/challengeService.js';
import ChallengesMap from '../components/ChallengesMap.jsx';
import { CATEGORIES, DISTRICTS, DISTRICT_COORDS, SEVERITIES, RADIUS_OPTIONS, JHARKHAND_CENTER } from '../utils/constants.js';
import { describeGeoError, getCurrentPosition } from '../utils/geo.js';

const STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  validated: 'Validated',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

const SEVERITY_STYLES = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700',
};

const selectClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm w-full sm:w-auto';

export default function Challenges() {
  const [searchParams, setSearchParams] = useSearchParams();

  const view = searchParams.get('view') === 'map' ? 'map' : 'list';
  const discoveryMode = searchParams.get('mode') === 'nearby' ? 'nearby' : 'district';
  const radius = Number(searchParams.get('radius')) || 5;
  const page = Number(searchParams.get('page')) || 1;

  const filters = {
    category: searchParams.get('category') || '',
    district: searchParams.get('district') || '',
    severity: searchParams.get('severity') || '',
    status: searchParams.get('status') || '',
  };

  const [data, setData] = useState({ challenges: [], pagination: null });
  const [summary, setSummary] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [geoStatus, setGeoStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  // Browser geolocation — only on explicit user action
  async function requestLocation() {
    setGeoStatus('Getting your location...');
    try {
      const pos = await getCurrentPosition();
      setUserLocation([
        Number(pos.coords.latitude.toFixed(4)),
        Number(pos.coords.longitude.toFixed(4)),
      ]);
      setGeoStatus('Showing challenges near you.');
      if (discoveryMode !== 'nearby') setParam('mode', 'nearby');
    } catch (err) {
      setGeoStatus(`${describeGeoError(err)} Pick a district instead.`);
    }
  }

  const queryParams = useMemo(() => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => v && (params[k] = v));
    return params;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    setSummary(null);

    async function load() {
      try {
        if (discoveryMode === 'nearby') {
          if (!userLocation) {
            setData({ challenges: [], pagination: null });
            setIsLoading(false);
            return;
          }
          const [nearRes, sumRes] = await Promise.allSettled([
            getNearbyChallenges({
              latitude: userLocation[0],
              longitude: userLocation[1],
              radius,
              ...queryParams,
            }),
            getAreaSummary({
              latitude: userLocation[0],
              longitude: userLocation[1],
              radius,
            }),
          ]);
          if (cancelled) return;
          if (nearRes.status === 'fulfilled') {
            setData({ challenges: nearRes.value.challenges, pagination: null });
          } else {
            setError('Could not load nearby challenges.');
          }
          if (sumRes.status === 'fulfilled') setSummary(sumRes.value.summary);
        } else {
          const listParams = { page, limit: 12, ...queryParams };
          const requests = [
            listChallenges(listParams),
            getAreaSummary(
              filters.district
                ? { district: filters.district }
                : { latitude: JHARKHAND_CENTER[0], longitude: JHARKHAND_CENTER[1], radius: 25 }
            ),
          ];
          const [listRes, sumRes] = await Promise.allSettled(requests);
          if (cancelled) return;
          if (listRes.status === 'fulfilled') setData(listRes.value);
          else setError('Failed to load challenges.');
          if (sumRes.status === 'fulfilled') setSummary(sumRes.value.summary);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, discoveryMode, userLocation]);

  const mapChallenges = data.challenges.filter((c) => c.coordinates?.length === 2);
  const mapCenter =
    discoveryMode === 'nearby' && userLocation
      ? userLocation
      : filters.district && DISTRICT_COORDS[filters.district]
        ? DISTRICT_COORDS[filters.district]
        : JHARKHAND_CENTER;

  const showNearbyPrompt = discoveryMode === 'nearby' && !userLocation;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Explore Problems</h1>
        <div className="flex rounded-lg border border-gray-300 p-0.5" role="tablist">
          {['list', 'map'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setParam('view', v === 'map' ? 'map' : '')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                view === v ? 'bg-johar-green-700 text-white' : 'text-gray-600 hover:text-johar-green-700'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Discovery mode toggle */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Discover by:</span>
        {[
          { value: 'district', label: 'District' },
          { value: 'nearby', label: 'Near me' },
        ].map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setParam('mode', m.value === 'nearby' ? 'nearby' : '')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              discoveryMode === m.value
                ? 'bg-johar-green-700 text-white'
                : 'border border-gray-300 text-gray-600 hover:border-johar-green-700 hover:text-johar-green-700'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Filters / controls */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {discoveryMode === 'district' && (
          <select
            value={filters.district}
            onChange={(e) => setParam('district', e.target.value)}
            className={selectClass}
          >
            <option value="">All Districts</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
        {discoveryMode === 'nearby' && (
          <div className="col-span-2 flex items-center gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={requestLocation}
              className={`${selectClass} whitespace-nowrap border-johar-green-700 font-medium text-johar-green-700`}
            >
              Use my current location
            </button>
            <select
              value={radius}
              onChange={(e) => setParam('radius', e.target.value)}
              className={selectClass}
              disabled={!userLocation}
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  Within {r} km
                </option>
              ))}
            </select>
          </div>
        )}
        <select
          value={filters.category}
          onChange={(e) => setParam('category', e.target.value)}
          className={selectClass}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={filters.severity}
          onChange={(e) => setParam('severity', e.target.value)}
          className={selectClass}
        >
          <option value="">Any Severity</option>
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setParam('status', e.target.value)}
          className={selectClass}
        >
          <option value="">Any Status</option>
          <option value="active">Active</option>
          <option value="submitted">Submitted</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {discoveryMode === 'nearby' && geoStatus && !showNearbyPrompt && (
        <p className="mt-2 text-xs text-gray-500">{geoStatus}</p>
      )}

      {/* Summary cards */}
      {summary && summary.total > 0 && (
        <div className="mt-6 rounded-xl bg-johar-earth-50 p-5">
          <p className="text-sm font-semibold text-johar-earth-700">
            {discoveryMode === 'nearby'
              ? `Within ${radius} km of you`
              : filters.district || 'Jharkhand overview'}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span>
              Total: <b>{summary.total}</b>
            </span>
            {summary.topCategories.map((tc) => (
              <span key={tc.category} className="capitalize text-gray-600">
                {CATEGORIES.find((c) => c.value === tc.category)?.label || tc.category}:{' '}
                <b>{tc.count}</b>
              </span>
            ))}
            <span>
              High/Critical: <b className="text-red-600">{summary.highCritical}</b>
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <p className="py-20 text-center text-gray-500">Loading challenges...</p>
      ) : error ? (
        <p className="py-20 text-center text-red-600">{error}</p>
      ) : showNearbyPrompt ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">
            Share your location once to see problems around you — or switch back to district
            discovery.
          </p>
          <button
            type="button"
            onClick={requestLocation}
            className="mt-4 rounded-lg bg-johar-green-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-johar-green-600"
          >
            Use my current location
          </button>
        </div>
      ) : data.challenges.length === 0 ? (
        <p className="py-20 text-center text-gray-500">
          No challenges found here yet.
        </p>
      ) : view === 'map' ? (
        <div className="mt-6">
          {mapChallenges.length === 0 ? (
            <p className="py-12 text-center text-gray-500">
              None of these challenges have a usable location on the map.
            </p>
          ) : (
            <ChallengesMap
              challenges={mapChallenges}
              center={mapCenter}
              zoom={discoveryMode === 'nearby' ? 11 : filters.district ? 9 : 7}
              userLocation={discoveryMode === 'nearby' ? userLocation : null}
            />
          )}
          <p className="mt-2 text-xs text-gray-400">
            Marker colors: red = critical, orange = high, blue = medium, gray = low.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.challenges.map((ch) => (
              <li key={ch._id}>
                <Link
                  to={`/challenges/${ch._id}`}
                  className="flex h-full flex-col rounded-xl border border-gray-200 p-5 transition-colors hover:border-johar-green-700"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-johar-green-700">
                      {CATEGORIES.find((c) => c.value === ch.category)?.label || ch.category}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLES[ch.severity]}`}>
                      {ch.severity}
                    </span>
                    {ch.priorityScore > 0 && (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                        AI Priority {ch.priorityScore}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1.5 line-clamp-2 font-semibold">{ch.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{ch.description}</p>
                  <div className="mt-auto flex items-center justify-between pt-4 text-xs text-gray-500">
                    <span>
                      {discoveryMode === 'nearby' && ch.distanceKm !== undefined
                        ? `${ch.distanceKm} km away · `
                        : ''}
                      {ch.district}
                      {ch.communityValidation?.supportCount > 0 &&
                        ` · ${ch.communityValidation.supportCount} supporting`}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">
                      {STATUS_LABELS[ch.status] || ch.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {data.pagination && data.pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={!data.pagination.hasPrevPage}
                onClick={() => setParam('page', String(data.pagination.page - 1))}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={!data.pagination.hasNextPage}
                onClick={() => setParam('page', String(data.pagination.page + 1))}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
