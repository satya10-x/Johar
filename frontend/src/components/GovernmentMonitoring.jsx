import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  getGovernmentProjects,
  getGovernmentMilestones,
  getGovernmentEscalations,
  updateGovernmentEscalation,
  scanGovernmentEscalations,
  createGovernmentEscalation,
  getGovernmentAtRisk,
  getGovernmentAudit,
  getGovernmentHierarchy,
  assignProjectAuthority,
} from '../services/governmentService.js';
import {
  verifyMilestone,
  requestMilestoneChanges,
  rejectMilestone,
} from '../services/milestoneService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { CATEGORIES, DISTRICTS } from '../utils/constants.js';
import { getProjectsRiskSummary } from '../services/projectService.js';

const selectClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : 'N/A');

const EXECUTION_BADGES = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-50 text-blue-700 border border-blue-200',
  completed: 'bg-green-50 text-green-700 border border-green-200',
  delayed: 'bg-red-50 text-red-700 border border-red-200',
  blocked: 'bg-amber-100 text-amber-900 border border-amber-300',
};

const VERIFICATION_BADGES = {
  not_submitted: 'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-50 text-amber-800 border border-amber-300 animate-pulse',
  under_review: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  verified: 'bg-green-100 text-green-800 border border-green-300 font-semibold',
  changes_requested: 'bg-orange-50 text-orange-800 border border-orange-200',
  rejected: 'bg-red-100 text-red-800 border border-red-300',
};

