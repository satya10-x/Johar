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
  getProjectRisk,
  analyzeProjectRisk,
} from '../services/projectService.js';
import {
  submitMilestoneForVerification,
  addMilestoneEvidence,
  verifyMilestone,
  requestMilestoneChanges,
  rejectMilestone,
} from '../services/milestoneService.js';
import {
  assignProjectAuthority,
  getGovernmentHierarchy,
} from '../services/governmentService.js';
import { useAuth } from '../context/AuthContext.jsx';
import ImpactSection from '../components/ImpactSection.jsx';
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

const LIFECYCLE_STAGES = [
  { key: 'reported', label: 'Reported' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'proposed', label: 'Proposed' },
  { key: 'approved', label: 'Approved' },
  { key: 'development', label: 'Development' },
  { key: 'testing', label: 'Testing' },
  { key: 'pilot', label: 'Pilot' },
  { key: 'deployment', label: 'Deployment' },
  { key: 'verification', label: 'Verification' },
  { key: 'completed', label: 'Completed' },
];

function getActiveLifecycleIndex(proj, mList = []) {
  if (!proj) return 0;
  if (proj.status === 'completed') return 9;
  const hasVerification = (mList || []).some(
    (m) =>
      m.verificationStatus === 'submitted' ||
      m.verificationStatus === 'under_review' ||
      m.verificationStatus === 'verified'
  );
  if (proj.status === 'deployed') return hasVerification ? 8 : 7;
  if (proj.status === 'pilot') return 6;
  if (proj.status === 'testing') return 5;
  if (proj.status === 'development') return 4;
  if (proj.status === 'approved' || proj.status === 'team_formation') return 3;
  if (proj.status === 'proposed') return 2;
  if (proj.challenge?.assignedUniversity) return 1;
  return 0;
}

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
  const isGovOrAdmin = user?.role === 'government' || user?.role === 'admin';
  const isAuthorizedForRisk = Boolean(
    user &&
    (user.role === 'admin' ||
     user.role === 'government' ||
     user.role === 'university' ||
     user.role === 'faculty' ||
     user.role === 'industry' ||
     canManage ||
     project?.teamMembers?.some((tm) => (tm.user?._id || tm.user)?.toString() === user?._id?.toString()))
  );

  // AI-assisted project risk detection state
  const [riskData, setRiskData] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskAnalyzing, setRiskAnalyzing] = useState(false);
  const [riskError, setRiskError] = useState('');

  const loadProjectRisk = useCallback(() => {
    if (!user || !id) return;
    setRiskLoading(true);
    setRiskError('');
    getProjectRisk(id)
      .then((res) => {
        setRiskData(res);
      })
      .catch((err) => {
        if (err.response?.status !== 403 && err.response?.status !== 404) {
          setRiskError(err.response?.data?.message || 'Risk assessment unavailable.');
        }
      })
      .finally(() => setRiskLoading(false));
  }, [id, user]);

  useEffect(() => {
    if (isAuthorizedForRisk) {
      loadProjectRisk();
    }
  }, [id, isAuthorizedForRisk, loadProjectRisk]);

  const handleReanalyzeRisk = async () => {
    setRiskAnalyzing(true);
    setRiskError('');
    try {
      const res = await analyzeProjectRisk(id);
      setRiskData({
        latest: res.assessment,
        trend: res.trend || [],
      });
      setSuccessMsg('AI project risk analysis refreshed.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setRiskError(
        err.response?.data?.message || 'AI risk service temporarily unavailable. Please retry later.'
      );
    } finally {
      setRiskAnalyzing(false);
    }
  };

  // Evidence modal state
  const [evidenceModalMilestone, setEvidenceModalMilestone] = useState(null);
  const [evidenceForm, setEvidenceForm] = useState({
    type: 'document',
    title: '',
    url: '',
    description: '',
    isPublic: true,
  });

  // Verification modal state for government/admin
  const [verifyModalMilestone, setVerifyModalMilestone] = useState(null);
  const [verifyActionType, setVerifyActionType] = useState('verify'); // 'verify' | 'request_changes' | 'reject'
  const [verifyNotes, setVerifyNotes] = useState('');

  // Government responsibility assign modal
  const [showAssignGovModal, setShowAssignGovModal] = useState(false);
  const [govHierarchy, setGovHierarchy] = useState(null);
  const [assignGovForm, setAssignGovForm] = useState({
    department: '',
    authorityLevel: 'district',
    district: '',
    block: '',
    localBody: '',
    notes: '',
  });

  useEffect(() => {
    if (isGovOrAdmin) {
      getGovernmentHierarchy()
        .then((res) => setGovHierarchy(res))
        .catch(() => {});
    }
  }, [isGovOrAdmin]);

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

  async function submitEvidence(e) {
    e.preventDefault();
    if (!evidenceModalMilestone || !evidenceForm.title.trim()) return;
    try {
      await addMilestoneEvidence(evidenceModalMilestone._id, evidenceForm);
      setSuccessMsg('Evidence attached to milestone.');
      setEvidenceModalMilestone(null);
      setEvidenceForm({ type: 'document', title: '', url: '', description: '', isPublic: true });
      refreshAll();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to attach evidence.');
    }
  }

  async function handleVerificationSubmit(milestoneId) {
    try {
      await submitMilestoneForVerification(milestoneId);
      setSuccessMsg('Milestone submitted for authority sign-off.');
      refreshAll();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to submit milestone for verification.');
    }
  }

  async function submitVerifyAction() {
    if (!verifyModalMilestone) return;
    try {
      if (verifyActionType === 'verify') {
        await verifyMilestone(verifyModalMilestone._id, verifyNotes);
        setSuccessMsg('Milestone signed off and verified.');
      } else if (verifyActionType === 'request_changes') {
        if (!verifyNotes.trim()) {
          alert('Please enter change notes.');
          return;
        }
        await requestMilestoneChanges(verifyModalMilestone._id, verifyNotes);
        setSuccessMsg('Changes requested from project team.');
      } else if (verifyActionType === 'reject') {
        if (!verifyNotes.trim()) {
          alert('Please enter rejection notes.');
          return;
        }
        await rejectMilestone(verifyModalMilestone._id, verifyNotes);
        setSuccessMsg('Milestone rejected.');
      }
      setVerifyModalMilestone(null);
      setVerifyNotes('');
      refreshAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process verification');
    }
  }

  async function submitGovAssignment(e) {
    e.preventDefault();
    try {
      await assignProjectAuthority(id, assignGovForm);
      setSuccessMsg('Government responsibility assigned successfully.');
      setShowAssignGovModal(false);
      refreshAll();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to assign government authority.');
    }
  }

  function openGovModal() {
    setAssignGovForm({
      department: project?.governmentOwnership?.department || '',
      authorityLevel: project?.governmentOwnership?.authorityLevel || 'district',
      district:
        project?.governmentOwnership?.district ||
        project?.deploymentDetails?.district ||
        user?.district ||
        '',
      block: project?.governmentOwnership?.block || '',
      localBody: project?.governmentOwnership?.localBody || '',
      notes: project?.governmentOwnership?.notes || '',
    });
    setShowAssignGovModal(true);
  }

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

      {/* Project Lifecycle Stepper */}
      <div className="mt-6 rounded-xl border-2 border-nb-ink bg-white p-4 shadow-[3px_3px_0_#111]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
            Project Lifecycle Progress
          </p>
          <span className="rounded-full bg-nb-yellow/40 px-2 py-0.5 text-[10px] font-bold uppercase text-nb-ink">
            Stage {getActiveLifecycleIndex(project, milestones) + 1} of 10
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between overflow-x-auto pb-2 text-xs">
          {LIFECYCLE_STAGES.map((stg, idx) => {
            const currentIdx = getActiveLifecycleIndex(project, milestones);
            const isDone = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            return (
              <div key={stg.key} className="flex flex-1 items-center min-w-[68px]">
                <div className="flex flex-col items-center text-center">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black border transition-all ${
                      isDone
                        ? 'bg-johar-green-700 text-white border-johar-green-700'
                        : isCurrent
                          ? 'border-2 border-nb-ink bg-nb-yellow text-nb-ink font-bold animate-pulse'
                          : 'bg-gray-100 text-gray-400 border-gray-300'
                    }`}
                  >
                    {isDone ? '✓' : idx + 1}
                  </span>
                  <span
                    className={`mt-1 text-[10px] font-bold ${
                      isCurrent
                        ? 'text-nb-ink underline'
                        : isDone
                          ? 'text-johar-green-800'
                          : 'text-gray-400'
                    }`}
                  >
                    {stg.label}
                  </span>
                </div>
                {idx < LIFECYCLE_STAGES.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-1 ${
                      idx < currentIdx ? 'bg-johar-green-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Government Responsibility & Oversight Card */}
      <div className="mt-4 rounded-xl border border-johar-earth-500/30 bg-johar-earth-50/60 p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="font-bold text-gray-800 flex items-center gap-1.5">
              <span>🏛️</span> Government Responsibility & Authority Scope
            </span>
            <p className="mt-1 text-gray-600">
              {project.governmentOwnership?.department ? (
                <>
                  <strong>Department:</strong> {project.governmentOwnership.department} ·{' '}
                  <strong>Authority Level:</strong>{' '}
                  <span className="uppercase font-semibold text-indigo-700">
                    {project.governmentOwnership.authorityLevel || 'District'}
                  </span>{' '}
                  · <strong>Jurisdiction:</strong>{' '}
                  {project.governmentOwnership.district ||
                    project.deploymentDetails?.district ||
                    'Jharkhand'}
                  {project.governmentOwnership.block &&
                    ` (${project.governmentOwnership.block} Block)`}
                  {project.governmentOwnership.localBody &&
                    ` · Local Body: ${project.governmentOwnership.localBody}`}
                </>
              ) : (
                <span className="text-gray-500 italic">
                  No specific government authority assigned yet.
                </span>
              )}
            </p>
          </div>
          {isGovOrAdmin && (
            <button
              type="button"
              onClick={openGovModal}
              className="rounded-lg border-2 border-nb-ink bg-white px-2.5 py-1 text-xs font-bold text-nb-ink shadow-[2px_2px_0_#111] hover:bg-nb-yellow"
            >
              ⚙️ {project.governmentOwnership?.department ? 'Edit Responsibility' : 'Assign Authority'}
            </button>
          )}
        </div>
      </div>

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

      {/* AI-Assisted Project Risk Assessment (Authorized Stakeholders Only) */}
      {isAuthorizedForRisk && (
        <section className="mt-6 rounded-xl border-2 border-nb-ink bg-white p-5 shadow-[4px_4px_0_#111]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-gray-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-nb-ink bg-nb-yellow text-sm font-black shadow-[2px_2px_0_#111]">
                  ⚡
                </span>
                <h2 className="text-base font-black text-nb-ink">
                  AI-Assisted Project Risk Assessment
                </h2>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 font-bold text-amber-900">
                  AI-assisted — review required
                </span>
                <span className="text-gray-500">
                  Risk indicator for human review · Not an official government score
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReanalyzeRisk}
              disabled={riskAnalyzing || riskLoading}
              className="flex items-center gap-1.5 rounded-lg border-2 border-nb-ink bg-nb-yellow px-3 py-1.5 text-xs font-black uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111] hover:bg-yellow-400 disabled:opacity-50"
            >
              {riskAnalyzing ? '🔄 Analyzing...' : '⚡ Re-analyze with AI'}
            </button>
          </div>

          {riskError && (
            <div className="mt-3 flex items-center justify-between rounded-lg border-2 border-amber-500 bg-amber-50 p-3 text-xs text-amber-900">
              <span>⚠️ {riskError}</span>
              <button
                type="button"
                onClick={handleReanalyzeRisk}
                className="font-bold underline hover:text-amber-950"
              >
                Retry
              </button>
            </div>
          )}

          {riskLoading ? (
            <div className="py-8 text-center text-xs text-gray-500">
              Evaluating project risk factors...
            </div>
          ) : riskData?.latest ? (
            <div className="mt-4 space-y-4">
              {/* Primary Risk Gauges */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Risk Level */}
                <div
                  className={`rounded-xl border-2 p-3.5 ${
                    riskData.latest.riskLevel === 'CRITICAL'
                      ? 'border-red-600 bg-red-50/70 text-red-900'
                      : riskData.latest.riskLevel === 'HIGH'
                      ? 'border-amber-500 bg-amber-50/70 text-amber-900'
                      : riskData.latest.riskLevel === 'MEDIUM'
                      ? 'border-yellow-500 bg-yellow-50/70 text-yellow-900'
                      : 'border-emerald-500 bg-emerald-50/70 text-emerald-900'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                    Risk Level
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-2xl font-black">{riskData.latest.riskLevel}</span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-black uppercase border border-current">
                      {riskData.latest.riskLevel === 'CRITICAL'
                        ? 'Immediate Review'
                        : riskData.latest.riskLevel === 'HIGH'
                        ? 'Action Needed'
                        : riskData.latest.riskLevel === 'MEDIUM'
                        ? 'Monitor'
                        : 'On Track'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] opacity-80">
                    {riskData.latest.isAiGenerated
                      ? 'Interpreted by Groq AI'
                      : 'Calculated via deterministic metrics'}
                  </p>
                </div>

                {/* Risk Score */}
                <div className="rounded-xl border-2 border-nb-ink bg-gray-50 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Risk Score
                  </p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-nb-ink">
                      {riskData.latest.riskScore}
                    </span>
                    <span className="text-xs font-bold text-gray-500">/ 100</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full transition-all ${
                        riskData.latest.riskScore >= 75
                          ? 'bg-red-600'
                          : riskData.latest.riskScore >= 50
                          ? 'bg-amber-500'
                          : riskData.latest.riskScore >= 25
                          ? 'bg-yellow-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, riskData.latest.riskScore)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-gray-500">
                    0 = negligible risk · 100 = critical review required
                  </p>
                </div>

                {/* Schedule Diagnostic */}
                <div className="rounded-xl border-2 border-gray-200 bg-white p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Schedule Diagnostics
                  </p>
                  <div className="mt-1 space-y-1 text-xs text-gray-700">
                    <div className="flex justify-between">
                      <span>Actual Progress:</span>
                      <span className="font-bold text-johar-green-700">
                        {project.currentProgress || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Progress:</span>
                      <span className="font-bold">
                        {riskData.latest.signals?.expectedProgress !== undefined
                          ? `${riskData.latest.signals.expectedProgress}%`
                          : 'N/A'}
                      </span>
                    </div>
                    {riskData.latest.signals?.progressGap > 0 && (
                      <div className="flex justify-between text-amber-700 font-semibold">
                        <span>Progress Gap:</span>
                        <span>-{riskData.latest.signals.progressGap}%</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-gray-400">
                    Assessed: {new Date(riskData.latest.generatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Assessment Summary */}
              {riskData.latest.summary && (
                <div className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 border border-gray-200">
                  <span className="font-bold text-gray-900 uppercase tracking-wide mr-1.5">
                    Summary:
                  </span>
                  {riskData.latest.summary}
                </div>
              )}

              {/* Two Columns: Why? (Risk Factors) & Recommended Actions */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* Why? (Risk Factors) */}
                <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <span>🔍 Why? (Risk Factors)</span>
                  </h3>
                  {riskData.latest.riskFactors?.length > 0 ? (
                    <ul className="mt-2.5 space-y-2">
                      {riskData.latest.riskFactors.map((rf, idx) => (
                        <li key={idx} className="rounded-lg bg-gray-50 p-2.5 text-xs border border-gray-100">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold uppercase tracking-wider text-[10px] text-gray-600">
                              {rf.type} Risk
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase ${
                                rf.severity === 'high'
                                  ? 'bg-red-100 text-red-800'
                                  : rf.severity === 'medium'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {rf.severity}
                            </span>
                          </div>
                          <p className="text-gray-800 leading-normal">{rf.explanation}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2.5 text-xs text-gray-500 italic">
                      No critical risk factors detected. Project proceeding within parameters.
                    </p>
                  )}
                </div>

                {/* Recommended Actions */}
                <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <span>📋 Recommended Actions</span>
                  </h3>
                  {riskData.latest.recommendedActions?.length > 0 ? (
                    <ul className="mt-2.5 space-y-1.5">
                      {riskData.latest.recommendedActions.map((action, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 rounded-lg bg-blue-50/50 p-2 text-xs text-blue-950 border border-blue-100"
                        >
                          <span className="font-bold text-blue-700 shrink-0">👉</span>
                          <span className="leading-normal">{action}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2.5 text-xs text-gray-500 italic">
                      No immediate actions required. Continue routine milestone execution.
                    </p>
                  )}

                  {/* Missing Information if any */}
                  {riskData.latest.missingInformation?.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        ℹ️ Information Gaps:
                      </p>
                      <ul className="mt-1 list-disc pl-4 text-[11px] text-gray-600 space-y-0.5">
                        {riskData.latest.missingInformation.map((info, idx) => (
                          <li key={idx}>{info}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Historical Trend & Progress (Requirement 16) */}
              {riskData.trend?.length > 1 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5">
                  <p className="text-xs font-black uppercase tracking-wider text-gray-700">
                    📈 Risk & Progress Trend
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-gray-500">Risk:</span>
                    {riskData.trend
                      .slice(0, 6)
                      .reverse()
                      .map((t, idx, arr) => (
                        <span key={idx} className="flex items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-black ${
                              t.riskLevel === 'CRITICAL'
                                ? 'bg-red-100 text-red-800'
                                : t.riskLevel === 'HIGH'
                                ? 'bg-amber-100 text-amber-800'
                                : t.riskLevel === 'MEDIUM'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {t.riskLevel} ({t.riskScore})
                          </span>
                          {idx < arr.length - 1 && (
                            <span className="text-gray-400 font-bold">→</span>
                          )}
                        </span>
                      ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-gray-500">Progress:</span>
                    {riskData.trend
                      .slice(0, 6)
                      .reverse()
                      .map((t, idx, arr) => (
                        <span key={idx} className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-johar-green-800">
                            {t.progress}%
                          </span>
                          {idx < arr.length - 1 && (
                            <span className="text-gray-400 font-bold">→</span>
                          )}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-5 text-center text-xs text-gray-500">
              No risk assessment on record yet.{' '}
              <button
                type="button"
                onClick={handleReanalyzeRisk}
                className="font-bold text-johar-green-700 underline hover:text-johar-green-900"
              >
                Generate assessment now
              </button>
            </div>
          )}
        </section>
      )}

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
              <li key={m._id} className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <span
                  className={`absolute -left-[31px] top-4 h-4 w-4 rounded-full border-2 border-white ${
                    m.verificationStatus === 'verified' || m.status === 'completed'
                      ? 'bg-johar-green-600'
                      : m.executionStatus === 'blocked'
                        ? 'bg-amber-600'
                        : m.executionStatus === 'in_progress' || m.status === 'in_progress'
                          ? 'bg-blue-500'
                          : m.status === 'delayed'
                            ? 'bg-red-500'
                            : 'bg-gray-300'
                  }`}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-base text-nb-ink">{m.title}</p>
                  <span className="text-xs text-gray-500 font-medium">due {fmtDate(m.dueDate)}</span>
                </div>

                {/* Status Badges */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      m.executionStatus === 'completed' || m.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : m.executionStatus === 'blocked'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : m.executionStatus === 'in_progress' || m.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Work: {m.executionStatus || m.status}
                  </span>

                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      m.verificationStatus === 'verified'
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : m.verificationStatus === 'submitted'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                          : m.verificationStatus === 'changes_requested'
                            ? 'bg-orange-100 text-orange-800'
                            : m.verificationStatus === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Verification: {String(m.verificationStatus || 'not_submitted').replace(/_/g, ' ')}
                  </span>
                </div>

                {m.description && <p className="mt-2 text-xs text-gray-700">{m.description}</p>}

                {/* Official Verification Sign-off or Revision notices */}
                {m.verificationStatus === 'verified' && (
                  <div className="mt-2 rounded-lg border border-green-200 bg-green-50/80 p-2.5 text-xs text-green-800 flex items-center gap-2">
                    <span className="font-bold">✓ Verified by Government Authority</span>
                    {m.verifiedAt && <span className="text-gray-500">· {fmtDate(m.verifiedAt)}</span>}
                    {m.verificationNotes && (
                      <span className="italic text-gray-600">· "{m.verificationNotes}"</span>
                    )}
                  </div>
                )}

                {m.verificationStatus === 'changes_requested' && (
                  <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50/80 p-2.5 text-xs text-orange-900">
                    <span className="font-bold">⚠️ Changes Requested by Authority: </span>
                    {m.verificationNotes || 'Revisions required before verification sign-off.'}
                  </div>
                )}

                {m.verificationStatus === 'rejected' && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50/80 p-2.5 text-xs text-red-900">
                    <span className="font-bold">✕ Verification Rejected: </span>
                    {m.verificationNotes}
                  </div>
                )}

                {/* Evidence Attachments */}
                {m.evidence?.length > 0 && (
                  <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/70 p-2.5 text-xs">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-gray-500">
                      Completion Evidence ({m.evidence.length}):
                    </span>
                    <ul className="mt-1.5 space-y-1">
                      {m.evidence.map((ev, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="rounded bg-white px-1.5 py-0.5 border text-[10px] font-bold uppercase text-gray-600">
                            {ev.type}
                          </span>
                          <span className="font-medium text-gray-800">{ev.title}</span>
                          {ev.url && (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-johar-green-700 underline text-[11px] font-semibold"
                            >
                              Attachment ↗
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                  {/* Team actions */}
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEvidenceModalMilestone(m);
                          setEvidenceForm({
                            type: 'document',
                            title: '',
                            url: '',
                            description: '',
                            isPublic: true,
                          });
                        }}
                        className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        📎 Attach Evidence
                      </button>
                      {m.verificationStatus !== 'verified' &&
                        m.verificationStatus !== 'submitted' && (
                          <button
                            type="button"
                            onClick={() => handleVerificationSubmit(m._id)}
                            className="rounded border-2 border-nb-ink bg-nb-yellow px-2.5 py-1 text-xs font-bold text-nb-ink shadow-[1px_1px_0_#111] hover:bg-yellow-400"
                          >
                            📋 Submit for Verification
                          </button>
                        )}
                    </>
                  )}

                  {/* Government / Admin Actions */}
                  {isGovOrAdmin && (
                    <>
                      {m.verificationStatus !== 'verified' && (
                        <button
                          type="button"
                          onClick={() => {
                            setVerifyModalMilestone(m);
                            setVerifyActionType('verify');
                            setVerifyNotes('Inspected and verified in order.');
                          }}
                          className="rounded border border-johar-green-700 bg-johar-green-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-johar-green-800"
                        >
                          ✓ Sign-Off & Verify
                        </button>
                      )}
                      {m.verificationStatus === 'submitted' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setVerifyModalMilestone(m);
                              setVerifyActionType('request_changes');
                              setVerifyNotes('');
                            }}
                            className="rounded border border-amber-600 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                          >
                            🔄 Request Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVerifyModalMilestone(m);
                              setVerifyActionType('reject');
                              setVerifyNotes('');
                            }}
                            className="rounded border border-red-600 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => act(() => deleteMilestone(m._id).then(refreshAll))}
                      className="ml-auto text-xs text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
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

      {/* MODAL: ATTACH EVIDENCE */}
      {evidenceModalMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border-2 border-nb-ink bg-white p-6 shadow-[6px_6px_0_#111]">
            <h3 className="text-lg font-black text-nb-ink">📎 Attach Milestone Evidence</h3>
            <p className="mt-1 text-xs text-gray-600">
              Milestone: <strong>{evidenceModalMilestone.title}</strong>
            </p>

            <form onSubmit={submitEvidence} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700">Evidence Type</label>
                <select
                  value={evidenceForm.type}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, type: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                >
                  <option value="document">Document / PDF Report</option>
                  <option value="image">Inspection / Field Photo</option>
                  <option value="video">Demonstration Video</option>
                  <option value="prototype_link">Live Prototype / Code URL</option>
                  <option value="field_measurement">Field Measurement / Test Data</option>
                  <option value="completion_notes">Completion Notes</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700">Title *</label>
                <input
                  type="text"
                  required
                  value={evidenceForm.title}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })}
                  placeholder="e.g. PHED Water Quality Test Certificate"
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700">URL / Document Link (optional)</label>
                <input
                  type="url"
                  value={evidenceForm.url}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, url: e.target.value })}
                  placeholder="https://drive.google.com/... or public report link"
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700">Description / Details</label>
                <textarea
                  value={evidenceForm.description}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, description: e.target.value })}
                  rows={2}
                  placeholder="Summary of findings, metrics achieved, or test results..."
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="evidenceIsPublic"
                  checked={evidenceForm.isPublic}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, isPublic: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="evidenceIsPublic" className="text-gray-700">
                  Visible to the public for citizen transparency
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEvidenceModalMilestone(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg border-2 border-nb-ink bg-nb-yellow px-4 py-2 text-xs font-black uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111] hover:bg-yellow-400"
                >
                  Save Evidence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VERIFY / REVIEW MILESTONE */}
      {verifyModalMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border-2 border-nb-ink bg-white p-6 shadow-[6px_6px_0_#111]">
            <h3 className="text-lg font-black text-nb-ink">
              {verifyActionType === 'verify' && '✓ Sign-Off & Verify Milestone'}
              {verifyActionType === 'request_changes' && '🔄 Request Changes on Milestone'}
              {verifyActionType === 'reject' && '✕ Reject Milestone Verification'}
            </h3>
            <p className="mt-1 text-xs text-gray-600">
              Milestone: <strong>{verifyModalMilestone.title}</strong>
            </p>

            <div className="mt-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Official Authority Notes & Feedback
              </label>
              <textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                rows={4}
                placeholder="Enter sign-off comments, required revisions, or feedback..."
                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-xs focus:border-johar-green-700 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVerifyModalMilestone(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitVerifyAction}
                className="rounded-lg border-2 border-nb-ink bg-nb-yellow px-4 py-2 text-xs font-black uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111] hover:bg-yellow-400"
              >
                Confirm Sign-Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN GOVERNMENT AUTHORITY */}
      {showAssignGovModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border-2 border-nb-ink bg-white p-6 shadow-[6px_6px_0_#111]">
            <h3 className="text-lg font-black text-nb-ink">Assign Government Responsibility</h3>
            <p className="mt-1 text-xs text-gray-600">Project: {project?.title}</p>

            <form onSubmit={submitGovAssignment} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700">Department</label>
                <select
                  value={assignGovForm.department}
                  onChange={(e) => setAssignGovForm({ ...assignGovForm, department: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                >
                  <option value="">Select Department</option>
                  {(govHierarchy?.departments || []).map((dep) => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700">Authority Level</label>
                  <select
                    value={assignGovForm.authorityLevel}
                    onChange={(e) =>
                      setAssignGovForm({ ...assignGovForm, authorityLevel: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                  >
                    <option value="state">State</option>
                    <option value="district">District</option>
                    <option value="block">Block</option>
                    <option value="local_body">Local Body</option>
                    <option value="department">Department</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700">District</label>
                  <select
                    value={assignGovForm.district}
                    onChange={(e) => setAssignGovForm({ ...assignGovForm, district: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                  >
                    <option value="">Select District</option>
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700">Block (optional)</label>
                  <input
                    type="text"
                    value={assignGovForm.block}
                    onChange={(e) => setAssignGovForm({ ...assignGovForm, block: e.target.value })}
                    placeholder="e.g. Kanke, Mandar"
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700">Local Body (optional)</label>
                  <input
                    type="text"
                    value={assignGovForm.localBody}
                    onChange={(e) => setAssignGovForm({ ...assignGovForm, localBody: e.target.value })}
                    placeholder="e.g. Gram Panchayat, Municipal Corp"
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700">Administrative Notes</label>
                <textarea
                  value={assignGovForm.notes}
                  onChange={(e) => setAssignGovForm({ ...assignGovForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Official instructions or responsibility notes..."
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignGovModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg border-2 border-nb-ink bg-nb-yellow px-4 py-2 text-xs font-black uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111] hover:bg-yellow-400"
                >
                  Save Responsibility
                </button>
              </div>
            </form>
          </div>
        </div>
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
