import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getNearbyDiscussions, listDiscussions } from '../services/discussionService.js';
import { CATEGORIES, DISTRICTS, DISTRICT_COORDS, RADIUS_OPTIONS } from '../utils/constants.js';
import { describeGeoError, getCurrentPosition } from '../utils/geo.js';

const selectClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm w-full sm:w-auto';

const fmtDate = (d) => new Date(d).toLocaleDateString();

export default function Samvaad() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ discussions: [], pagination: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [locMessage, setLocMessage] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const filters = {
    lat: searchParams.get('lat'),
    lng: searchParams.get('lng'),
    district: searchParams.get('district') || '',
    category: searchParams.get('category') || '',
    radius: Number(searchParams.get('radius')) || 5,
    status: searchParams.get('status') || 'active',
  };
  const page = searchParams.get('page') || '1';
  const hasCoords = filters.lat && filters.lng;
  const searchLabel = hasCoords
    ? filters.district
      ? `${filters.district} · within ${filters.radius} km`
      : `Within ${filters.radius} km of you`
    : filters.district
      ? filters.district
      : 'All of Jharkhand';

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');

    const params = { page, limit: 12, category: filters.category, district: filters.district };
    const request =
      hasCoords
        ? getNearbyDiscussions({
            latitude: filters.lat,
            longitude: filters.lng,
            radius: filters.radius,
            category: filters.category,
            district: filters.district,
            page,
            limit: 12,
          })
        : listDiscussions(params);

    request
      .then((res) => !cancelled && setData({ discussions: res.discussions || [], pagination: res.pagination }))
      .catch(() => !cancelled && setError('Failed to load discussions.'))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value !== '' && value !== null && value !== undefined) next.set(key, value);
    else next.delete(key);
    if (!['page'].includes(key)) next.delete('page');
    setSearchParams(next);
  }

  function setDistrict(district) {
    const next = new URLSearchParams(searchParams);
    if (district) {
      next.set('district', district);
      // switch to the district centroid so radius search works without GPS
      const c = DISTRICT_COORDS[district];
      if (c) {
        next.set('lat', String(c[0]));
        next.set('lng', String(c[1]));
      }
    } else {
      next.delete('district');
      next.delete('lat');
      next.delete('lng');
    }
    next.delete('page');
    setSearchParams(next);
  }

  async function useMyLocation() {
    setIsLocating(true);
    setLocMessage('');
    try {
      const pos = await getCurrentPosition();
      const next = new URLSearchParams(searchParams);
      next.set('lat', pos.coords.latitude.toFixed(4));
      next.set('lng', pos.coords.longitude.toFixed(4));
      next.delete('page');
      setSearchParams(next);
    } catch (err) {
      setLocMessage(`${describeGeoError(err)} You can pick a district instead.`);
    } finally {
      setIsLocating(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Local Samvaad</h1>
          <p className="mt-1 text-sm text-gray-500">
            Community discussions around local problems — near Ranchi, or across Jharkhand.
          </p>
        </div>
        <Link
          to="/samvaad/new"
          className="rounded-lg bg-johar-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-johar-green-600"
        >
          + Start a Discussion
        </Link>
      </div>

      {/* Location & filters */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={filters.district}
          onChange={(e) => setDistrict(e.target.value)}
          className={selectClass}
        >
          <option value="">All Districts</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          value={filters.radius}
          onChange={(e) => setParam('radius', e.target.value)}
          className={selectClass}
          disabled={!hasCoords}
          title={hasCoords ? 'Search radius' : 'Select a district or share your location first'}
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              Within {r} km
            </option>
          ))}
        </select>

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

        <button
          type="button"
          onClick={useMyLocation}
          disabled={isLocating}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            hasCoords && !filters.district
              ? 'border-johar-green-700 bg-johar-green-50 text-johar-green-700'
              : 'border-gray-300 text-gray-600 hover:border-johar-green-700 hover:text-johar-green-700'
          } disabled:opacity-50`}
        >
          {isLocating ? 'Detecting...' : '📍 Use my current location'}
        </button>
      </div>
      {locMessage && <p className="mt-2 text-xs text-amber-600">{locMessage}</p>}
      {!hasCoords && (
        <p className="mt-2 text-xs text-gray-400">
          Tip: choose a district or share your location once to find discussions within 1–25 km.
          Your exact location is never stored or shown publicly.
        </p>
      )}

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">
        Showing: {searchLabel} ({data.pagination?.total ?? 0} discussions)
      </p>

      {isLoading ? (
        <p className="py-20 text-center text-gray-500">Loading discussions...</p>
      ) : error ? (
        <p className="py-20 text-center text-red-600">{error}</p>
      ) : data.discussions.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">No discussions here yet.</p>
          <Link
            to="/samvaad/new"
            className="mt-2 inline-block font-medium text-johar-green-700 hover:underline"
          >
            Start the first one →
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.discussions.map((disc) => (
              <li key={disc._id}>
                <Link
                  to={`/samvaad/${disc._id}`}
                  className="flex h-full flex-col rounded-xl border border-gray-200 p-5 transition-colors hover:border-johar-green-700"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-johar-green-50 px-2 py-0.5 font-medium capitalize text-johar-green-700">
                      {(CATEGORIES.find((c) => c.value === disc.category)?.label || disc.category).replace(/_/g, ' ')}
                    </span>
                    {disc.approximateDistance && (
                      <span className="text-gray-500">{disc.approximateDistance}</span>
                    )}
                    {disc.status === 'closed' && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">Closed</span>
                    )}
                  </div>
                  <h2 className="mt-1.5 line-clamp-2 font-semibold">{disc.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                    {disc.shortDescription || disc.description}
                  </p>
                  <div className="mt-auto pt-4 text-xs text-gray-500">
                    <p>
                      Near {disc.district} · 👥 {disc.participantCount} participant
                      {disc.participantCount === 1 ? '' : 's'}
                      {disc.commentCount > 0 && ` · 💬 ${disc.commentCount}`}
                    </p>
                    {disc.relatedChallenge && (
                      <p className="mt-0.5 line-clamp-1">
                        Related challenge:{' '}
                        <span className="font-medium">{disc.relatedChallenge.title}</span>
                      </p>
                    )}
                    <p className="mt-0.5">{fmtDate(disc.createdAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {data.pagination.totalPages > 1 && (
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