export default function GovernmentMonitoring() {
  const { user } = useAuth();

  // Scope & Hierarchy filter state
  const [hierarchyData, setHierarchyData] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(user?.district || '');
  const [selectedDepartment, setSelectedDepartment] = useState(user?.department || '');
  const [selectedLevel, setSelectedLevel] = useState('all'); // 'all' | 'state' | 'district' | 'block' | 'local_body'

  // Data states
  const [projects, setProjects] = useState([]);
  const [projectStats, setProjectStats] = useState({ total: 0, active: 0, completed: 0 });
  const [awaitingMilestones, setAwaitingMilestones] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [escalationStats, setEscalationStats] = useState({ open: 0, acknowledged: 0, resolved: 0 });
  const [atRiskList, setAtRiskList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [aiRiskData, setAiRiskData] = useState(null);
  const [aiRiskFilter, setAiRiskFilter] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'ai_risk' | 'at_risk' | 'verification' | 'escalations' | 'projects' | 'audit'
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Modal states
  const [verifyModalMilestone, setVerifyModalMilestone] = useState(null);
  const [verifyActionType, setVerifyActionType] = useState('verify'); // 'verify' | 'request_changes' | 'reject'
  const [verifyNotes, setVerifyNotes] = useState('');
  const [assignModalProject, setAssignModalProject] = useState(null);
  const [assignForm, setAssignForm] = useState({
    department: '',
    authorityLevel: 'district',
    district: '',
    block: '',
    localBody: '',
    notes: '',
  });

  // Manual Escalation modal
  const [escalateModalProject, setEscalateModalProject] = useState(null);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateLevel, setEscalateLevel] = useState('district');

  // Load hierarchy metadata once
  useEffect(() => {
    getGovernmentHierarchy()
      .then((data) => setHierarchyData(data))
      .catch(() => {});
  }, []);

  // Fetch all monitoring data when filter changes
  useEffect(() => {
    loadAllData();
  }, [selectedDistrict, selectedDepartment, aiRiskFilter]);

  async function loadAllData() {
    setIsLoading(true);
    setActionError('');
    try {
      const params = {};
      if (selectedDistrict) params.district = selectedDistrict;
      if (selectedDepartment) params.department = selectedDepartment;

      const riskParams = { ...params };
      if (aiRiskFilter) riskParams.riskLevel = aiRiskFilter;

      const [projRes, mileRes, escRes, riskRes, auditRes, aiRiskRes] = await Promise.all([
        getGovernmentProjects(params),
        getGovernmentMilestones({ ...params, verificationStatus: 'submitted' }),
        getGovernmentEscalations(params),
        getGovernmentAtRisk(),
        getGovernmentAudit({ limit: 15 }),
        getProjectsRiskSummary(riskParams).catch(() => null),
      ]);

      setProjects(projRes.projects || []);
      setProjectStats(projRes.stats || { total: 0, active: 0, completed: 0 });
      setAwaitingMilestones(mileRes.milestones || []);
      setEscalations(escRes.escalations || []);
      setEscalationStats(escRes.stats || { open: 0, acknowledged: 0, resolved: 0 });
      setAtRiskList(riskRes.atRiskProjects || []);
      setAuditLogs(auditRes.logs || []);
      if (aiRiskRes) setAiRiskData(aiRiskRes);
    } catch {
      setActionError('Failed to load governance monitoring data.');
    } finally {
      setIsLoading(false);
    }
  }

  // Handle Escalation status actions
  async function handleEscalationAction(escalationId, action, defaultNotes = '') {
    try {
      const notes = prompt(`Enter notes for ${action}:`, defaultNotes) ?? defaultNotes;
      await updateGovernmentEscalation(escalationId, { action, notes });
      setActionMessage(`Escalation successfully updated: ${action}`);
      setTimeout(() => setActionMessage(''), 4000);
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update escalation');
    }
  }

  // Handle Automated Escalation Scan
  async function handleRunScan() {
    setIsScanning(true);
    try {
      const res = await scanGovernmentEscalations();
      setActionMessage(
        `Escalation scan completed: ${res.scannedProjects} projects scanned, ${res.newEscalations} new escalations triggered, ${res.updatedEscalations} updated.`
      );
      setTimeout(() => setActionMessage(''), 6000);
      loadAllData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to execute escalation scan');
    } finally {
      setIsScanning(false);
    }
  }

  // Handle Milestone Verification modal submit
  async function submitVerificationAction() {
    if (!verifyModalMilestone) return;
    try {
      if (verifyActionType === 'verify') {
        await verifyMilestone(verifyModalMilestone._id, verifyNotes);
        setActionMessage('Milestone verified and signed off successfully!');
      } else if (verifyActionType === 'request_changes') {
        if (!verifyNotes.trim()) {
          alert('Please enter notes explaining the required changes.');
          return;
        }
        await requestMilestoneChanges(verifyModalMilestone._id, verifyNotes);
        setActionMessage('Changes requested on milestone.');
      } else if (verifyActionType === 'reject') {
        if (!verifyNotes.trim()) {
          alert('Please enter notes explaining rejection reason.');
          return;
        }
        await rejectMilestone(verifyModalMilestone._id, verifyNotes);
        setActionMessage('Milestone rejected.');
      }
      setVerifyModalMilestone(null);
      setVerifyNotes('');
      setTimeout(() => setActionMessage(''), 4000);
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process milestone verification');
    }
  }

  // Open authority assignment modal
  function openAssignModal(project) {
    setAssignModalProject(project);
    setAssignForm({
      department: project.governmentOwnership?.department || '',
      authorityLevel: project.governmentOwnership?.authorityLevel || 'district',
      district:
        project.governmentOwnership?.district ||
        project.deploymentDetails?.district ||
        selectedDistrict ||
        '',
      block: project.governmentOwnership?.block || '',
      localBody: project.governmentOwnership?.localBody || '',
      notes: project.governmentOwnership?.notes || '',
    });
  }

  // Submit authority assignment
  async function submitAuthorityAssignment(e) {
    e.preventDefault();
    if (!assignModalProject) return;
    try {
      await assignProjectAuthority(assignModalProject._id, assignForm);
      setActionMessage('Government authority assigned successfully!');
      setAssignModalProject(null);
      setTimeout(() => setActionMessage(''), 4000);
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign authority');
    }
  }

  // Submit manual escalation
  async function submitManualEscalation(e) {
    e.preventDefault();
    if (!escalateModalProject || !escalateReason.trim()) return;
    try {
      await createGovernmentEscalation({
        projectId: escalateModalProject._id,
        trigger: 'manual',
        reason: escalateReason.trim(),
        escalatedTo: escalateLevel,
      });
      setActionMessage('Escalation created successfully');
      setEscalateModalProject(null);
      setEscalateReason('');
      setTimeout(() => setActionMessage(''), 4000);
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create escalation');
    }
  }

  const userScope = hierarchyData?.userScope || {};

  return (
    <div className="space-y-6">
      {/* Scope Banner */}
      <div className="rounded-xl border-2 border-nb-ink bg-nb-yellow/20 p-4 shadow-[3px_3px_0_#111]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-nb-ink bg-nb-yellow text-sm font-bold shadow-[2px_2px_0_#111]">
              🏛️
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Official Authority Scope
              </p>
              <p className="text-sm font-extrabold text-nb-ink">
                {user?.role === 'admin'
                  ? 'Platform Administrator — Statewide Unrestricted Access'
                  : `Government Official — ${userScope.level ? userScope.level.replace('_', ' ').toUpperCase() : 'DISTRICT'} LEVEL (${user?.district || userScope.district || 'Jharkhand'})`}
                {user?.department && (
                  <span className="ml-2 font-normal text-gray-700">· {user.department}</span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRunScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 rounded-lg border-2 border-nb-ink bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_#111] transition-all hover:bg-nb-yellow hover:shadow-[3px_3px_0_#111] disabled:opacity-50"
          >
            {isScanning ? '⏳ Scanning...' : '⚡ Run Escalation Scan'}
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-lg border-2 border-johar-green-700 bg-green-50 p-3 text-sm font-semibold text-johar-green-800">
          ✓ {actionMessage}
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm font-semibold text-red-700">
          ⚠️ {actionError}
        </div>
      )}

      {/* Interactive Hierarchy Filter Bar */}
      <div className="rounded-xl border-2 border-nb-ink bg-white p-4 shadow-[3px_3px_0_#111]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-gray-700 uppercase tracking-wide">
              Hierarchy Filter:
            </span>
            <span
              onClick={() => {
                setSelectedDistrict('');
                setSelectedDepartment('');
              }}
              className={`cursor-pointer rounded-md px-2.5 py-1 font-bold transition-all ${
                !selectedDistrict && !selectedDepartment
                  ? 'border border-nb-ink bg-nb-yellow text-nb-ink shadow-[1px_1px_0_#111]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Jharkhand (Statewide)
            </span>
            <span className="text-gray-400">➔</span>
            <span className="font-medium text-gray-700">
              {selectedDistrict ? `District: ${selectedDistrict}` : 'All Districts'}
            </span>
            {selectedDepartment && (
              <>
                <span className="text-gray-400">➔</span>
                <span className="font-medium text-gray-700">Dept: {selectedDepartment}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className={selectClass}
            >
              <option value="">All Districts (24)</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className={selectClass}
            >
              <option value="">All Departments</option>
              {(hierarchyData?.departments || []).map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>

            {(selectedDistrict || selectedDepartment) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDistrict('');
                  setSelectedDepartment('');
                }}
                className="text-xs font-semibold text-gray-600 hover:text-red-600"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary Governance Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border-2 border-nb-ink bg-white p-3.5 shadow-[3px_3px_0_#111]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Total Projects
          </p>
          <p className="mt-1 text-2xl font-black text-nb-ink">{projectStats.total}</p>
          <p className="mt-0.5 text-[10px] text-gray-500">{projectStats.active} active</p>
        </div>

        <div className="rounded-xl border-2 border-nb-ink bg-white p-3.5 shadow-[3px_3px_0_#111]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            At-Risk Projects
          </p>
          <p className="mt-1 text-2xl font-black text-amber-600">{atRiskList.length}</p>
          <p className="mt-0.5 text-[10px] text-gray-500">Need attention</p>
        </div>

        <div className="rounded-xl border-2 border-nb-ink bg-white p-3.5 shadow-[3px_3px_0_#111]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            Awaiting Verification
          </p>
          <p className="mt-1 text-2xl font-black text-blue-600">{awaitingMilestones.length}</p>
          <p className="mt-0.5 text-[10px] text-gray-500">Milestones submitted</p>
        </div>

        <div className="rounded-xl border-2 border-nb-ink bg-white p-3.5 shadow-[3px_3px_0_#111]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">
            Open Escalations
          </p>
          <p className="mt-1 text-2xl font-black text-red-600">{escalationStats.open}</p>
          <p className="mt-0.5 text-[10px] text-gray-500">{escalationStats.acknowledged} acknowledged</p>
        </div>

        <div className="rounded-xl border-2 border-nb-ink bg-white p-3.5 shadow-[3px_3px_0_#111]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-green-700">
            Resolved Escalations
          </p>
          <p className="mt-1 text-2xl font-black text-green-600">{escalationStats.resolved}</p>
          <p className="mt-0.5 text-[10px] text-gray-500">Closed successfully</p>
        </div>

        <div className="rounded-xl border-2 border-nb-ink bg-white p-3.5 shadow-[3px_3px_0_#111]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-johar-green-700">
            Completed Projects
          </p>
          <p className="mt-1 text-2xl font-black text-johar-green-700">{projectStats.completed}</p>
          <p className="mt-0.5 text-[10px] text-gray-500">Delivered solutions</p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b-2 border-nb-ink bg-white overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Summary', count: null },
          {
            id: 'ai_risk',
            label: '⚡ AI Risk Overview',
            count: (aiRiskData?.summary?.critical || 0) + (aiRiskData?.summary?.high || 0),
          },
          { id: 'at_risk', label: '⚠️ At-Risk Monitoring', count: atRiskList.length },
          {
            id: 'verification',
            label: '📋 Awaiting Verification',
            count: awaitingMilestones.length,
          },
          {
            id: 'escalations',
            label: '🚨 Escalations',
            count: escalationStats.open,
          },
          { id: 'projects', label: '📁 Scoped Projects', count: projects.length },
          { id: 'audit', label: '📜 Governance Audit Trail', count: null },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-r border-gray-200 ${
              activeTab === tab.id
                ? 'border-b-4 border-b-nb-yellow bg-nb-yellow/15 text-nb-ink font-extrabold'
                : 'text-gray-500 hover:text-nb-ink hover:bg-gray-50'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  tab.count > 0 ? 'bg-nb-yellow text-nb-ink' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
          Loading governance data...
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW & QUICK ACTIONS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* High Priority: Awaiting Verification Quick Card */}
              {awaitingMilestones.length > 0 && (
                <div className="rounded-xl border-2 border-amber-500 bg-amber-50/50 p-5 shadow-[3px_3px_0_#111]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-extrabold text-amber-900">
                        ⚡ {awaitingMilestones.length} Milestone(s) Awaiting Authority Verification
                      </h2>
                      <p className="mt-1 text-xs text-amber-800">
                        Work has been submitted by project teams. Government sign-off is required to
                        verify completion.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('verification')}
                      className="rounded-lg border border-amber-800 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 shadow-[1px_1px_0_#111] hover:bg-amber-100"
                    >
                      Review All ➔
                    </button>
                  </div>
                </div>
              )}

              {/* At-Risk Quick Overview */}
              {atRiskList.length > 0 && (
                <div className="rounded-xl border-2 border-nb-ink bg-white p-5 shadow-[3px_3px_0_#111]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-extrabold text-nb-ink">
                        ⚠️ High Priority At-Risk Projects
                      </h2>
                      <p className="mt-1 text-xs text-gray-500">
                        Informational indicators based on scheduled timeline vs actual progress.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('at_risk')}
                      className="text-xs font-bold text-johar-green-700 hover:underline"
                    >
                      View all {atRiskList.length} at-risk ➔
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {atRiskList.slice(0, 4).map(({ project: p, risk }) => (
                      <div
                        key={p._id}
                        className="rounded-lg border border-amber-200 bg-amber-50/40 p-3.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/projects/${p._id}`}
                            className="font-bold text-sm text-nb-ink hover:text-johar-green-700 hover:underline"
                          >
                            {p.title}
                          </Link>
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold uppercase tracking-wider text-[10px] text-amber-800">
                            {risk.severity} Risk
                          </span>
                        </div>
                        <p className="mt-1 text-gray-500">
                          {p.university?.name || 'University'} ·{' '}
                          {p.governmentOwnership?.department || 'Department TBD'}
                        </p>

                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500">Schedule:</span>
                            <span className="font-semibold">
                              Expected: {risk.expectedProgress}% · Actual: {risk.actualProgress}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-200">
                            <div
                              className="h-1.5 rounded-full bg-amber-500"
                              style={{ width: `${risk.actualProgress}%` }}
                            />
                          </div>
                        </div>

                        <ul className="mt-2 space-y-0.5 text-[11px] text-amber-800">
                          {risk.riskFactors.map((rf, idx) => (
                            <li key={idx}>• {rf}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Risk Detection Snapshot in Overview */}
              {aiRiskData && (
                <div className="rounded-xl border-2 border-nb-ink bg-white p-5 shadow-[3px_3px_0_#111]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">⚡</span>
                        <h2 className="text-base font-extrabold text-nb-ink">
                          AI-Assisted Project Risk Detection
                        </h2>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Groq AI interpretation of progress gaps, overdue milestones, and evidence status.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('ai_risk')}
                      className="rounded-lg border-2 border-nb-ink bg-nb-yellow px-3 py-1 text-xs font-black uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111] hover:bg-yellow-400"
                    >
                      Open Full AI Risk Table ➔
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-800">High / Critical</p>
                      <p className="mt-1 text-xl font-black text-red-700">
                        {(aiRiskData.summary?.critical || 0) + (aiRiskData.summary?.high || 0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50/60 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-800">Medium Risk</p>
                      <p className="mt-1 text-xl font-black text-yellow-700">
                        {aiRiskData.summary?.medium || 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Low / On Track</p>
                      <p className="mt-1 text-xl font-black text-emerald-700">
                        {aiRiskData.summary?.low || 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Total Analyzed</p>
                      <p className="mt-1 text-xl font-black text-nb-ink">
                        {aiRiskData.summary?.total || 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Escalations Summary */}
              <div className="rounded-xl border-2 border-nb-ink bg-white p-5 shadow-[3px_3px_0_#111]">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-nb-ink">
                    🚨 Active Escalations ({escalations.filter((e) => e.status === 'open').length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('escalations')}
                    className="text-xs font-bold text-johar-green-700 hover:underline"
                  >
                    View all escalations ➔
                  </button>
                </div>

                {escalations.length === 0 ? (
                  <p className="mt-3 text-xs text-gray-500">No active escalations recorded.</p>
                ) : (
                  <div className="mt-4 divide-y divide-gray-100">
                    {escalations.slice(0, 5).map((e) => (
                      <div key={e._id} className="py-2.5 text-xs flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-nb-ink">{e.reason}</p>
                          <p className="mt-0.5 text-gray-500">
                            Project: {e.project?.title} · Escalated to:{' '}
                            <span className="font-semibold uppercase text-indigo-700">
                              {e.escalatedTo}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              e.status === 'open'
                                ? 'bg-red-100 text-red-800'
                                : e.status === 'acknowledged'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {e.status}
                          </span>
                          {e.status === 'open' && (
                            <button
                              type="button"
                              onClick={() => handleEscalationAction(e._id, 'acknowledged')}
                              className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: AI RISK OVERVIEW */}
          {activeTab === 'ai_risk' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="rounded-xl border-2 border-nb-ink bg-white p-5 shadow-[3px_3px_0_#111]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-nb-ink bg-nb-yellow text-sm font-black shadow-[2px_2px_0_#111]">
                        ⚡
                      </span>
                      <h3 className="text-base font-black text-nb-ink">
                        AI Risk Overview & Delay Detection
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">
                      Evaluates schedule lag, milestone delays, missing evidence, and verification bottlenecks using deterministic facts interpreted by Groq AI.
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-900">
                    AI-assisted — review required · Human authority decides
                  </span>
                </div>
              </div>

              {/* 4 AI Risk Overview Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border-2 border-nb-ink bg-red-50/70 p-4 shadow-[3px_3px_0_#111]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-900">
                    High Risk Projects
                  </p>
                  <p className="mt-1 text-3xl font-black text-red-700">
                    {(aiRiskData?.summary?.critical || 0) + (aiRiskData?.summary?.high || 0)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-red-800">
                    {aiRiskData?.summary?.critical || 0} critical · {aiRiskData?.summary?.high || 0} high
                  </p>
                </div>

                <div className="rounded-xl border-2 border-nb-ink bg-yellow-50/70 p-4 shadow-[3px_3px_0_#111]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-yellow-900">
                    Medium Risk Projects
                  </p>
                  <p className="mt-1 text-3xl font-black text-yellow-700">
                    {aiRiskData?.summary?.medium || 0}
                  </p>
                  <p className="mt-0.5 text-[10px] text-yellow-800">
                    Requires periodic tracking
                  </p>
                </div>

                <div className="rounded-xl border-2 border-nb-ink bg-amber-50/70 p-4 shadow-[3px_3px_0_#111]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                    At-Risk Projects
                  </p>
                  <p className="mt-1 text-3xl font-black text-amber-700">
                    {(aiRiskData?.projects || []).filter(
                      (p) =>
                        p.assessment?.riskLevel === 'CRITICAL' ||
                        p.assessment?.riskLevel === 'HIGH' ||
                        (p.signals?.delayedMilestones || 0) > 0 ||
                        (p.signals?.progressGap || 0) > 15
                    ).length}
                  </p>
                  <p className="mt-0.5 text-[10px] text-amber-800">
                    Schedule or evidence deficit
                  </p>
                </div>

                <div className="rounded-xl border-2 border-nb-ink bg-emerald-50/70 p-4 shadow-[3px_3px_0_#111]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                    Recently Improved / Low
                  </p>
                  <p className="mt-1 text-3xl font-black text-emerald-700">
                    {(aiRiskData?.projects || []).filter(
                      (p) =>
                        p.assessment?.riskLevel === 'LOW' && (p.project?.currentProgress || 0) > 20
                    ).length || aiRiskData?.summary?.low || 0}
                  </p>
                  <p className="mt-0.5 text-[10px] text-emerald-800">
                    Satisfactory milestones
                  </p>
                </div>
              </div>

              {/* Risk Level Filter Chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Filter by Risk:
                </span>
                {['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setAiRiskFilter(lvl)}
                    className={`rounded-lg border-2 px-3 py-1 text-xs font-black uppercase tracking-wider transition-all ${
                      aiRiskFilter === lvl
                        ? 'border-nb-ink bg-nb-yellow text-nb-ink shadow-[2px_2px_0_#111]'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {lvl === '' ? 'All Risk Levels' : lvl}
                  </button>
                ))}
              </div>

              {/* Project Risk Table (Requirement 11) */}
              <div className="overflow-hidden rounded-xl border-2 border-nb-ink bg-white shadow-[3px_3px_0_#111]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b-2 border-nb-ink bg-gray-50 font-black uppercase tracking-wider text-gray-700">
                    <tr>
                      <th className="p-3">Project</th>
                      <th className="p-3">District</th>
                      <th className="p-3">Progress</th>
                      <th className="p-3">Expected Progress</th>
                      <th className="p-3">Risk</th>
                      <th className="p-3">Main Risk Factor</th>
                      <th className="p-3">Last Analysis</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {!aiRiskData?.projects || aiRiskData.projects.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-gray-500">
                          No projects matching the selected risk filters.
                        </td>
                      </tr>
                    ) : (
                      aiRiskData.projects.map((item) => {
                        const proj = item.project;
                        const assess = item.assessment || {};
                        const signals = item.signals || {};
                        const topFactor = assess.riskFactors?.[0];

                        return (
                          <tr key={proj._id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="p-3">
                              <Link
                                to={`/projects/${proj._id}`}
                                className="font-bold text-gray-900 hover:text-johar-green-700 hover:underline"
                              >
                                {proj.title}
                              </Link>
                              <span className="block text-[10px] text-gray-500">
                                {proj.university?.name || 'Academic Institution'}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-gray-700">
                              {proj.governmentOwnership?.district ||
                                proj.deploymentDetails?.district ||
                                proj.university?.district ||
                                'Jharkhand'}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-johar-green-700">
                                  {proj.currentProgress || 0}%
                                </span>
                              </div>
                              <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                                <div
                                  className="h-full bg-johar-green-600 rounded-full"
                                  style={{ width: `${proj.currentProgress || 0}%` }}
                                />
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-gray-800">
                                {signals.expectedProgress !== undefined
                                  ? `${signals.expectedProgress}%`
                                  : 'N/A'}
                              </span>
                              {signals.progressGap > 0 && (
                                <span className="block text-[10px] text-amber-700 font-bold">
                                  (-{signals.progressGap}%)
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
                                    assess.riskLevel === 'CRITICAL'
                                      ? 'bg-red-100 text-red-800 border border-red-300'
                                      : assess.riskLevel === 'HIGH'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : assess.riskLevel === 'MEDIUM'
                                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  }`}
                                >
                                  {assess.riskLevel || 'LOW'}
                                </span>
                                <span className="text-[10px] text-gray-500 font-bold">
                                  {assess.riskScore ?? 0}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-[11px] text-gray-700 max-w-xs truncate" title={topFactor?.explanation || assess.summary}>
                              {topFactor?.explanation || assess.summary || 'Normal operations'}
                            </td>
                            <td className="p-3 whitespace-nowrap text-[11px] text-gray-500">
                              <div>{fmtDate(assess.generatedAt)}</div>
                              <span
                                className={`inline-block mt-0.5 rounded px-1 text-[9px] font-bold ${
                                  assess.isAiGenerated
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {assess.isAiGenerated ? 'Groq AI' : 'Deterministic'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <Link
                                to={`/projects/${proj._id}`}
                                className="inline-block rounded-lg border-2 border-nb-ink bg-white px-2.5 py-1 text-[11px] font-bold shadow-[2px_2px_0_#111] hover:bg-nb-yellow"
                              >
                                View Project
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: AT-RISK MONITORING */}
          {activeTab === 'at_risk' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="font-bold text-sm text-gray-800">
                  Proactive At-Risk Work Monitoring
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Identifies projects that may require support or administrative unblocking before
                  milestones become severely delayed.
                </p>
              </div>

              {atRiskList.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
                  ✓ No projects currently flagged as at-risk within this authority scope.
                </div>
              ) : (
                <div className="space-y-3">
                  {atRiskList.map(({ project: p, risk, milestones: mList }) => (
                    <div
                      key={p._id}
                      className="rounded-xl border-2 border-nb-ink bg-white p-5 shadow-[3px_3px_0_#111]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/projects/${p._id}`}
                              className="font-black text-base text-nb-ink hover:text-johar-green-700 hover:underline"
                            >
                              {p.title}
                            </Link>
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                              {risk.severity} Risk
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            University: {p.university?.name || 'TBD'} · District:{' '}
                            {p.governmentOwnership?.district || p.challenge?.district || 'N/A'} ·
                            Department: {p.governmentOwnership?.department || 'Unassigned'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEscalateModalProject(p);
                              setEscalateReason(
                                `Schedule lag: Expected ${risk.expectedProgress}% vs Actual ${risk.actualProgress}%. ${risk.riskFactors.join('; ')}`
                              );
                            }}
                            className="rounded-lg border-2 border-nb-ink bg-nb-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111] hover:bg-yellow-400"
                          >
                            🚨 Escalate Authority
                          </button>
                        </div>
                      </div>

                      {/* Progress comparison */}
                      <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-3 sm:grid-cols-4 text-xs">
                        <div>
                          <span className="text-gray-500">Expected Progress</span>
                          <p className="text-sm font-bold text-blue-700">{risk.expectedProgress}%</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Actual Progress</span>
                          <p className="text-sm font-bold text-amber-700">{risk.actualProgress}%</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Expected End Date</span>
                          <p className="text-sm font-medium">{fmtDate(p.expectedEndDate)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Overdue Milestones</span>
                          <p className="text-sm font-bold text-red-600">
                            {risk.overdueMilestonesCount}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-700">
                          Identified Risk Factors:
                        </p>
                        <ul className="mt-1 space-y-1 text-xs text-amber-900">
                          {risk.riskFactors.map((factor, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <span>⚠️</span>
                              <span>{factor}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AWAITING VERIFICATION */}
          {activeTab === 'verification' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="font-bold text-sm text-gray-800">
                  Milestone Verification Sign-Off
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Government authorities verify milestone execution upon reviewing completion
                  evidence submitted by university and industry teams.
                </p>
              </div>

              {awaitingMilestones.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
                  ✓ No milestones currently awaiting verification.
                </div>
              ) : (
                <div className="space-y-3">
                  {awaitingMilestones.map((m) => (
                    <div
                      key={m._id}
                      className="rounded-xl border-2 border-nb-ink bg-white p-5 shadow-[3px_3px_0_#111]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-base text-nb-ink">{m.title}</h4>
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                              Verification Submitted
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Project:{' '}
                            <Link
                              to={`/projects/${m.project?._id}`}
                              className="font-medium text-johar-green-700 hover:underline"
                            >
                              {m.project?.title}
                            </Link>{' '}
                            · Due: {fmtDate(m.dueDate)} · Evidence: {m.evidenceCount} attachment(s)
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setVerifyModalMilestone(m);
                              setVerifyActionType('verify');
                              setVerifyNotes('Verified and found in order upon review.');
                            }}
                            className="rounded-lg border-2 border-nb-ink bg-johar-green-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-[2px_2px_0_#111] hover:bg-johar-green-800"
                          >
                            ✓ Verify & Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVerifyModalMilestone(m);
                              setVerifyActionType('request_changes');
                              setVerifyNotes('');
                            }}
                            className="rounded-lg border-2 border-nb-ink bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-800 shadow-[2px_2px_0_#111] hover:bg-amber-50"
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
                            className="rounded-lg border-2 border-nb-ink bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-700 shadow-[2px_2px_0_#111] hover:bg-red-50"
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </div>

                      {m.description && (
                        <p className="mt-2 text-xs text-gray-700">{m.description}</p>
                      )}

                      {/* Evidence attached */}
                      {m.evidence?.length > 0 && (
                        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                            Attached Completion Evidence:
                          </p>
                          <ul className="mt-1.5 space-y-1 text-xs">
                            {m.evidence.map((ev, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <span className="font-semibold text-gray-700">[{ev.type}]:</span>
                                <span>{ev.title}</span>
                                {ev.url && (
                                  <a
                                    href={ev.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-medium text-johar-green-700 underline text-[11px]"
                                  >
                                    View Link ↗
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ESCALATIONS TRACKER */}
          {activeTab === 'escalations' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
                <div>
                  <h3 className="font-bold text-sm text-gray-800">
                    Hierarchical Escalations Management
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Escalations route from Local Body ➔ Block ➔ District ➔ State for swift
                    resolution.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunScan}
                  disabled={isScanning}
                  className="rounded-lg border-2 border-nb-ink bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_#111] hover:bg-nb-yellow"
                >
                  ⚡ Trigger Scan
                </button>
              </div>

              {escalations.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
                  ✓ No escalations recorded within this authority scope.
                </div>
              ) : (
                <div className="space-y-3">
                  {escalations.map((esc) => (
                    <div
                      key={esc._id}
                      className="rounded-xl border-2 border-nb-ink bg-white p-5 shadow-[3px_3px_0_#111]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                esc.status === 'open'
                                  ? 'bg-red-100 text-red-800'
                                  : esc.status === 'acknowledged'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {esc.status}
                            </span>
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                              Trigger: {String(esc.trigger).replace(/_/g, ' ')}
                            </span>
                            {esc.daysOverdue > 0 && (
                              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                {esc.daysOverdue} Days Overdue
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 font-bold text-sm text-nb-ink">{esc.reason}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            Project:{' '}
                            <Link
                              to={`/projects/${esc.project?._id}`}
                              className="font-medium text-johar-green-700 hover:underline"
                            >
                              {esc.project?.title}
                            </Link>
                            {esc.milestone && ` · Milestone: ${esc.milestone.title}`}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          {esc.status === 'open' && (
                            <button
                              type="button"
                              onClick={() => handleEscalationAction(esc._id, 'acknowledged')}
                              className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100"
                            >
                              Acknowledge
                            </button>
                          )}
                          {esc.escalatedTo !== 'state' && esc.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => handleEscalationAction(esc._id, 'advance')}
                              className="rounded border-2 border-nb-ink bg-nb-yellow px-2.5 py-1 text-xs font-bold text-nb-ink shadow-[1px_1px_0_#111] hover:bg-yellow-400"
                            >
                              ⬆ Advance to Higher Authority
                            </button>
                          )}
                          {esc.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => handleEscalationAction(esc._id, 'resolved')}
                              className="rounded border border-green-600 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 hover:bg-green-100"
                            >
                              ✓ Mark Resolved
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Escalation routing stepper */}
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-600 border-t border-gray-100 pt-2.5">
                        <span className="font-semibold text-gray-700">Hierarchy Level:</span>
                        <span className="capitalize">{esc.currentLevel}</span>
                        <span>➔</span>
                        <span className="font-bold text-indigo-700 capitalize">
                          Escalated to: {esc.escalatedTo}
                        </span>
                        {esc.resolutionNotes && (
                          <span className="ml-3 italic text-gray-500">
                            Resolution: "{esc.resolutionNotes}"
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SCOPED PROJECTS */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="font-bold text-sm text-gray-800">
                  Projects in Authority Scope ({projects.length})
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Assign administrative responsibility to relevant departments and district / block
                  authorities.
                </p>
              </div>

              {projects.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
                  No projects found for current filter.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border-2 border-nb-ink bg-white shadow-[3px_3px_0_#111]">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-gray-500">
                          Project Title
                        </th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-gray-500">
                          University
                        </th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-gray-500">
                          District / Dept
                        </th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-gray-500">
                          Progress
                        </th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-gray-500">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider text-gray-500">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {projects.map((p) => (
                        <tr key={p._id} className="hover:bg-gray-50/70">
                          <td className="px-4 py-3 font-semibold text-nb-ink">
                            <Link to={`/projects/${p._id}`} className="hover:underline">
                              {p.title}
                            </Link>
                            {p.atRiskInfo?.isAtRisk && (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                At Risk
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{p.university?.name || 'TBD'}</td>
                          <td className="px-4 py-3 text-gray-600">
                            <div>{p.governmentOwnership?.district || p.deploymentDetails?.district || 'Jharkhand'}</div>
                            <div className="text-[11px] text-gray-400">
                              {p.governmentOwnership?.department || 'Dept Unassigned'}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-johar-green-700">
                            {p.currentProgress}%
                          </td>
                          <td className="px-4 py-3 capitalize text-gray-600">
                            {String(p.status).replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openAssignModal(p)}
                              className="rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-nb-yellow"
                            >
                              Assign Authority
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="font-bold text-sm text-gray-800">Governance Audit Trail</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Immutable chronological log of assignments, milestone submissions, evidence
                  uploads, and verification sign-offs.
                </p>
              </div>

              {auditLogs.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
                  No audit logs recorded yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border-2 border-nb-ink bg-white shadow-[3px_3px_0_#111]">
                  <ul className="divide-y divide-gray-100 text-xs">
                    {auditLogs.map((log) => (
                      <li key={log._id} className="p-4 hover:bg-gray-50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-nb-ink uppercase">
                              {log.actorName || 'Official'} ({log.actorRole})
                            </span>
                            <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
                              {String(log.action).replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-400">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-gray-700">
                          <strong className="text-gray-900">{log.entityType}:</strong>{' '}
                          {log.entityTitle || log.entityId}
                        </p>
                        {log.notes && (
                          <p className="mt-1 italic text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                            "{log.notes}"
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL: VERIFY / REQUEST CHANGES / REJECT */}
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
                Official Authority Notes & Instructions
              </label>
              <textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                rows={4}
                placeholder="Enter verification notes, required revisions, or feedback..."
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
                onClick={submitVerificationAction}
                className="rounded-lg border-2 border-nb-ink bg-nb-yellow px-4 py-2 text-xs font-black uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111] hover:bg-yellow-400"
              >
                Confirm Sign-Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN AUTHORITY */}
      {assignModalProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border-2 border-nb-ink bg-white p-6 shadow-[6px_6px_0_#111]">
            <h3 className="text-lg font-black text-nb-ink">Assign Government Responsibility</h3>
            <p className="mt-1 text-xs text-gray-600">Project: {assignModalProject.title}</p>

            <form onSubmit={submitAuthorityAssignment} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700">Department</label>
                <select
                  value={assignForm.department}
                  onChange={(e) => setAssignForm({ ...assignForm, department: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                >
                  <option value="">Select Department</option>
                  {(hierarchyData?.departments || []).map((dep) => (
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
                    value={assignForm.authorityLevel}
                    onChange={(e) =>
                      setAssignForm({ ...assignForm, authorityLevel: e.target.value })
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
                    value={assignForm.district}
                    onChange={(e) => setAssignForm({ ...assignForm, district: e.target.value })}
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
                    value={assignForm.block}
                    onChange={(e) => setAssignForm({ ...assignForm, block: e.target.value })}
                    placeholder="e.g. Kanke, Mandar"
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700">Local Body (optional)</label>
                  <input
                    type="text"
                    value={assignForm.localBody}
                    onChange={(e) => setAssignForm({ ...assignForm, localBody: e.target.value })}
                    placeholder="e.g. Gram Panchayat, Municipal Corp"
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700">Administrative Notes</label>
                <textarea
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Official instructions or responsibility notes..."
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalProject(null)}
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

      {/* MODAL: MANUAL ESCALATION */}
      {escalateModalProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border-2 border-nb-ink bg-white p-6 shadow-[6px_6px_0_#111]">
            <h3 className="text-lg font-black text-nb-ink">🚨 Escalate Project to Higher Authority</h3>
            <p className="mt-1 text-xs text-gray-600">Project: {escalateModalProject.title}</p>

            <form onSubmit={submitManualEscalation} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700">Target Authority Level</label>
                <select
                  value={escalateLevel}
                  onChange={(e) => setEscalateLevel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                >
                  <option value="district">District Administration</option>
                  <option value="state">State Level Directorate / Ministry</option>
                  <option value="department">Department Head</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700">Reason for Escalation *</label>
                <textarea
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  rows={4}
                  required
                  placeholder="Detail the blocker, schedule delay, or assistance needed from higher authority..."
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEscalateModalProject(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg border-2 border-nb-ink bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-[2px_2px_0_#111] hover:bg-red-700"
                >
                  Submit Escalation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
