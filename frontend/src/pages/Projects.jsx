import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { listProjects } from '../services/projectService.js';
import { CATEGORIES, DISTRICTS } from '../utils/constants.js';

const STATUS_LABELS = {
  proposed: 'Proposed',
  approved: 'Approved',
  team_formation: 'Team Formation',
  development: 'Development',
  testing: 'Testing',
  pilot: 'Pilot',
  deployed: 'Deployed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const selectClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm w-full sm:w-auto';

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ projects: [], pagination: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const page = searchParams.get('page') || '1';
  const filters = {
    status: searchParams.get('status') || '',
    category: searchParams.get('category') || '',
    district: searchParams.get('district') || '',
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');

    const params = { page, limit: 12 };
    Object.entries(filters).forEach(([k, v]) => v && (params[k] = v));

    listProjects(params)
      .then((res) => !cancelled && setData(res))
      .catch(() => !cancelled && setError('Failed to load projects.'))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">Solution Projects</h1>
      <p className="mt-1 text-sm text-gray-500">
        University-led projects solving Jharkhand's societal challenges.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <select
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          className={selectClass}
        >
          <option value="">Any Status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={filters.category}
          onChange={(e) => setFilter('category', e.target.value)}
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
          onChange={(e) => setFilter('district', e.target.value)}
          className={selectClass}
        >
          <option value="">All Districts</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="py-20 text-center text-gray-500">Loading projects...</p>
      ) : error ? (
        <p className="py-20 text-center text-red-600">{error}</p>
      ) : data.projects.length === 0 ? (
        <p className="py-20 text-center text-gray-500">No projects found yet.</p>
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.projects.map((pr) => (
              <li key={pr._id}>
                <Link
                  to={`/projects/${pr._id}`}
                  className="flex h-full flex-col rounded-xl border border-gray-200 p-5 transition-colors hover:border-johar-green-700"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                      {STATUS_LABELS[pr.status] || pr.status}
                    </span>
                    {pr.currentProgress > 0 && (
                      <span className="text-xs font-medium text-johar-green-700">
                        {pr.currentProgress}% complete
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1.5 line-clamp-2 font-semibold">{pr.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{pr.description}</p>
                  <div className="mt-auto pt-4 text-xs text-gray-500">
                    <p>
                      {CATEGORIES.find((c) => c.value === pr.challenge?.category)?.label ||
                        pr.challenge?.category}{' '}
                      · {pr.challenge?.district}
                    </p>
                    <p className="mt-0.5">{pr.university?.name}</p>
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
                onClick={() => setFilter('page', String(data.pagination.page - 1))}
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
                onClick={() => setFilter('page', String(data.pagination.page + 1))}
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
