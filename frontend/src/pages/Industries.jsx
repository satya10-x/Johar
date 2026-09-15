import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { listIndustries } from '../services/industryService.js';
import { DISTRICTS } from '../utils/constants.js';

const COMPANY_TYPES = [
  { value: 'startup', label: 'Startup' },
  { value: 'MSME', label: 'MSME' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'CSR', label: 'CSR Organization' },
  { value: 'research_organization', label: 'Research Organization' },
  { value: 'innovation_hub', label: 'Innovation Hub' },
];

const selectClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm w-full sm:w-auto';

export default function Industries() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ industries: [], pagination: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const page = searchParams.get('page') || '1';
  const filters = {
    district: searchParams.get('district') || '',
    companyType: searchParams.get('companyType') || '',
    expertise: searchParams.get('expertise') || '',
    technology: searchParams.get('technology') || '',
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');

    const params = { page, limit: 12 };
    Object.entries(filters).forEach(([k, v]) => v && (params[k] = v));

    listIndustries(params)
      .then((res) => !cancelled && setData(res))
      .catch(() => !cancelled && setError('Failed to load industries.'))
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
      <h1 className="text-2xl font-bold">Industries & Startups</h1>
      <p className="mt-1 text-sm text-gray-500">
        Companies supporting Jharkhand's challenges with mentorship, technology and resources.
      </p>

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
        <select
          value={filters.companyType}
          onChange={(e) => setFilter('companyType', e.target.value)}
          className={selectClass}
        >
          <option value="">All Types</option>
          {COMPANY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {[
          { key: 'expertise', placeholder: 'Expertise' },
          { key: 'technology', placeholder: 'Technology' },
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
        <p className="py-20 text-center text-gray-500">Loading companies...</p>
      ) : error ? (
        <p className="py-20 text-center text-red-600">{error}</p>
      ) : data.industries.length === 0 ? (
        <p className="py-20 text-center text-gray-500">No industry profiles found yet.</p>
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.industries.map((ind) => (
              <li key={ind._id}>
                <Link
                  to={`/industries/${ind._id}`}
                  className="flex h-full flex-col rounded-xl border border-gray-200 p-5 transition-colors hover:border-johar-green-700"
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-johar-earth-700">
                    {COMPANY_TYPES.find((t) => t.value === ind.companyType)?.label ||
                      ind.companyType}
                  </span>
                  <h2 className="mt-1.5 font-semibold">{ind.companyName}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{ind.description}</p>
                  <div className="mt-auto pt-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(ind.expertise || []).slice(0, 3).map((e) => (
                        <span key={e} className="rounded-full bg-johar-green-50 px-2.5 py-0.5 text-xs text-johar-green-700">
                          {e}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-gray-400">{ind.address || 'Jharkhand'}</p>
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
