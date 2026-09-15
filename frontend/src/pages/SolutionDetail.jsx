import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getSolution } from '../services/solutionService.js';
import { getReplicationOpportunities } from '../services/projectService.js';
import { CATEGORIES } from '../utils/constants.js';

const fmtNum = (n) =>
  n === undefined || n === null ? 'Not available' : Number(n).toLocaleString('en-IN');
const fmtINR = (n) =>
  Number.isFinite(n) ? `₹${Number(n).toLocaleString('en-IN')}` : 'Not available';

export default function SolutionDetail() {
  const { id } = useParams();
  const [solution, setSolution] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [replication, setReplication] = useState(null);
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getSolution(id)
      .then((res) => !cancelled && setSolution(res.solution))
      .catch((err) => !cancelled && setError(err.response?.data?.message || 'Failed to load solution.'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function loadReplication() {
    setIsMatching(true);
    try {
      const res = await getReplicationOpportunities(id);
      setReplication(res.opportunities || []);
    } catch {
      setReplication([]);
    } finally {
      setIsMatching(false);
    }
  }

  if (isLoading) return <p className="py-24 text-center text-gray-500">Loading solution...</p>;
  if (!solution)
    return (
      <div className="py-24 text-center">
        <p className="text-red-600">{error || 'Solution not found.'}</p>
        <Link to="/solutions" className="mt-3 inline-block text-sm text-johar-green-700 hover:underline">
          ← Back to Solution Library
        </Link>
      </div>
    );

  const impact = solution.impact;
  const categoryLabel =
    CATEGORIES.find((c) => c.value === solution.category)?.label ||
    String(solution.category || '').replace(/_/g, ' ');

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link to="/solutions" className="text-sm text-gray-500 hover:text-johar-green-700">
        ← Solution Library
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-johar-green-50 px-2 py-0.5 font-medium capitalize text-johar-green-700">
            {categoryLabel}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 capitalize text-gray-500">
            {String(solution.deploymentStatus).replace(/_/g, ' ')}
          </span>
          {solution.impactScore > 0 && (
            <span className="rounded-full bg-johar-green-700 px-3 py-1 font-bold text-white">
              Impact Score: {solution.impactScore}/100
            </span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-bold">{solution.title}</h1>
        {solution.problemSolved && (
          <p className="mt-2 text-sm text-gray-600">
            Problem solved:{' '}
            {solution.projectId && (
              <Link
                to={`/projects/${solution.projectId}`}
                className="font-medium text-johar-green-700 hover:underline"
              >
                view full project
              </Link>
            )}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          {solution.university ? `Implemented by ${solution.university}` : 'University TBD'}
          {solution.industryPartners?.length > 0 &&
            ` · with ${solution.industryPartners.join(', ')}`}
        </p>
      </header>

      <p className="mt-5 leading-relaxed text-gray-800">{solution.description}</p>

      {/* Implementation requirements */}
      {solution.implementationRequirements?.length > 0 && (
        <section className="mt-6 rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold">Implementation Requirements</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {solution.implementationRequirements.map((r) => (
              <li
                key={r}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs capitalize text-gray-700"
              >
                {String(r).replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Impact summary */}
      <section className="mt-8 rounded-xl border border-johar-green-600/20 bg-johar-green-50/50 p-5">
        <h2 className="font-semibold">Recorded Impact</h2>
        {!impact ? (
          <p className="mt-2 text-sm text-gray-500">
            Detailed impact has not been recorded for this solution yet.
          </p>
        ) : (
          <>
            {(impact.aiSummary || impact.impactSummary) && (
              <div className="mt-3 rounded-lg bg-white p-4 text-sm leading-relaxed text-gray-800">
                {impact.aiSummary || impact.impactSummary}
                {impact.aiSummary && (
                  <span className="ml-2 inline-block rounded-full bg-purple-100 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                    AI-assisted
                  </span>
                )}
              </div>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ['People benefited', fmtNum(impact.peopleBenefited)],
                ['Villages covered', fmtNum(impact.villagesCovered)],
                [
                  'Community satisfaction',
                  Number.isFinite(impact.communitySatisfaction)
                    ? `${impact.communitySatisfaction}%`
                    : 'Not available',
                ],
                ['Cost', fmtINR(impact.implementationCost)],
                ['Estimated savings', fmtINR(impact.estimatedSavings)],
                ['Jobs created', fmtNum(impact.jobsCreated)],
                [
                  'Districts implemented',
                  impact.districtsCovered?.length
                    ? impact.districtsCovered.join(', ')
                    : solution.districtsCovered?.length
                      ? solution.districtsCovered.join(', ')
                      : 'Not available',
                ],
                [
                  'Deployment status',
                  String(solution.deploymentStatus).replace(/_/g, ' '),
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white p-3">
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
                  <dd className="mt-0.5 font-semibold capitalize">{value}</dd>
                </div>
              ))}
            </dl>

            {impact.metrics?.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Metric</th>
                      <th className="px-3 py-2 text-center font-medium">Before</th>
                      <th className="px-3 py-2 text-center font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {impact.metrics.map((m, i) => (
                      <tr key={i} className="divide-x divide-gray-100">
                        <td className="px-3 py-2 font-medium">{m.metric}</td>
                        <td className="px-3 py-2 text-center">
                          {Number.isFinite(m.before) ? `${m.before}${m.unit ? ` ${m.unit}` : ''}` : '—'}
                        </td>
                        <td
                          className={`px-3 py-2 text-center ${
                            Number.isFinite(m.after) && m.after > m.before
                              ? 'font-semibold text-johar-green-700'
                              : ''
                          }`}
                        >
                          {Number.isFinite(m.after) ? `${m.after}${m.unit ? ` ${m.unit}` : ''}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* Replication */}
      <section className="mt-8">
        <h2 className="font-semibold">Potential Replication Opportunities</h2>
        <p className="mt-1 text-xs text-gray-500">
          Open challenges in other districts where this proven approach may apply. Replication
          requires human/institutional approval — JOHAR never assigns solutions automatically.
        </p>

        {!replication ? (
          <button
            type="button"
            onClick={loadReplication}
            disabled={isMatching}
            className="mt-3 rounded-lg bg-johar-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-johar-green-600 disabled:opacity-50"
          >
            {isMatching ? 'Analyzing...' : 'Explore Similar Problems →'}
          </button>
        ) : replication.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No suitable open challenges found right now.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {replication.map((o) => (
              <li
                key={o.challengeId}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {o.district}
                    {o.severity ? ` · severity: ${o.severity}` : ''}
                  </p>
                  {o.reason && <p className="mt-1 text-xs text-gray-600">{o.reason}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      o.matchScore >= 70
                        ? 'bg-green-100 text-green-700'
                        : o.matchScore >= 55
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {o.matchScore}% match
                  </span>
                  <Link
                    to={`/challenges/${o.challengeId}`}
                    className="rounded-lg border border-johar-green-700 px-4 py-2 text-sm font-medium text-johar-green-700 hover:bg-green-50"
                  >
                    View Challenge
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
