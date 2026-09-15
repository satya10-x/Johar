import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  getMatchedProjects,
  listIndustries,
  sendCollaborationRequest,
} from '../services/industryService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { CATEGORIES } from '../utils/constants.js';

const COLLAB_OPTIONS = [
  { value: 'mentorship', label: 'Technical Mentorship' },
  { value: 'funding', label: 'Funding' },
  { value: 'hardware', label: 'Hardware / Resources' },
  { value: 'prototyping', label: 'Prototyping Support' },
  { value: 'testing', label: 'Testing' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'deployment', label: 'Deployment Support' },
  { value: 'technology_transfer', label: 'Technology Transfer' },
];

export default function IndustryProjects() {
  const { user } = useAuth();

  const [myIndustry, setMyIndustry] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestFor, setRequestFor] = useState(null);
  const [collabType, setCollabType] = useState('mentorship');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    listIndustries({ limit: 50 })
      .then(async (res) => {
        if (cancelled) return;
        const mine = res.industries.find(
          (u) => u.createdBy && String(u.createdBy) === user._id
        );
        setMyIndustry(mine || null);
        if (mine) {
          const matched = await getMatchedProjects(mine._id);
          if (!cancelled) setProjects(matched.projects || []);
        }
      })
      .catch(() => !cancelled && setError('Failed to load projects.'))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function onSubmitRequest(projectId) {
    setActionError('');
    try {
      await sendCollaborationRequest(projectId, {
        collaborationType: collabType,
        message,
      });
      setSuccessMsg('Your offer of support has been submitted.');
      setRequestFor(null);
      setMessage('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to submit request.');
    }
  }

  if (!user || user.role !== 'industry') {
    return (
      <div className="py-24 text-center">
        <p className="text-gray-600">This page is for registered industry accounts.</p>
        <Link to="/challenges" className="mt-4 inline-block text-johar-green-700 hover:underline">
          Explore challenges instead
        </Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">Relevant Projects</h1>
      <p className="mt-1 text-sm text-gray-500">
        {myIndustry ? myIndustry.companyName : 'Setting up your company...'}
      </p>

      {successMsg && (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</p>
      )}
      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
      )}

      {isLoading ? (
        <p className="py-20 text-center text-gray-500">Loading...</p>
      ) : error ? (
        <p className="py-20 text-center text-red-600">{error}</p>
      ) : !myIndustry ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">No company profile is linked to your account yet.</p>
          <Link
            to="/industries"
            className="mt-4 inline-block rounded-lg bg-johar-green-700 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Browse Industries
          </Link>
        </div>
      ) : projects.length === 0 ? (
        <p className="py-16 text-center text-gray-500">
          No matching projects right now. Check back as new university projects are created.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {projects.map((p) => (
            <li key={p.projectId} className="rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium uppercase tracking-wide text-johar-green-700">
                  {CATEGORIES.find((c) => c.value === p.challengeCategory)?.label ||
                    p.challengeCategory}
                </span>
                <span className="rounded-full bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
                  {p.matchScore}% Match
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 capitalize">
                  {String(p.status).replace(/_/g, ' ')}
                </span>
              </div>

              <h2 className="mt-2 font-semibold">{p.title}</h2>
              <p className="mt-1 text-xs text-gray-500">
                {p.university || 'University TBD'} · {p.district || 'Jharkhand'}
              </p>

              {p.matchingAreas?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.matchingAreas.map((area) => (
                    <span key={area} className="rounded-full bg-johar-earth-50 px-2.5 py-0.5 text-xs text-johar-earth-700">
                      {area}
                    </span>
                  ))}
                </div>
              )}

              {requestFor === p.projectId ? (
                <div className="mt-3 rounded-lg border border-gray-200 p-4">
                  <select
                    value={collabType}
                    onChange={(e) => setCollabType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm sm:w-auto"
                  >
                    {COLLAB_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe the support you can offer..."
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSubmitRequest(p.projectId)}
                      className="rounded-lg bg-johar-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-johar-green-600"
                    >
                      Send Offer
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestFor(null)}
                      className="px-3 py-2 text-sm text-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-3">
                  <Link
                    to={`/projects/${p.projectId}`}
                    className="rounded-lg bg-johar-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-johar-green-600"
                  >
                    View Project
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setRequestFor(p.projectId);
                      setActionError('');
                      setSuccessMsg('');
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-johar-green-700 hover:text-johar-green-700"
                  >
                    Offer Support
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
