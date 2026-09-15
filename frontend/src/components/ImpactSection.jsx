import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  getProjectImpact,
  createImpact,
  updateImpact,
  generateImpactSummary,
  getReplicationOpportunities,
} from '../services/projectService.js';
import { DISTRICTS } from '../utils/constants.js';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none';

const fmtNum = (n) =>
  n === undefined || n === null ? 'Not available' : Number(n).toLocaleString('en-IN');

function MetricRow({ m }) {
  const improved = Number.isFinite(m.before) && Number.isFinite(m.after) && m.after > m.before;
  return (
    <tr className="divide-x divide-gray-100">
      <td className="px-3 py-2 font-medium">{m.metric}</td>
      <td className="px-3 py-2 text-center">{Number.isFinite(m.before) ? `${m.before}${m.unit ? ` ${m.unit}` : ''}` : '—'}</td>
      <td className={`px-3 py-2 text-center ${improved ? 'font-semibold text-johar-green-700' : ''}`}>
        {Number.isFinite(m.after) ? `${m.after}${m.unit ? ` ${m.unit}` : ''}` : '—'}
      </td>
    </tr>
  );
}

function ImpactForm({ projectId, existing, onSaved }) {
  const [form, setForm] = useState({
    peopleBenefited: '',
    householdsBenefited: '',
    villagesCovered: '',
    communitySatisfaction: '',
    implementationCost: '',
    estimatedSavings: '',
    jobsCreated: '',
    incomeImprovement: '',
    timeSaved: '',
    resourcesSaved: '',
    environmentalImpact: '',
    impactSummary: '',
    districtsCovered: [],
  });
  const [metrics, setMetrics] = useState([{ metric: '', unit: '', before: '', after: '' }]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existing) return;
    setForm((f) => ({
      ...f,
      ...Object.fromEntries(
        Object.entries(existing).map(([k, v]) => [
          k,
          Array.isArray(v) ? v : (v ?? ''),
        ])
      ),
      districtsCovered: existing.districtsCovered || [],
    }));
    if (existing.metrics?.length) {
      setMetrics(
        existing.metrics.map((m) => ({
          metric: m.metric,
          unit: m.unit || '',
          before: m.before ?? '',
          after: m.after ?? '',
        }))
      );
    }
  }, [existing]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setMetric(i, key, value) {
    setMetrics((ms) => ms.map((m, idx) => (idx === i ? { ...m, [key]: value } : m)));
  }

  function toggleDistrict(district) {
    const list = form.districtsCovered;
    set(
      'districtsCovered',
      list.includes(district)
        ? list.filter((d) => d !== district)
        : [...list, district]
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        peopleBenefited: form.peopleBenefited === '' ? undefined : Number(form.peopleBenefited),
        householdsBenefited:
          form.householdsBenefited === '' ? undefined : Number(form.householdsBenefited),
        villagesCovered: form.villagesCovered === '' ? undefined : Number(form.villagesCovered),
        communitySatisfaction:
          form.communitySatisfaction === '' ? undefined : Number(form.communitySatisfaction),
        implementationCost:
          form.implementationCost === '' ? undefined : Number(form.implementationCost),
        estimatedSavings: form.estimatedSavings === '' ? undefined : Number(form.estimatedSavings),
        jobsCreated: form.jobsCreated === '' ? undefined : Number(form.jobsCreated),
        metrics: metrics.filter((m) => m.metric.trim()),
      };
      const res = existing ? await updateImpact(projectId, payload) : await createImpact(projectId, payload);
      onSaved(res.impact);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save impact data.');
    } finally {
      setIsSaving(false);
    }
  }

  async function runSummary() {
    setError('');
    try {
      const res = await generateImpactSummary(projectId);
      onSaved(res.impact);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate an AI summary.');
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-dashed border-johar-green-600/40 bg-white p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['peopleBenefited', 'People benefited'],
          ['householdsBenefited', 'Households benefited'],
          ['villagesCovered', 'Villages covered'],
          ['communitySatisfaction', 'Satisfaction (0–100)'],
          ['implementationCost', 'Implementation cost (₹)'],
          ['estimatedSavings', 'Estimated savings (₹)'],
          ['jobsCreated', 'Jobs created'],
        ].map(([key, label]) => (
          <div key={key}>
            <label className="text-xs font-medium text-gray-600">{label}</label>
            <input
              type="number"
              min="0"
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              className={`mt-0.5 ${inputClass}`}
            />
          </div>
        ))}
        <div>
          <label className="text-xs font-medium text-gray-600">Income improvement</label>
          <input
            value={form.incomeImprovement}
            onChange={(e) => set('incomeImprovement', e.target.value)}
            placeholder="e.g., ₹1,500/month average increase"
            className={`mt-0.5 ${inputClass}`}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['timeSaved', 'Time saved (e.g., 2 hours/day per household)'],
          ['resourcesSaved', 'Resources saved'],
        ].map(([key, ph]) => (
          <div key={key}>
            <label className="text-xs font-medium text-gray-600">{ph}</label>
            <input value={form[key]} onChange={(e) => set(key, e.target.value)} className={`mt-0.5 ${inputClass}`} />
          </div>
        ))}
        <div>
          <label className="text-xs font-medium text-gray-600">Environmental impact</label>
          <input
            value={form.environmentalImpact}
            onChange={(e) => set('environmentalImpact', e.target.value)}
            placeholder="e.g., ~5 t CO₂ avoided annually"
            className={`mt-0.5 ${inputClass}`}
          />
        </div>
      </div>

      {/* Before / after metrics */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Before / After Metrics
        </p>
        {metrics.map((m, i) => (
          <div key={i} className="mt-2 grid grid-cols-12 gap-2">
            <input
              value={m.metric}
              onChange={(e) => setMetric(i, 'metric', e.target.value)}
              placeholder="Metric (e.g., Water Availability)"
              className={`${inputClass} col-span-6`}
            />
            <input
              value={m.unit}
              onChange={(e) => setMetric(i, 'unit', e.target.value)}
              placeholder="Unit"
              className={`${inputClass} col-span-2`}
            />
            <input
              type="number"
              value={m.before}
              onChange={(e) => setMetric(i, 'before', e.target.value)}
              placeholder="Before"
              className={`${inputClass} col-span-2`}
            />
            <input
              type="number"
              value={m.after}
              onChange={(e) => setMetric(i, 'after', e.target.value)}
              placeholder="After"
              className={`${inputClass} col-span-2`}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setMetrics((ms) => [...ms, { metric: '', unit: '', before: '', after: '' }])}
          className="mt-2 text-xs font-medium text-johar-green-700 hover:underline"
        >
          + Add another metric
        </button>
      </div>

      {/* Districts covered */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Districts covered
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DISTRICTS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDistrict(d)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                form.districtsCovered.includes(d)
                  ? 'bg-johar-green-700 text-white'
                  : 'border border-gray-300 text-gray-600 hover:border-johar-green-700'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Manual impact summary</label>
        <textarea
          rows={2}
          maxLength={2000}
          value={form.impactSummary}
          onChange={(e) => set('impactSummary', e.target.value)}
          className={`mt-0.5 ${inputClass}`}
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-johar-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-johar-green-600 disabled:opacity-40"
        >
          {isSaving ? 'Saving...' : existing ? 'Update Impact Data' : 'Save Impact Data'}
        </button>
        {existing && (
          <button
            type="button"
            onClick={runSummary}
            className="rounded-lg border border-purple-200 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
          >
            ✨ Generate AI-assisted summary
          </button>
        )}
      </div>
    </form>
  );
}

export default function ImpactSection({ projectId, projectStatus, canManage }) {
  const [data, setData] = useState(null); // { impact, impactScore, aiAssisted, canEdit }
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showReplication, setShowReplication] = useState(false);
  const [replication, setReplication] = useState(null);
  const [isMatching, setIsMatching] = useState(false);

  const isSolution = ['deployed', 'completed'].includes(projectStatus);

  function load() {
    getProjectImpact(projectId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [projectId]);

  async function loadReplication() {
    setIsMatching(true);
    try {
      const res = await getReplicationOpportunities(projectId);
      setReplication(res.opportunities || []);
      setShowReplication(true);
    } catch {
      setReplication([]);
      setShowReplication(true);
    } finally {
      setIsMatching(false);
    }
  }

  if (isLoading && !canManage) return null;

  const impact = data?.impact;
  if (!canManage && !impact) return null;

  const summaryText = impact?.aiSummary || impact?.impactSummary;

  return (
    <section className="mt-10 rounded-xl border border-johar-green-600/20 bg-johar-green-50/50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Social Impact</h2>
        <div className="flex items-center gap-3">
          {data && (
            <span className="rounded-full bg-johar-green-700 px-3 py-1 text-xs font-bold text-white">
              Impact Score: {data.impactScore}/100
            </span>
          )}
          {canManage && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium text-johar-green-700 hover:underline"
            >
              {impact ? 'Edit impact data' : '+ Record impact'}
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Indicative platform metric only — not an official government evaluation.
        {!canManage && !isSolution && ' Full details appear once the solution is deployed.'}
      </p>

      {canManage && isEditing && (
        <ImpactForm
          projectId={projectId}
          existing={impact}
          onSaved={(saved) => {
            setIsEditing(false);
            load();
          }}
        />
      )}

      {impact && !isEditing && (
        <>
          {summaryText && (
            <div className="mt-4 rounded-lg bg-white p-4 text-sm leading-relaxed text-gray-800">
              {summaryText}
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
              ['Households benefited', fmtNum(impact.householdsBenefited)],
              ['Villages covered', fmtNum(impact.villagesCovered)],
              [
                'Community satisfaction',
                Number.isFinite(impact.communitySatisfaction)
                  ? `${impact.communitySatisfaction}%`
                  : 'Not available',
              ],
              [
                'Implementation cost',
                Number.isFinite(impact.implementationCost)
                  ? `₹${Number(impact.implementationCost).toLocaleString('en-IN')}`
                  : 'Not available',
              ],
              [
                'Estimated savings',
                Number.isFinite(impact.estimatedSavings)
                  ? `₹${Number(impact.estimatedSavings).toLocaleString('en-IN')}`
                  : 'Not available',
              ],
              ['Jobs created', fmtNum(impact.jobsCreated)],
              [
                'Districts covered',
                impact.districtsCovered?.length
                  ? impact.districtsCovered.join(', ')
                  : 'Not available',
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white p-3">
                <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
                <dd className="mt-0.5 font-semibold capitalize">{value}</dd>
              </div>
            ))}
          </dl>

          {[
            ['Income improvement', impact.incomeImprovement],
            ['Time saved', impact.timeSaved],
            ['Resources saved', impact.resourcesSaved],
            ['Environmental impact', impact.environmentalImpact],
          ]
            .filter(([, v]) => v)
            .map(([label, v]) => (
              <p key={label} className="mt-3 text-sm">
                <span className="font-medium">{label}: </span>
                {v}
              </p>
            ))}

          {impact.metrics?.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-lg border border-gray-200 bg-white">
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
                    <MetricRow key={i} m={m} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Replication */}
      {isSolution && (
        <div className="mt-6 border-t border-johar-green-600/10 pt-4">
          {!showReplication ? (
            <>
              <h3 className="text-sm font-semibold">Potential Replication Opportunities</h3>
              <p className="mt-1 text-xs text-gray-500">
                This solution may be reusable for similar open problems in other districts.
                Replication always requires institutional approval — nothing is assigned
                automatically.
              </p>
              <button
                type="button"
                onClick={loadReplication}
                disabled={isMatching}
                className="mt-2 rounded-lg border border-johar-green-700 px-4 py-2 text-sm font-medium text-johar-green-700 hover:bg-green-100 disabled:opacity-50"
              >
                {isMatching ? 'Analyzing...' : 'Explore Similar Problems →'}
              </button>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold">Potential Replication Opportunities</h3>
              {replication.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  No suitable open challenges found right now.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {replication.map((o) => (
                    <li
                      key={o.challengeId}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-white p-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/challenges/${o.challengeId}`}
                          className="font-medium text-johar-green-700 hover:underline"
                        >
                          {o.title}
                        </Link>
                        <span className="ml-2 text-xs text-gray-500">{o.district}</span>
                        {o.reason && <p className="mt-0.5 text-xs text-gray-600">{o.reason}</p>}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          o.matchScore >= 70
                            ? 'bg-green-100 text-green-700'
                            : o.matchScore >= 55
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {o.matchScore}% match
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
