import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { listUniversities } from '../services/universityService.js';
import { DISTRICTS } from '../utils/constants.js';

const selectClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm w-full sm:w-auto';

export default function Universities() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ universities: [], pagination: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const page = searchParams.get('page') || '1';
  const filters = {
    district: searchParams.get('district') || '',
    researchArea: searchParams.get('researchArea') || '',
    expertise: searchParams.get('expertise') || '',
    department: searchParams.get('department') || '',
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');

    const params = { page, limit: 12 };
    Object.entries(filters).forEach(([k, v]) => v && (params[k] = v));

    listUniversities(params)
      .then((res) => !cancelled && setData(res))
      .catch(() => !cancelled && setError('Failed to load universities.'))
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Universities</h1>
        <p className="text-sm text-gray-500">
          Institutions solving Jharkhand's challenges through research and innovation.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        {[
          { key: 'researchArea', placeholder: 'Research area' },
          { key: 'expertise', placeholder: 'Expertise' },
          { key: 'department', placeholder: 'Department' },
        ].map((f) => (
          <input
            key={f.key}
            value={filters[f.key]}
            onChange={(e) => setFilter(f.key, e.target.value)}
            placeholder={`${f.placeholder} (contains...)`}
            className={selectClass}
          />
        ))}
      </div>

      {isLoading ? (
        <p className="py-20 text-center text-gray-500">Loading universities...</p>
      ) : error ? (
        <p className="py-20 text-center text-red-600">{error}</p>
      ) : data.universities.length === 0 ? (
        <p className="py-20 text-center text-gray-500">
          No university profiles found yet.
        </p>
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.universities.map((u) => (
              <li key={u._id}>
                <Link
                  to={`/universities/${u._id}`}
                  className="flex h-full flex-col rounded-xl border border-gray-200 p-5 transition-colors hover:border-johar-green-700"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {(u.researchAreas || []).slice(0, 2).map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-johar-green-50 px-2.5 py-0.5 text-xs text-johar-green-700"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <h2 className="mt-2 line-clamp-2 font-semibold">{u.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{u.description}</p>
                  <div className="mt-auto flex items-center justify-between pt-4 text-xs text-gray-500">
                    <span>{(u.districtsCovered || []).slice(0, 2).join(', ') || 'Jharkhand'}</span>
                    {u.verificationStatus === 'verified' && (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700">
                        Verified
                      </span>
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
