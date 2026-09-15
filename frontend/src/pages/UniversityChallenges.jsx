import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import api from '../services/api.js';
import {
  listUniversities,
  getAssignedChallenges,
  sendUniversityResponse,
} from '../services/universityService.js';
import { useAuth } from '../context/AuthContext.jsx';
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

const INTEREST_ACTIONS = [
  { level: 'interested', label: 'Accept / Express Interest' },
  { level: 'needs_more_information', label: 'Request More Information' },
  { level: 'not_interested', label: 'Reject' },
];

export default function UniversityChallenges() {
  const { user } = useAuth();

  const [myUniversity, setMyUniversity] = useState(null);
  const [data, setData] = useState({ challenges: [], pagination: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [timeline, setTimeline] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    listUniversities({ limit: 50 })
      .then(async (res) => {
        if (cancelled) return;
        const mine = res.universities.find(
          (u) => u.createdBy && String(u.createdBy) === user._id
        );
        setMyUniversity(mine || null);
        if (mine) {
          const assigned = await getAssignedChallenges(mine._id);
          if (!cancelled) setData(assigned);
        }
      })
      .catch(() => !cancelled && setError('Failed to load your challenges.'))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function onRespond(challengeId, interestLevel) {
    setActionError('');
    try {
      await sendUniversityResponse(challengeId, {
        response: responseText || `University marked this challenge as ${interestLevel.replace(/_/g, ' ')}.`,
        interestLevel,
        estimatedTimeline: timeline,
      });
      setRespondingTo(null);
      setResponseText('');
      setTimeline('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to record response.');
    }
  }

  if (!user || user.role !== 'university') {
    return (
      <div className="py-24 text-center">
        <p className="text-gray-600">This page is for registered university accounts.</p>
        <Link to="/challenges" className="mt-4 inline-block text-johar-green-700 hover:underline">
          Explore challenges instead
        </Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">Assigned Challenges</h1>
      <p className="mt-1 text-sm text-gray-500">
        {myUniversity ? myUniversity.name : 'Setting up your university...'}
      </p>

      {isLoading ? (
        <p className="py-20 text-center text-gray-500">Loading...</p>
      ) : error ? (
        <p className="py-20 text-center text-red-600">{error}</p>
      ) : !myUniversity ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">
            No university profile is linked to your account yet.
          </p>
          <Link
            to="/universities"
            className="mt-4 inline-block rounded-lg bg-johar-green-700 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Browse Universities
          </Link>
        </div>
      ) : data.challenges.length === 0 ? (
        <p className="py-16 text-center text-gray-500">
          No challenges have been assigned to your university yet.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {data.challenges.map((ch) => (
            <li key={ch._id} className="rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium uppercase tracking-wide text-johar-green-700">
                  {CATEGORIES.find((c) => c.value === ch.category)?.label || ch.category}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    ch.severity === 'critical' || ch.severity === 'high'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {(SEVERITIES.find((s) => s.value === ch.severity)?.label || ch.severity)}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5">
                  {STATUS_LABELS[ch.status] || ch.status}
                </span>
                {ch.priorityScore > 0 && (
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
                    AI Priority {ch.priorityScore}
                  </span>
                )}
              </div>

              <h2 className="mt-2 font-semibold">{ch.title}</h2>
              {ch.aiSummary && <p className="mt-1 text-sm text-gray-600">{ch.aiSummary}</p>}
              <p className="mt-2 text-xs text-gray-500">
                {ch.district} · reported by {ch.submittedBy?.name || 'Anonymous'} ·{' '}
                {new Date(ch.createdAt).toLocaleDateString()} ·{' '}
                {ch.communityValidation?.supportCount || 0} supporting
              </p>

              {respondingTo === ch._id ? (
                <div className="mt-3 rounded-lg border border-gray-200 p-4">
                  <textarea
                    rows={2}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Add details about your response, capabilities or questions..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none"
                  />
                  <input
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="Estimated timeline (optional), e.g., one semester"
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {INTEREST_ACTIONS.map((a) => (
                      <button
                        key={a.level}
                        type="button"
                        onClick={() => onRespond(ch._id, a.level)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                          a.level === 'interested'
                            ? 'bg-johar-green-700 text-white'
                            : a.level === 'not_interested'
                              ? 'border border-red-200 text-red-600'
                              : 'border border-gray-300 text-gray-700'
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setRespondingTo(null)}
                      className="px-3 py-2 text-sm text-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    to={`/challenges/${ch._id}`}
                    className="rounded-lg bg-johar-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-johar-green-600"
                  >
                    View Challenge
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setRespondingTo(ch._id);
                      setActionError('');
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-johar-green-700 hover:text-johar-green-700"
                  >
                    Respond
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
      )}
    </section>
  );
}
