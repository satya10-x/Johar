import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { listSolutions } from '../services/solutionService.js';
import { CATEGORIES, DISTRICTS } from '../utils/constants.js';

const selectClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm w-full sm:w-auto';
const fmtNum = (n) =>
  n === undefined || n === null ? '—' : Number(n).toLocaleString('en-IN');

export default function Solutions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ solutions: [], pagination: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const filters = {
    category: searchParams.get('category') || '',
    district: searchParams.get('district') || '',
    technology: searchParams.get('technology') || '',
    status: searchParams.get('status') || '',
    minImpactScore: searchParams.get('minImpactScore') || '',
  };
  const page = searchParams.get('page') || '1';

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    listSolutions({ ...filters, page, limit: 12 })
      .then((res) => !cancelled && setData({ solutions: res.solutions || [], pagination: res.pagination }))
      .catch(() => !cancelled && setError('Failed to load the solution library.'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Solution Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            Deployed and completed projects with recorded impact — proven solutions that may be
            replicated in other districts of Jharkhand.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <input
          value={filters.technology}
          onChange={(e) => setParam('technology', e.target.value)}
          placeholder="Filter by technology..."
          className={`${selectClass}`}
        />
        <select
          value={filters.minImpactScore}
          onChange={(e) => setParam('minImpactScore', e.target.value)}
          className={selectClass}
        >
          <option value="">Any impact score</option>
          <option value="40">Score 40+</option>
          <option value="60">Score 60+</option>
          <option value="80">Score 80+</option>
        </select>
      </div>

      {isLoading ? (
        <p className="py-20 text-center text-gray-500">Loading solutions...</p>
      ) : error ? (
        <p className="py-20 text-center text-red-600">{error}</p>
      ) : data.solutions.length === 0 ? (
        <p className="py-16 text-center text-gray-500">
          No solutions in the library yet. Deployed projects with recorded impact appear here.
        </p>
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.solutions.map((s) => (
              <li key={s._id}>
                <Link
                  to={`/solutions/${s._id}`}
                  className="flex h-full flex-col rounded-xl border border-gray-200 p-5 transition-colors hover:border-johar-green-700"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-johar-green-50 px-2 py-0.5 font-medium capitalize text-johar-green-700">
                      {(CATEGORIES.find((c) => c.value === s.category)?.label || s.category || 'General').replace(/_/g, ' ')}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 capitalize text-gray-500">
                      {String(s.deploymentStatus).replace(/_/g, ' ')}
                    </span>
                    {s.impactScore > 0 && (
                      <span className="rounded-full bg-johar-green-700 px-2 py-0.5 font-bold text-white">
                        {s.impactScore}/100
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 line-clamp-2 font-semibold">{s.title}</h2>
                  {s.problemSolved && (
                    <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                      Problem solved: {s.problemSolved}
                    </p>
                  )}
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{s.description}</p>
                  <div className="mt-auto pt-4 text-xs text-gray-500">
                    {s.university && <p>🏛 {s.university}</p>}
                    <p className="mt-0.5">
                      👥 {fmtNum(s.peopleBenefited)} people benefited
                      {s.villagesCovered ? ` · ${fmtNum(s.villagesCovered)} villages` : ''}
                    </p>
                    {s.districtsCovered?.length > 0 && (
                      <p className="mt-0.5 line-clamp-1">📍 {s.districtsCovered.join(', ')}</p>
                    )}
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
