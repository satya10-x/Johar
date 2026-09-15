import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  getProject,
  getIndustryMatches,
  sendCollaborationRequest,
  sendFundingCommitment,
  changeStatus,
  addTeamMember,
  removeTeamMember,
  assignMentor,
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from '../services/projectService.js';
import { useAuth } from '../context/AuthContext.jsx';
import ImpactSection from '../components/ImpactSection.jsx';
import { CATEGORIES } from '../utils/constants.js';

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

const ALLOWED_NEXT = {
  proposed: ['approved', 'cancelled'],
  approved: ['team_formation', 'cancelled'],
  team_formation: ['development', 'cancelled'],
  development: ['testing', 'cancelled'],
  testing: ['pilot', 'cancelled'],
  pilot: ['deployed'],
  deployed: ['completed'],
  completed: [],
  cancelled: [],
};

const COLLAB_OPTIONS = [
  { value: 'mentorship', label: 'Technical Mentorship' },
  { value: 'hardware', label: 'Hardware / Resources' },
  { value: 'prototyping', label: 'Prototyping Support' },
  { value: 'testing', label: 'Testing' },
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [funding, setFunding] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [matches, setMatches] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [collabType, setCollabType] = useState('mentorship');
  const [message, setMessage] = useState('');
  const [showFunding, setShowFunding] = useState(false);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('student');
  const [newMilestone, setNewMilestone] = useState({ title: '', dueDate: '' });
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canManage = Boolean(project?.canManage);

  const loadProject = useCallback(() => {
    return getProject(id)
      .then((res) => {
        setProject(res.project);
        setFunding(res.funding || []);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load project.'));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadProject().finally(() => !cancelled && setIsLoading(false));
    getMilestones(id)
      .then((res) => !cancelled && setMilestones(res.milestones || []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, loadProject]);

  async function act(fn) {
    setActionError('');
    try {
      await fn();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    }
  }

  function refreshAll() {
    loadProject();
    getMilestones(id).then((res) => setMilestones(res.milestones || [])).catch(() => {});
  }

  async function loadMatches(force = false) {
    setIsMatching(true);
    try {
      const res = await getIndustryMatches(id, force);
      setMatches(res.matches || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load industry matches.');
    } finally {
      setIsMatching(false);
    }
  }

  function isIndustry() {
    return user?.role === 'industry';
  }

  async function submitRequest() {
    setActionError('');
    try {
      await sendCollaborationRequest(id, { collaborationType: collabType, message });
      setSuccessMsg('Your offer of support has been submitted to the project team.');
      setShowSupport(false);
      setMessage('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to submit.');
    }
  }

  async function submitFunding() {
    setActionError('');
    try {
      await sendFundingCommitment(id, { amount: Number(amount), purpose });
      setSuccessMsg('Funding commitment recorded.');
      setShowFunding(false);
      setAmount('');
      setPurpose('');
      const res = await getProject(id);
      setFunding(res.funding || []);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to record commitment.');
    }
  }

  if (isLoading) return <p className="py-24 text-center text-gray-500">Loading project...</p>;
  if (error && !project)
    return (
      <div className="py-24 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium uppercase tracking-wide text-johar-green-700">
            {CATEGORIES.find((c) => c.value === project.challenge?.category)?.label ||
              project.challenge?.category}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5">
            {STATUS_LABELS[project.status] || project.status}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-bold">{project.title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          by{' '}
          {project.university?._id ? (
            <Link
              to={`/universities/${project.university._id}`}
              className="font-medium hover:text-johar-green-700"
            >
              {project.university.name}
            </Link>
          ) : (
            'University TBD'
          )}
        </p>
      </header>

      {/* Originating challenge */}
      {project.challenge && (
        <div className="mt-6 rounded-xl border border-johar-green-600/20 bg-johar-green-50 p-4 text-sm">
          <span className="font-semibold">Originating Challenge: </span>
          <Link
            to={`/challenges/${project.challenge._id}`}
            className="font-medium text-johar-green-700 hover:underline"
          >
            {project.challenge.title}
          </Link>
        </div>
      )}

      {/* Timeline summary */}
      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-5 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-gray-500">Started</dt>
          <dd className="mt-0.5 font-medium">{fmtDate(project.startDate)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Expected completion</dt>
          <dd className="mt-0.5 font-medium">{fmtDate(project.expectedEndDate)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Estimated budget</dt>
          <dd className="mt-0.5 font-medium">
            ₹{(project.estimatedBudget?.amount || 0).toLocaleString('en-IN')}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Progress</dt>
          <dd className="mt-0.5 font-semibold text-johar-green-700">{project.currentProgress}%</dd>
        </div>
      </dl>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-johar-green-600 transition-all"
          style={{ width: `${project.currentProgress}%` }}
        />
      </div>

      <p className="mt-6 leading-relaxed text-gray-800">{project.description}</p>

      {project.proposedSolution && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-600">Proposed Solution</h2>
          <p className="mt-1 text-sm text-gray-800">{project.proposedSolution}</p>
        </section>
      )}

      {project.objectives?.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-600">Objectives</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-800">
            {project.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </section>
      )}

      {project.technologies?.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {project.technologies.map((t) => (
            <span key={t} className="rounded-full bg-johar-green-50 px-3 py-1 text-xs font-medium text-johar-green-700">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Social impact & replication */}
      <ImpactSection projectId={project._id} projectStatus={project.status} canManage={canManage} />

      {/* Team */}
      <section className="mt-10 rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold">Team</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {project.facultyMentor && (
            <li>
              <span className="font-medium">{project.facultyMentor.name}</span>{' '}
              <span className="text-xs text-gray-500">· Faculty Mentor</span>
            </li>
          )}
          {(project.teamMembers || []).map((tm) => (
            <li key={tm._id} className="flex items-center justify-between">
              <span>
                {tm.user?.name}{' '}
                <span className="text-xs capitalize text-gray-500">· {tm.role}</span>
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => act(() => removeTeamMember(id, tm.user._id).then(refreshAll))}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {canManage && !showTeamForm && (
          <button
            type="button"
            onClick={() => setShowTeamForm(true)}
            className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-johar-green-700 hover:text-johar-green-700"
          >
            + Add member / mentor (by user ID)
          </button>
        )}
        {canManage && showTeamForm && (
          <div className="mt-3 space-y-2 rounded-lg border border-gray-200 p-4 text-sm">
            <input
              value={newMemberId}
              onChange={(e) => setNewMemberId(e.target.value)}
              placeholder="User ID of the member/mentor"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-johar-green-700 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="student">Student member</option>
                <option value="member">Member</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  act(async () => {
                    if (newMemberRole === 'faculty') {
                      await assignMentor(id, newMemberId);
                    } else {
                      await addTeamMember(id, newMemberId, newMemberRole);
                    }
                    setShowTeamForm(false);
                    setNewMemberId('');
                    refreshAll();
                  })
                }
                className="rounded-lg bg-johar-green-700 px-4 py-2 font-semibold text-white"
              >
                Add as {newMemberRole}
              </button>
              <button
                type="button"
                onClick={() => act(async () => {
                  await assignMentor(id, newMemberId);
                  setShowTeamForm(false);
                  refreshAll();
                })}
                className="rounded-lg border border-johar-green-700 px-4 py-2 font-medium text-johar-green-700"
              >
                Set as Faculty Mentor
              </button>
              <button type="button" onClick={() => setShowTeamForm(false)} className="px-3 py-2 text-gray-500">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Industry Partners & support */}
      <section className="mt-8 rounded-xl border border-johar-earth-500/20 bg-johar-earth-50/50 p-6">
        <h2 className="font-semibold">Industry Partners & Support Offered</h2>
        {(!project.industryPartners?.length && !funding.length) ? (
          <p className="mt-2 text-sm text-gray-500">No industry partners yet.</p>
        ) : (
          <>
            {project.industryPartners?.map((pt) => (
              <p key={pt._id} className="mt-3 text-sm">
                ✓{' '}
                <Link to={`/industries/${pt._id}`} className="font-medium hover:text-johar-green-700">
                  {pt.companyName}
                </Link>
                <span className="ml-2 text-xs capitalize text-gray-500">
                  ({String(pt.companyType).replace(/_/g, ' ')})
                </span>
              </p>
            ))}
            {funding.map((f) => (
              <p key={f._id} className="mt-3 text-sm">
                ✓ {f.industry?.companyName}
                <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  Funding Commitment ₹{Number(f.amount).toLocaleString('en-IN')}
                </span>
              </p>
            ))}
          </>
        )}
      </section>

      {/* Milestones timeline */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Milestones</h2>
          {canManage && (
            <span className="text-xs text-gray-400">Adding a milestone auto-updates progress</span>
          )}
        </div>

        {milestones.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No milestones defined yet.</p>
        ) : (
          <ol className="relative mt-4 space-y-6 border-l-2 border-johar-green-100 pl-6">
            {milestones.map((m) => (
              <li key={m._id} className="relative">
                <span
                  className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white ${
                    m.status === 'completed'
                      ? 'bg-johar-green-600'
                      : m.status === 'in_progress'
                        ? 'bg-blue-500'
                        : m.status === 'delayed'
                          ? 'bg-red-500'
                          : 'bg-gray-300'
                  }`}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{m.title}</p>
                  <span className="text-xs capitalize text-gray-500">
                    {String(m.status).replace(/_/g, ' ')} · due {fmtDate(m.dueDate)}
                  </span>
                </div>
                {m.description && <p className="mt-1 text-sm text-gray-600">{m.description}</p>}
                {m.deliverables?.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
                    {m.deliverables.map((d) => (
                      <li key={d}>
                        📎{' '}
                        <a href={d} target="_blank" rel="noreferrer" className="hover:underline">
                          {d}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {canManage && m.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() =>
                      act(() =>
                        updateMilestone(m._id, { status: 'completed' }).then(refreshAll)
                      )
                    }
                    className="mt-2 rounded-lg border border-johar-green-700 px-3 py-1 text-xs font-medium text-johar-green-700 hover:bg-green-50"
                  >
                    Mark completed
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => act(() => deleteMilestone(m._id).then(refreshAll))}
                    className="ml-2 mt-2 text-xs text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}

        {canManage && (
          <div className="mt-5 grid gap-2 rounded-lg border border-dashed border-gray-300 p-4 sm:grid-cols-3">
            <input
              value={newMilestone.title}
              onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
              placeholder="Milestone title"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              type="date"
              value={newMilestone.dueDate}
              onChange={(e) => setNewMilestone({ ...newMilestone, dueDate: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                act(async () => {
                  await createMilestone(id, {
                    title: newMilestone.title,
                    dueDate: newMilestone.dueDate,
                  });
                  setNewMilestone({ title: '', dueDate: '' });
                  refreshAll();
                })
              }
              disabled={!newMilestone.title || !newMilestone.dueDate}
              className="rounded-lg bg-johar-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 sm:col-span-3"
            >
              Add Milestone
            </button>
          </div>
        )}
      </section>

      {/* Status management */}
      {canManage && (
        <section className="mt-10 rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold">Manage Project</h2>
          <p className="mt-1 text-xs text-gray-500">
            Current status: <b>{STATUS_LABELS[project.status]}</b>. Progress is auto-calculated
            from completed milestones.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(ALLOWED_NEXT[project.status] || []).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => act(() => changeStatus(id, s).then(refreshAll))}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  s === 'cancelled'
                    ? 'border border-red-200 text-red-600 hover:bg-red-50'
                    : 'bg-johar-green-700 text-white hover:bg-johar-green-600'
                }`}
              >
                Move to {STATUS_LABELS[s]}
              </button>
            ))}
            {!ALLOWED_NEXT[project.status]?.length && (
              <span className="text-sm text-gray-500">This project is in a terminal state.</span>
            )}
          </div>
        </section>
      )}

      {/* Industry actions */}
      {isIndustry() && (
        <section className="mt-8">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setShowSupport((v) => !v);
                setShowFunding(false);
              }}
              className="rounded-lg bg-johar-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-johar-green-600"
            >
              Offer Support
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFunding((v) => !v);
                setShowSupport(false);
              }}
              className="rounded-lg border border-johar-green-700 px-5 py-2.5 text-sm font-semibold text-johar-green-700 hover:bg-green-50"
            >
              Make Funding Commitment
            </button>
          </div>

          {showSupport && (
            <div className="mt-4 rounded-lg border border-gray-200 p-4">
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
                placeholder="Describe your contribution..."
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={submitRequest}
                className="mt-2 rounded-lg bg-johar-green-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Send Offer
              </button>
            </div>
          )}

          {showFunding && (
            <div className="mt-4 rounded-lg border border-gray-200 p-4">
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount in ₹"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-64"
              />
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Purpose, e.g., prototyping hardware"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={submitFunding}
                disabled={!amount}
                className="mt-2 rounded-lg bg-johar-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Record Commitment
              </button>
              <p className="mt-2 text-xs text-gray-400">
                A record of intent only — no payment is processed on JOHAR.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Potential Industry Partners */}
      {user && (
        <section className="mt-10 rounded-xl border border-purple-100 bg-purple-50/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Potential Industry Partners</h2>
            <button
              type="button"
              onClick={() => loadMatches(Boolean(matches))}
              disabled={isMatching}
              className="rounded-lg border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-50 disabled:opacity-50"
            >
              {isMatching ? 'Analyzing...' : matches ? 'Refresh Matches' : 'Find Industry Matches'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            AI-assisted suggestions — based only on listed company capabilities.
          </p>

          {matches && matches.length === 0 && (
            <p className="mt-4 text-sm text-gray-500">No matching companies found yet.</p>
          )}

          {matches && matches.length > 0 && (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {matches.slice(0, 6).map((m) => (
                <li key={m.industryId} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{m.companyName}</p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                        m.score >= 70
                          ? 'bg-green-100 text-green-700'
                          : m.score >= 40
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {m.score}% Match
                    </span>
                  </div>
                  {m.matchingAreas?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.matchingAreas.map((a) => (
                        <span key={a} className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.reason && <p className="mt-2 text-xs text-gray-600">{m.reason}</p>}
                  <Link
                    to={`/industries/${m.industryId}`}
                    className="mt-3 inline-block text-sm font-medium text-johar-green-700 hover:underline"
                  >
                    View Company →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!user && (
        <p className="mt-10 text-sm text-gray-600">
          <Link to="/login" className="font-medium text-johar-green-700 hover:underline">
            Log in
          </Link>{' '}
          as an industry to offer support or view AI-matched partners.
        </p>
      )}

      {successMsg && (
        <p className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</p>
      )}
      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
      )}
    </article>
  );
}
