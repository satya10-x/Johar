import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  getAdminDashboard,
  getChallengeAnalytics,
  getProjectAnalytics,
  getPriorityChallenges,
} from '../services/adminService.js';
import { CATEGORIES, DISTRICTS } from '../utils/constants.js';
import GovernmentMonitoring from '../components/GovernmentMonitoring.jsx';

const selectClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm w-full sm:w-auto';

const fmtDate = (d) => new Date(d).toLocaleDateString();
const fmtINR = (n) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
};
const fmtNum = (n) =>
  n === undefined || n === null ? 'Not available' : Number(n).toLocaleString('en-IN');

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-johar-green-700">{value}</p>
    </div>
  );
}

function BarChart({ title, items, labelKey, emptyText = 'No data yet.' }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item[labelKey]} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="capitalize text-gray-600">
                  {String(item[labelKey]).replace(/_/g, ' ')}
                </span>
                <span className="font-medium">{item.count}</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-johar-green-600"
                  style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_STYLES = {
  submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-amber-50 text-amber-700',
  validated: 'bg-purple-50 text-purple-700',
  assigned: 'bg-indigo-50 text-indigo-700',
  in_progress: 'bg-cyan-50 text-cyan-700',
  resolved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
};

export default function AdminDashboard() {
  const [dashboardMode, setDashboardMode] = useState('governance'); // 'governance' | 'analytics'
  const [district, setDistrict] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [challengeStats, setChallengeStats] = useState(null);
  const [projectStats, setProjectStats] = useState(null);
  const [priorityRows, setPriorityRows] = useState({ challenges: [], pagination: null });
  const [priorityPage, setPriorityPage] = useState(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');

    Promise.all([
      getAdminDashboard(district ? { district } : {}),
      getChallengeAnalytics(district ? { district } : {}),
      getProjectAnalytics(district ? { district } : {}),
    ])
      .then(([d, c, p]) => {
        if (cancelled) return;
        setDashboard(d);
        setChallengeStats(c);
        setProjectStats(p);
      })
      .catch(() => !cancelled && setError('Failed to load dashboard data.'))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [district]);

  useEffect(() => {
    let cancelled = false;
    getPriorityChallenges({
      ...(district ? { district } : {}),
      page: priorityPage,
      limit: 10,
    })
      .then((res) => !cancelled && setPriorityRows({ challenges: res.challenges || [], pagination: res.pagination }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [district, priorityPage]);

  const t = dashboard?.totals;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Government Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Jharkhand platform overview — monitoring challenges, projects and community
            participation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/government/hierarchy"
            className="flex items-center gap-1.5 rounded-lg border-2 border-nb-ink bg-nb-yellow px-3 py-1.5 text-xs font-black uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111] hover:bg-yellow-400"
          >
            🏢 Government Hierarchy ➔
          </Link>
          {dashboardMode === 'analytics' && (
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setPriorityPage(1);
              }}
              className={selectClass}
              aria-label="District filter"
            >
              <option value="">All Jharkhand</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="mt-6 flex border-2 border-nb-ink bg-white p-1 shadow-[3px_3px_0_#111] overflow-x-auto">
        <button
          type="button"
          onClick={() => setDashboardMode('governance')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all min-w-[190px] ${
            dashboardMode === 'governance'
              ? 'border-2 border-nb-ink bg-nb-yellow text-nb-ink shadow-[2px_2px_0_#111]'
              : 'text-gray-600 hover:text-nb-ink'
          }`}
        >
          🏛️ Governance & Work Monitoring
        </button>
        <Link
          to="/government/hierarchy"
          className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all text-center text-gray-700 hover:text-nb-ink hover:bg-nb-yellow/20 flex items-center justify-center gap-1 border-r border-l border-gray-200 min-w-[190px]"
        >
          🏢 Government Hierarchy ➔
        </Link>
        <button
          type="button"
          onClick={() => setDashboardMode('analytics')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all min-w-[190px] ${
            dashboardMode === 'analytics'
              ? 'border-2 border-nb-ink bg-nb-yellow text-nb-ink shadow-[2px_2px_0_#111]'
              : 'text-gray-600 hover:text-nb-ink'
          }`}
        >
          📊 Platform & District Analytics
        </button>
      </div>

      {dashboardMode === 'governance' ? (
        <div className="mt-6">
          <GovernmentMonitoring />
        </div>
      ) : (
        <>
          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          {isLoading ? (
            <p className="py-24 text-center text-gray-500">Loading dashboard...</p>
          ) : (
            <>
              {/* Top-level cards */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Total Challenges" value={t?.totalChallenges ?? 0} />
                <StatCard label="Active Challenges" value={t?.activeChallenges ?? 0} />
                <StatCard label="Projects" value={t?.totalProjects ?? 0} />
            <StatCard label="Completed Solutions" value={t?.totalSolutions ?? 0} />
            <StatCard label="Universities" value={t?.totalUniversities ?? 0} />
            <StatCard label="Industry Partners" value={t?.totalIndustries ?? 0} />
            <StatCard label="Funding Committed" value={fmtINR(t?.totalFunding || 0)} />
            <StatCard
              label="People Engaged"
              value={t?.totalCommunityParticipants ?? 0}
            />
          </div>

          {/* Charts */}
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <BarChart
              title="Challenges by Category"
              items={challengeStats?.byCategory || []}
              labelKey="category"
            />
            <BarChart
              title={district ? `Challenges — ${district}` : 'District-wise Challenges (top districts)'}
              items={(challengeStats?.byDistrict || []).slice(0, 10)}
              labelKey="district"
            />
            <BarChart
              title="Projects by Status"
              items={projectStats?.byStatus || []}
              labelKey="status"
            />
          </div>

          {/* Secondary summary strip */}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Validated</p>
              <p className="mt-0.5 text-lg font-semibold">{t?.validatedChallenges ?? 0}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Resolved</p>
              <p className="mt-0.5 text-lg font-semibold">{t?.resolvedChallenges ?? 0}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Avg Project Progress</p>
              <p className="mt-0.5 text-lg font-semibold">
                {projectStats?.summary?.averageProgress ?? 0}%
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Active Projects</p>
              <p className="mt-0.5 text-lg font-semibold">{t?.activeProjects ?? 0}</p>
            </div>
          </div>

          {/* Priority challenge table */}
          <div className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Priority Problems</h2>
              <span className="text-xs text-gray-400">
                Sorted by priority score · {priorityRows.pagination?.total ?? 0} total
              </span>
            </div>
            <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Challenge</th>
                    <th className="px-4 py-3 font-medium">District</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Severity</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Community</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {priorityRows.challenges.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        No challenges found for this filter.
                      </td>
                    </tr>
                  ) : (
                    priorityRows.challenges.map((c) => (
                      <tr key={c._id} className="hover:bg-gray-50/60">
                        <td className="max-w-[280px] px-4 py-3">
                          <Link
                            to={`/challenges/${c._id}`}
                            className="line-clamp-1 font-medium text-johar-green-700 hover:underline"
                          >
                            {c.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{c.district}</td>
                        <td className="px-4 py-3 capitalize">
                          {(CATEGORIES.find((x) => x.value === c.category)?.label || c.category).replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 capitalize">{c.severity}</td>
                        <td className="px-4 py-3 font-semibold">{c.priorityScore}</td>
                        <td className="px-4 py-3">{c.communityValidationScore}%</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                              STATUS_STYLES[c.status] || 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {String(c.status).replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {priorityRows.pagination?.totalPages > 1 && (
              <div className="mt-3 flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={!priorityRows.pagination.hasPrevPage}
                  onClick={() => setPriorityPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {priorityRows.pagination.page} of {priorityRows.pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={!priorityRows.pagination.hasNextPage}
                  onClick={() =>
                    setPriorityPage((p) =>
                      priorityRows.pagination.hasNextPage ? p + 1 : p
                    )
                  }
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Recent Activity</h2>
              {(dashboard?.recentActivity || []).length === 0 ? (
                <p className="mt-4 text-sm text-gray-400">No recent activity.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {dashboard.recentActivity.map((a, i) => (
                    <li key={`${a.type}-${i}`} className="py-2.5 text-sm">
                      {a.link ? (
                        <Link to={a.link} className="hover:text-johar-green-700 hover:underline">
                          {a.label}
                        </Link>
                      ) : (
                        a.label
                      )}
                      <span className="ml-2 whitespace-nowrap text-xs text-gray-400">
                        {fmtDate(a.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* District overview snapshot */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Ecosystem Snapshot</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Completed projects</dt>
                  <dd className="font-medium">{projectStats?.summary?.completedProjects ?? 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Deployed solutions</dt>
                  <dd className="font-medium">{projectStats?.summary?.deployedProjects ?? 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total funding committed</dt>
                  <dd className="font-medium">{fmtINR(t?.totalFunding || 0)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Community participants</dt>
                  <dd className="font-medium">{t?.totalCommunityParticipants ?? 0}</dd>
                </div>
              </dl>
              <Link
                to="/challenges"
                className="mt-4 inline-block text-sm font-medium text-johar-green-700 hover:underline"
              >
                Browse all challenges →
              </Link>
            </div>
          </div>

          {/* Impact & Replication */}
          <div className="mt-10">
            <h2 className="font-semibold">Impact &amp; Replication</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="People Benefited" value={fmtNum(dashboard?.impact?.totalPeopleBenefited)} />
              <StatCard label="Deployed Solutions" value={dashboard?.impact?.totalDeployedSolutions ?? 0} />
              <StatCard label="Avg Impact Score" value={`${dashboard?.impact?.averageImpactScore ?? 0}/100`} />
              <StatCard label="Districts Reached" value={dashboard?.impact?.districtsReached ?? 0} />
            </div>

            {dashboard?.impact?.solutionsWithReplicationOpportunities > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {dashboard.impact.solutionsWithReplicationOpportunities} deployed solution
                {dashboard.impact.solutionsWithReplicationOpportunities === 1 ? '' : 's'} with
                recorded impact are replication-ready (impact score ≥ 40).
              </p>
            )}

            {(dashboard?.impact?.topImpactfulSolutions || []).length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Solution</th>
                      <th className="px-4 py-3 font-medium">Impact Score</th>
                      <th className="px-4 py-3 font-medium">People Benefited</th>
                      <th className="px-4 py-3 font-medium">Districts Covered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {dashboard.impact.topImpactfulSolutions.map((s) => (
                      <tr key={s._id} className="hover:bg-gray-50/60">
                        <td className="max-w-[320px] px-4 py-3">
                          <Link
                            to={`/solutions/${s._id}`}
                            className="line-clamp-1 font-medium text-johar-green-700 hover:underline"
                          >
                            {s.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-semibold">{s.impactScore}</td>
                        <td className="px-4 py-3">{fmtNum(s.peopleBenefited)}</td>
                        <td className="px-4 py-3">{s.districtsCovered || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Link
              to="/solutions"
              className="mt-3 inline-block text-sm font-medium text-johar-green-700 hover:underline"
            >
              Open the Solution Library →
            </Link>
          </div>
        </>
      )}
    </>
  )}
    </section>
  );
}
