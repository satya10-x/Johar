import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import api from '../services/api.js';
import { CATEGORIES, SEVERITIES } from '../utils/constants.js';

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

export default function MyReports() {
  const [data, setData] = useState({ challenges: [], pagination: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');

    api
      .get('/challenges/mine', { params: { page, limit: 10 } })
      .then((res) => !cancelled && setData(res.data))
      .catch(() => !cancelled && setError('Failed to load your reports.'))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Reports</h1>
        <Link
          to="/report"
          className="rounded-lg bg-johar-green-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-johar-green-600"
        >
          Report a Problem
        </Link>
      </div>

      {isLoading ? (
        <p className="py-20 text-center text-gray-500">Loading your reports...</p>
      ) : error ? (
        <p className="py-20 text-center text-red-600">{error}</p>
      ) : data.challenges.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-gray-500">You haven't reported any problems yet.</p>
          <Link
            to="/report"
            className="mt-4 inline-block rounded-lg bg-johar-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-johar-green-600"
          >
            Report your first problem
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-8 space-y-3">
            {data.challenges.map((ch) => {
              const severityLabel =
                SEVERITIES.find((s) => s.value === ch.severity)?.label || ch.severity;
              return (
                <li key={ch._id}>
                  <Link
                    to={`/challenges/${ch._id}`}
                    className="block rounded-xl border border-gray-200 p-5 transition-colors hover:border-johar-green-700"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium uppercase tracking-wide text-johar-green-700">
                        {CATEGORIES.find((c) => c.value === ch.category)?.label || ch.category}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${SEVERITY_STYLES[ch.severity]}`}>
                        {severityLabel}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5">
                        {STATUS_LABELS[ch.status] || ch.status}
                      </span>
                    </div>
                    <h2 className="mt-1.5 font-semibold">{ch.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>{new Date(ch.createdAt).toLocaleDateString()}</span>
                      {ch.priorityScore > 0 && <span>AI Priority: {ch.priorityScore}/100</span>}
                      <span>{ch.communityValidation?.supportCount || 0} supporting</span>
                      <span>{ch.district}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {data.pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={!data.pagination.hasPrevPage}
                onClick={() => setPage((v) => v - 1)}
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
                onClick={() => setPage((v) => v + 1)}
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
