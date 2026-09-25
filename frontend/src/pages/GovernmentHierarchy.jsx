import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  getGovernmentHierarchy,
  getGovernmentProjects,
  getGovernmentMilestones,
  getGovernmentEscalations,
  updateGovernmentEscalation,
  getGovernmentAtRisk,
  getGovernmentAudit,
  getChallengeAuthorityInfo,
} from '../services/governmentService.js';
import {
  verifyMilestone,
  requestMilestoneChanges,
  rejectMilestone,
  getMilestoneEvidence,
} from '../services/milestoneService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { DISTRICTS, CATEGORIES } from '../utils/constants.js';

const selectClass =
  'rounded-lg border-2 border-nb-ink bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-[2px_2px_0_#111] focus:outline-none';

const STATUS_BADGES = {
  proposed: 'bg-amber-100 text-amber-900 border-amber-300',
  approved: 'bg-blue-100 text-blue-900 border-blue-300',
  in_progress: 'bg-cyan-100 text-cyan-900 border-cyan-300',
  under_review: 'bg-purple-100 text-purple-900 border-purple-300',
  completed: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  delayed: 'bg-red-100 text-red-900 border-red-300',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-300',
};

const EXECUTION_BADGES = {
  pending: 'bg-gray-100 text-gray-700 border-gray-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  delayed: 'bg-red-100 text-red-800 border-red-300',
  blocked: 'bg-amber-100 text-amber-800 border-amber-300',
};

const VERIFICATION_BADGES = {
  not_submitted: 'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-100 text-amber-900 border-amber-300 font-bold animate-pulse',
  under_review: 'bg-purple-100 text-purple-800 border-purple-300',
  verified: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
  changes_requested: 'bg-orange-100 text-orange-900 border-orange-300',
  rejected: 'bg-red-100 text-red-800 border-red-300 font-bold',
};

export default function GovernmentHierarchy() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active view tab: 'tree' | 'escalations' | 'at_risk' | 'verification' | 'officers' | 'departments'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistrict, setFilterDistrict] = useState(searchParams.get('district') || '');

  // Core Hierarchy & Summary Data
  const [hierarchyData, setHierarchyData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Expandable Tree State
  const [expandedDistricts, setExpandedDistricts] = useState({});
  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [expandedLocalBodies, setExpandedLocalBodies] = useState({});

  // Selected entities for detailed view / inspection
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectMilestones, setProjectMilestones] = useState([]);
  const [projectAuditLogs, setProjectAuditLogs] = useState([]);
  const [isLoadingProjectExtra, setIsLoadingProjectExtra] = useState(false);

  // Tab-specific datasets (lazily or concurrently loaded)
  const [escalations, setEscalations] = useState([]);
  const [escalationFilter, setEscalationFilter] = useState('all'); // 'all' | 'open' | 'acknowledged' | 'resolved'
  const [atRiskProjects, setAtRiskProjects] = useState([]);
  const [pendingMilestones, setPendingMilestones] = useState([]);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Milestone Verification Modal
  const [verifyModal, setVerifyModal] = useState({
    isOpen: false,
    milestone: null,
    action: 'verify', // 'verify' | 'request_changes' | 'reject'
    notes: '',
    isSubmitting: false,
  });

  // Evidence Viewer Modal
  const [evidenceModal, setEvidenceModal] = useState({
    isOpen: false,
    milestoneTitle: '',
    evidenceList: [],
    isLoading: false,
  });

  useEffect(() => {
    loadHierarchy();
  }, []);

  useEffect(() => {
    if (activeTab === 'escalations') {
      loadEscalations();
    } else if (activeTab === 'at_risk') {
      loadAtRisk();
    } else if (activeTab === 'verification') {
      loadPendingVerification();
    }
  }, [activeTab]);

  function loadHierarchy() {
    setIsLoading(true);
    setError('');
    getGovernmentHierarchy()
      .then((data) => {
        setHierarchyData(data);
        // Default expand districts that have projects
        if (data?.hierarchyTree?.districts) {
          const initExp = {};
          data.hierarchyTree.districts.forEach((d) => {
            if (d.projects?.length > 0) initExp[d.name] = true;
          });
          setExpandedDistricts(initExp);
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load government hierarchy.');
      })
      .finally(() => setIsLoading(false));
  }

  function loadEscalations() {
    getGovernmentEscalations()
      .then((res) => setEscalations(res.escalations || []))
      .catch(() => {});
  }

  function loadAtRisk() {
    getGovernmentAtRisk()
      .then((res) => setAtRiskProjects(res.atRiskProjects || []))
      .catch(() => {});
  }

  function loadPendingVerification() {
    getGovernmentMilestones({ verificationStatus: 'submitted' })
      .then((res) => setPendingMilestones(res.milestones || []))
      .catch(() => {});
  }

  // When a project is selected in the tree or other views, load its extra info
  function handleSelectProject(proj) {
    setSelectedProject(proj);
    setIsLoadingProjectExtra(true);
    setProjectMilestones(proj.milestones || []);

    // Load audit trail for project
    getGovernmentAudit({ entityType: 'Project', entityId: proj._id })
      .then((res) => setProjectAuditLogs(res.logs || []))
      .catch(() => setProjectAuditLogs([]))
      .finally(() => setIsLoadingProjectExtra(false));
  }

  function toggleDistrict(dName) {
    setExpandedDistricts((prev) => ({ ...prev, [dName]: !prev[dName] }));
  }

  function toggleBlock(key) {
    setExpandedBlocks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleLocalBody(key) {
    setExpandedLocalBodies((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function expandAll() {
    if (!hierarchyData?.hierarchyTree?.districts) return;
    const expD = {};
    const expB = {};
    const expL = {};
    hierarchyData.hierarchyTree.districts.forEach((d) => {
      expD[d.name] = true;
      d.blocks?.forEach((b) => {
        const bKey = `${d.name}_${b.name}`;
        expB[bKey] = true;
        b.localBodies?.forEach((lb) => {
          expL[`${bKey}_${lb.name}`] = true;
        });
      });
    });
    setExpandedDistricts(expD);
    setExpandedBlocks(expB);
    setExpandedLocalBodies(expL);
  }

  function collapseAll() {
    setExpandedDistricts({});
    setExpandedBlocks({});
    setExpandedLocalBodies({});
  }

  // Handle Milestone Verification Actions (Verify / Request Changes / Reject)
  async function submitMilestoneAction(e) {
    e.preventDefault();
    if (!verifyModal.milestone) return;

    setVerifyModal((prev) => ({ ...prev, isSubmitting: true }));
    setActionError('');
    setActionMessage('');

    try {
      const mId = verifyModal.milestone._id;
      if (verifyModal.action === 'verify') {
        await verifyMilestone(mId, verifyModal.notes);
        setActionMessage(`Milestone "${verifyModal.milestone.title}" has been successfully verified.`);
      } else if (verifyModal.action === 'request_changes') {
        await requestMilestoneChanges(mId, verifyModal.notes);
        setActionMessage(`Revisions requested for milestone "${verifyModal.milestone.title}".`);
      } else if (verifyModal.action === 'reject') {
        await rejectMilestone(mId, verifyModal.notes);
        setActionMessage(`Milestone "${verifyModal.milestone.title}" has been rejected.`);
      }

      setVerifyModal({ isOpen: false, milestone: null, action: 'verify', notes: '', isSubmitting: false });
      // Refresh data
      loadHierarchy();
      if (activeTab === 'verification') loadPendingVerification();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Verification action failed.');
      setVerifyModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  }

  // View Evidence
  function handleOpenEvidence(milestone) {
    setEvidenceModal({
      isOpen: true,
      milestoneTitle: milestone.title,
      evidenceList: milestone.evidence || [],
      isLoading: true,
    });

    getMilestoneEvidence(milestone._id)
      .then((res) => {
        setEvidenceModal((prev) => ({
          ...prev,
          evidenceList: res.evidence || milestone.evidence || [],
          isLoading: false,
        }));
      })
      .catch(() => {
        setEvidenceModal((prev) => ({ ...prev, isLoading: false }));
      });
  }

  // Handle Escalation Update (Acknowledge, Resolve, Advance)
  async function handleEscalationUpdate(escalationId, action, notes) {
    try {
      await updateGovernmentEscalation(escalationId, { action, notes });
      setActionMessage(`Escalation updated: ${action}`);
      loadEscalations();
      loadHierarchy();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update escalation.');
    }
  }

  const summary = hierarchyData?.summaryStats || {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    delayedProjects: 0,
    atRiskProjects: 0,
    openEscalations: 0,
    pendingVerification: 0,
  };

  const userScope = hierarchyData?.userScope || {};
  const hierarchyTree = hierarchyData?.hierarchyTree || { state: 'Jharkhand', districts: [] };
  const officers = hierarchyData?.officers || [];
  const departments = hierarchyData?.departments || [];

  const visibleDistricts = hierarchyTree.districts.filter((d) => {
    if (!filterDistrict) return true;
    return d.name.toLowerCase() === filterDistrict.toLowerCase();
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      {/* Top Banner & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-nb-ink bg-nb-yellow text-xl font-black shadow-[3px_3px_0_#111]">
              🏛️
            </span>
            <h1 className="text-2xl font-black uppercase tracking-tight text-nb-ink sm:text-3xl">
              Government Hierarchy & Work Oversight
            </h1>
          </div>
          <p className="mt-1 text-xs text-gray-600 sm:text-sm">
            State → District → Block → Local Body → Projects → Milestones · Real-Time Administrative Accountability
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-1.5 rounded-lg border-2 border-nb-ink bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111] transition-all hover:bg-gray-50"
          >
            📋 Work & Risk Dashboard
          </Link>
          <span className="flex items-center gap-1.5 rounded-lg border-2 border-nb-ink bg-nb-yellow px-3 py-2 text-xs font-black uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111]">
            🏢 Government Hierarchy
          </span>
        </div>
      </div>

      {/* Scope Banner (Requirement 3) */}
      <div className="rounded-xl border-2 border-nb-ink bg-nb-yellow/15 p-4 shadow-[3px_3px_0_#111]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-nb-ink bg-nb-yellow text-sm font-bold shadow-[2px_2px_0_#111]">
              ⚖️
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                Official Jurisdiction Scope
              </p>
              <p className="text-sm font-black text-gray-900">
                {user?.role === 'admin'
                  ? 'Complete State Jurisdiction (Administrator Privilege)'
                  : userScope.level === 'state'
                    ? 'State Secretariat Level (All Jharkhand Districts)'
                    : userScope.level === 'district'
                      ? `District Authority Level: ${userScope.district || user?.district} District`
                      : userScope.level === 'block'
                        ? `Block Authority Level: ${userScope.block || user?.block} (${userScope.district || user?.district})`
                        : 'Local Administrative Tier'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-gray-800 border-2 border-nb-ink shadow-[1px_1px_0_#111]">
              Logged in: {user?.name} ({user?.role?.toUpperCase()})
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {actionMessage && (
        <div className="rounded-xl border-2 border-green-600 bg-green-50 p-3.5 text-xs font-bold text-green-800 shadow-[2px_2px_0_#111] flex items-center justify-between">
          <span>✓ {actionMessage}</span>
          <button type="button" onClick={() => setActionMessage('')} className="font-bold ml-2">✕</button>
        </div>
      )}
      {actionError && (
        <div className="rounded-xl border-2 border-red-500 bg-red-50 p-3.5 text-xs font-bold text-red-800 shadow-[2px_2px_0_#111] flex items-center justify-between">
          <span>⚠️ {actionError}</span>
          <button type="button" onClick={() => setActionError('')} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* 7 Summary Cards (Requirement 4) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div className="rounded-xl border-2 border-nb-ink bg-white p-3.5 shadow-[2px_2px_0_#111]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Total Projects</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{summary.totalProjects}</p>
          <span className="text-[10px] text-gray-400">In jurisdiction</span>
        </div>

        <div className="rounded-xl border-2 border-nb-ink bg-blue-50/60 p-3.5 shadow-[2px_2px_0_#111]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Active</p>
          <p className="mt-1 text-2xl font-black text-blue-900">{summary.activeProjects}</p>
          <span className="text-[10px] text-blue-700 font-medium">In execution</span>
        </div>

        <div className="rounded-xl border-2 border-nb-ink bg-emerald-50/60 p-3.5 shadow-[2px_2px_0_#111]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Completed</p>
          <p className="mt-1 text-2xl font-black text-emerald-900">{summary.completedProjects}</p>
          <span className="text-[10px] text-emerald-700 font-medium">Delivered</span>
        </div>

        <div className="rounded-xl border-2 border-nb-ink bg-amber-50/60 p-3.5 shadow-[2px_2px_0_#111]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Delayed</p>
          <p className="mt-1 text-2xl font-black text-amber-900">{summary.delayedProjects}</p>
          <span className="text-[10px] text-amber-700 font-medium">Schedule breach</span>
        </div>

        <div className="rounded-xl border-2 border-nb-ink bg-rose-50/60 p-3.5 shadow-[2px_2px_0_#111]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">At-Risk</p>
          <p className="mt-1 text-2xl font-black text-rose-900">{summary.atRiskProjects}</p>
          <span className="text-[10px] text-rose-700 font-medium">Intervention req.</span>
        </div>

        <div className="rounded-xl border-2 border-nb-ink bg-red-50 p-3.5 shadow-[2px_2px_0_#111]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-800">Open Escalations</p>
          <p className="mt-1 text-2xl font-black text-red-900">{summary.openEscalations}</p>
          <span className="text-[10px] text-red-700 font-medium">Unresolved</span>
        </div>

        <div className="rounded-xl border-2 border-nb-ink bg-purple-50 p-3.5 shadow-[2px_2px_0_#111]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-800">Pending Review</p>
          <p className="mt-1 text-2xl font-black text-purple-900">{summary.pendingVerification}</p>
          <span className="text-[10px] text-purple-700 font-medium">Awaiting sign-off</span>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex border-2 border-nb-ink bg-white p-1 shadow-[3px_3px_0_#111] overflow-x-auto">
        {[
          { id: 'tree', label: '🌳 Expandable Hierarchy Tree', badge: summary.totalProjects },
          { id: 'escalations', label: '🚨 Escalations', badge: summary.openEscalations },
          { id: 'at_risk', label: '⚠️ At-Risk Work', badge: summary.atRiskProjects },
          { id: 'verification', label: '✅ Verification Queue', badge: summary.pendingVerification },
          { id: 'officers', label: '👥 Officers Roster', badge: hierarchyData?.breakdown?.totalOfficers || officers.length },
          { id: 'departments', label: '🏢 Departments (14)', badge: departments.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-2 border-nb-ink bg-nb-yellow text-nb-ink shadow-[2px_2px_0_#111]'
                : 'text-gray-600 hover:text-nb-ink'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge > 0 && (
              <span className="rounded-full bg-nb-ink px-1.5 py-0.2 text-[10px] font-bold text-white">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: EXPANDABLE HIERARCHY TREE (Requirements 2, 5, 6, 7) */}
      {activeTab === 'tree' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-nb-ink bg-white p-3.5 shadow-[2px_2px_0_#111]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase text-gray-700">Filter District:</span>
              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                className={selectClass}
              >
                <option value="">All Scoped Districts ({visibleDistricts.length})</option>
                {hierarchyTree.districts.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.projects.length} projects)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={expandAll}
                className="rounded-lg border-2 border-nb-ink bg-gray-50 px-2.5 py-1 text-xs font-bold text-nb-ink shadow-[1px_1px_0_#111] hover:bg-gray-100"
              >
                [+] Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded-lg border-2 border-nb-ink bg-gray-50 px-2.5 py-1 text-xs font-bold text-nb-ink shadow-[1px_1px_0_#111] hover:bg-gray-100"
              >
                [-] Collapse All
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-xl border-2 border-nb-ink bg-white p-12 text-center shadow-[3px_3px_0_#111]">
              <p className="text-sm font-semibold text-gray-500">Loading government hierarchy tree...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 p-6 text-center text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Root Node: State */}
              <div className="rounded-xl border-2 border-nb-ink bg-nb-yellow/40 p-4 shadow-[3px_3px_0_#111]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏛️</span>
                    <div>
                      <h2 className="text-base font-black uppercase text-nb-ink">
                        State of {hierarchyTree.state}
                      </h2>
                      <p className="text-[11px] text-gray-600">
                        Apex Governance Tier · State Secretariat · {visibleDistricts.length} District Jurisdictions
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border-2 border-nb-ink bg-white px-2.5 py-0.5 text-xs font-black shadow-[1px_1px_0_#111]">
                    {summary.totalProjects} Total Scoped Projects
                  </span>
                </div>
              </div>

              {/* Districts List (Expandable) */}
              <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-dashed border-nb-ink/40">
                {visibleDistricts.map((district) => {
                  const isExpDistrict = Boolean(expandedDistricts[district.name]);

                  return (
                    <div
                      key={district.name}
                      className="rounded-xl border-2 border-nb-ink bg-white shadow-[3px_3px_0_#111] overflow-hidden"
                    >
                      {/* District Header (Requirement 5) */}
                      <div
                        onClick={() => toggleDistrict(district.name)}
                        className="cursor-pointer bg-gray-50 p-3.5 hover:bg-gray-100 flex flex-wrap items-center justify-between gap-3 border-b-2 border-nb-ink transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-gray-600 w-4">
                            {isExpDistrict ? '▼' : '►'}
                          </span>
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-xs font-black border border-blue-300">
                            🏢
                          </span>
                          <div>
                            <h3 className="text-sm font-black text-gray-900 uppercase">
                              {district.name} District
                            </h3>
                            <span className="text-[10px] text-gray-500">
                              {district.blocks.length} block(s) recorded
                            </span>
                          </div>
                        </div>

                        {/* District Metrics Breakdown */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded bg-gray-200 px-2 py-0.5 font-bold text-gray-800">
                            Total: {district.stats.total}
                          </span>
                          <span className="rounded bg-blue-100 px-2 py-0.5 font-bold text-blue-800">
                            Active: {district.stats.active}
                          </span>
                          <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                            Completed: {district.stats.completed}
                          </span>
                          {district.stats.delayed > 0 && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
                              Delayed: {district.stats.delayed}
                            </span>
                          )}
                          {district.stats.atRisk > 0 && (
                            <span className="rounded bg-red-100 px-2 py-0.5 font-bold text-red-800">
                              At Risk: {district.stats.atRisk}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* District Content: Blocks */}
                      {isExpDistrict && (
                        <div className="p-3 sm:p-4 space-y-3 bg-white">
                          {district.blocks.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No blocks recorded for this district.</p>
                          ) : (
                            district.blocks.map((block) => {
                              const bKey = `${district.name}_${block.name}`;
                              const isExpBlock = Boolean(expandedBlocks[bKey]);

                              return (
                                <div
                                  key={bKey}
                                  className="rounded-lg border-2 border-nb-ink/70 bg-gray-50/50 overflow-hidden"
                                >
                                  {/* Block Header */}
                                  <div
                                    onClick={() => toggleBlock(bKey)}
                                    className="cursor-pointer p-2.5 bg-gray-100/70 hover:bg-gray-200/60 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold text-gray-500 w-3">
                                        {isExpBlock ? '▼' : '►'}
                                      </span>
                                      <span className="font-bold text-gray-800">
                                        🏷️ {block.name}
                                      </span>
                                      <span className="text-[10px] text-gray-500">
                                        ({block.projects.length} project{block.projects.length !== 1 ? 's' : ''})
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      <span className="rounded bg-white px-1.5 py-0.2 border border-gray-300 font-semibold">
                                        Active: {block.stats.active}
                                      </span>
                                      <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-emerald-800 border border-emerald-200 font-semibold">
                                        Completed: {block.stats.completed}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Block Content: Projects List (Requirement 6) */}
                                  {isExpBlock && (
                                    <div className="p-3 space-y-2 bg-white">
                                      {block.projects.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic py-1">
                                          No active projects recorded in this block yet.
                                        </p>
                                      ) : (
                                        block.projects.map((proj) => (
                                          <div
                                            key={proj._id}
                                            onClick={() => handleSelectProject(proj)}
                                            className={`rounded-lg border-2 p-3 text-xs cursor-pointer transition-all hover:border-nb-ink ${
                                              selectedProject?._id === proj._id
                                                ? 'border-nb-ink bg-nb-yellow/15 shadow-[2px_2px_0_#111]'
                                                : 'border-gray-200 bg-white hover:bg-gray-50'
                                            }`}
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <span className="font-bold text-gray-900 leading-snug">
                                                {proj.title}
                                              </span>
                                              <div className="flex items-center gap-1.5">
                                                <span
                                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${
                                                    STATUS_BADGES[proj.status] || 'bg-gray-100 text-gray-700'
                                                  }`}
                                                >
                                                  {proj.status.replace(/_/g, ' ')}
                                                </span>
                                                {proj.atRiskInfo?.isAtRisk && (
                                                  <span className="rounded bg-red-100 px-1.5 py-0.2 text-[10px] font-bold text-red-800 border border-red-300">
                                                    ⚠️ At Risk
                                                  </span>
                                                )}
                                                {proj.openEscalationsCount > 0 && (
                                                  <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-black text-rose-900 border border-rose-300">
                                                    🚨 Escalated ({proj.openEscalationsCount})
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
                                              <span>
                                                Progress: <strong>{proj.currentProgress || 0}%</strong>
                                              </span>
                                              {proj.university?.name && (
                                                <span>
                                                  Uni: <strong>{proj.university.name}</strong>
                                                </span>
                                              )}
                                              <span>
                                                Milestones: <strong>{proj.milestones?.length || 0}</strong>
                                              </span>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SELECTED PROJECT DETAILS MODAL / INLINE DRAWER (Requirement 6, 7, 10, 11, 12) */}
      {selectedProject && (
        <div className="rounded-xl border-2 border-nb-ink bg-white p-6 shadow-[4px_4px_0_#111] space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-gray-100 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-nb-yellow px-2 py-0.5 text-[10px] font-black uppercase border border-nb-ink">
                  Project Inspection
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase border ${
                    STATUS_BADGES[selectedProject.status] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {selectedProject.status.replace(/_/g, ' ')}
                </span>
                {selectedProject.atRiskInfo?.isAtRisk && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-black text-red-800 border border-red-300">
                    ⚠️ At Risk ({selectedProject.atRiskInfo.severity})
                  </span>
                )}
              </div>

              <h2 className="mt-2 text-xl font-black text-gray-900 sm:text-2xl">
                {selectedProject.title}
              </h2>

              {selectedProject.challenge && (
                <p className="mt-1 text-xs text-gray-600">
                  <strong className="text-gray-800">Linked Challenge: </strong>
                  <Link
                    to={`/challenges/${selectedProject.challenge._id || selectedProject.challenge}`}
                    className="text-johar-green-700 hover:underline font-semibold"
                  >
                    {selectedProject.challenge.title || 'View Challenge Detail →'}
                  </Link>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/projects/${selectedProject._id}`}
                className="rounded-lg border-2 border-nb-ink bg-nb-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111] hover:bg-yellow-400"
              >
                Full Project Page ➔
              </Link>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="rounded-lg border-2 border-nb-ink bg-gray-100 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Project Details Grid (Requirement 6) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-gray-50 p-4 text-xs">
            <div>
              <span className="text-gray-500 font-semibold block">University Partner</span>
              <span className="font-bold text-gray-900">
                {selectedProject.university?.name || 'Assigned Institution'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 font-semibold block">Government Authority</span>
              <span className="font-bold text-gray-900">
                {selectedProject.governmentOwnership?.department || 'District Administration'}
              </span>
              <span className="block text-[10px] text-gray-500 capitalize">
                Level: {selectedProject.governmentOwnership?.authorityLevel || 'District'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 font-semibold block">Location</span>
              <span className="font-bold text-gray-900">
                {selectedProject.resolvedDistrict} · {selectedProject.resolvedBlock}
              </span>
            </div>
            <div>
              <span className="text-gray-500 font-semibold block">Expected Completion</span>
              <span className="font-bold text-gray-900">
                {selectedProject.expectedEndDate
                  ? new Date(selectedProject.expectedEndDate).toLocaleDateString()
                  : 'Open-ended'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
              <span>Overall Implementation Progress</span>
              <span>{selectedProject.currentProgress || 0}% Complete</span>
            </div>
            <div className="h-3 w-full rounded-full border border-gray-300 bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${selectedProject.currentProgress || 0}%` }}
              />
            </div>
          </div>

          {/* MILESTONE VIEW & VERIFICATION CONTROLS (Requirement 7 & 10) */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-800">
                Milestones & Verification Workflow ({projectMilestones.length})
              </h3>
              <span className="text-xs text-gray-500">
                Authorized government officers can verify or request revisions
              </span>
            </div>

            {projectMilestones.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">
                No milestones recorded for this project yet.
              </p>
            ) : (
              <div className="space-y-3">
                {projectMilestones.map((m, idx) => (
                  <div
                    key={m._id || idx}
                    className="rounded-lg border-2 border-nb-ink bg-white p-4 text-xs shadow-[2px_2px_0_#111] space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-nb-yellow text-[10px] font-black border border-nb-ink">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-gray-900 text-sm">{m.title}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${
                            EXECUTION_BADGES[m.executionStatus || m.status] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          Execution: {m.executionStatus || m.status || 'pending'}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${
                            VERIFICATION_BADGES[m.verificationStatus] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          Verification: {m.verificationStatus || 'not_submitted'}
                        </span>
                      </div>
                    </div>

                    {m.description && <p className="text-gray-700">{m.description}</p>}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                      <span>
                        Progress: <strong>{m.progress || 0}%</strong> · Target Due:{' '}
                        <strong>{m.dueDate ? new Date(m.dueDate).toLocaleDateString() : 'Unscheduled'}</strong>
                      </span>

                      {/* Evidence Button (Requirement 11) */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEvidence(m)}
                          className="rounded border border-gray-300 bg-gray-50 px-2 py-1 font-bold text-gray-700 hover:bg-gray-100"
                        >
                          📷 Evidence ({m.evidence?.length || 0})
                        </button>

                        {/* Government Verification Controls (Requirement 10) */}
                        <button
                          type="button"
                          onClick={() =>
                            setVerifyModal({
                              isOpen: true,
                              milestone: m,
                              action: 'verify',
                              notes: '',
                              isSubmitting: false,
                            })
                          }
                          className="rounded bg-emerald-700 px-2.5 py-1 font-bold text-white hover:bg-emerald-800"
                        >
                          ✓ Verify
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setVerifyModal({
                              isOpen: true,
                              milestone: m,
                              action: 'request_changes',
                              notes: '',
                              isSubmitting: false,
                            })
                          }
                          className="rounded border border-amber-300 bg-amber-50 px-2 py-1 font-bold text-amber-800 hover:bg-amber-100"
                        >
                          Request Changes
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setVerifyModal({
                              isOpen: true,
                              milestone: m,
                              action: 'reject',
                              notes: '',
                              isSubmitting: false,
                            })
                          }
                          className="rounded border border-red-300 bg-red-50 px-2 py-1 font-bold text-red-700 hover:bg-red-100"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AUDIT TIMELINE (Requirement 12) */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-800">
              Audit Timeline
            </h3>
            {projectAuditLogs.length > 0 ? (
              <div className="space-y-2">
                {projectAuditLogs.map((log) => (
                  <div
                    key={log._id}
                    className="flex items-start gap-2.5 rounded-lg bg-gray-50 p-2.5 text-xs border border-gray-200"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-800 shrink-0">
                      ✓
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 capitalize">
                          {log.action?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {log.notes && <p className="mt-0.5 text-gray-600">{log.notes}</p>}
                      <p className="mt-0.5 text-[10px] text-gray-500">
                        Actor: {log.actor?.name || 'System / Government Authority'} ({log.actor?.role})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Project assigned and managed under standard protocol. Milestone audit records are recorded upon verification.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ESCALATIONS SECTION (Requirement 8) */}
      {activeTab === 'escalations' && (
        <div className="rounded-xl border-2 border-nb-ink bg-white p-6 shadow-[4px_4px_0_#111] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-gray-100 pb-3">
            <div>
              <h2 className="text-lg font-black uppercase text-nb-ink">Administrative Escalations</h2>
              <p className="text-xs text-gray-500">Multi-tier escalation triggers, SLA delays, and high-level interventions</p>
            </div>

            <div className="flex items-center gap-1.5">
              {['all', 'open', 'acknowledged', 'resolved'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setEscalationFilter(st)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition-all ${
                    escalationFilter === st
                      ? 'border-2 border-nb-ink bg-nb-yellow text-nb-ink shadow-[1px_1px_0_#111]'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {escalations.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              No escalations recorded in this scope.
            </div>
          ) : (
            <div className="space-y-3">
              {escalations
                .filter((esc) => (escalationFilter === 'all' ? true : esc.status === escalationFilter))
                .map((esc) => (
                  <div
                    key={esc._id}
                    className="rounded-lg border-2 border-nb-ink bg-white p-4 text-xs shadow-[2px_2px_0_#111] space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                          esc.status === 'open' ? 'bg-red-500 animate-pulse' : esc.status === 'resolved' ? 'bg-green-500' : 'bg-amber-500'
                        }`} />
                        <span className="font-bold text-gray-900 text-sm">
                          {esc.project?.title || esc.challenge?.title || 'Escalation Case'}
                        </span>
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-900 uppercase">
                          Target: {esc.escalatedTo || esc.currentLevel} Level
                        </span>
                        <span className={`rounded px-1.5 py-0.2 text-[10px] font-black uppercase ${
                          esc.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {esc.severity}
                        </span>
                      </div>

                      <span className="text-[11px] text-gray-400">
                        {new Date(esc.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-gray-800 font-medium">{esc.reason}</p>

                    {esc.actionRequired && (
                      <p className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                        <strong className="text-gray-800">Action Required: </strong>
                        {esc.actionRequired}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                      <span>
                        Status: <strong className="capitalize text-gray-800">{esc.status}</strong>
                        {esc.milestone?.title ? ` · Milestone: ${esc.milestone.title}` : ''}
                      </span>

                      {/* Escalation Action Controls */}
                      <div className="flex items-center gap-1.5">
                        {esc.status === 'open' && (
                          <button
                            type="button"
                            onClick={() => handleEscalationUpdate(esc._id, 'acknowledged', 'Acknowledged by officer')}
                            className="rounded border border-amber-300 bg-amber-50 px-2 py-1 font-bold text-amber-800 hover:bg-amber-100"
                          >
                            Acknowledge
                          </button>
                        )}
                        {esc.status !== 'resolved' && (
                          <button
                            type="button"
                            onClick={() => handleEscalationUpdate(esc._id, 'resolved', 'Resolved by authority')}
                            className="rounded bg-emerald-700 px-2.5 py-1 font-bold text-white hover:bg-emerald-800"
                          >
                            Mark Resolved
                          </button>
                        )}
                        {esc.status !== 'resolved' && (
                          <button
                            type="button"
                            onClick={() => handleEscalationUpdate(esc._id, 'advance', 'Advanced to next administrative tier')}
                            className="rounded border border-red-300 bg-red-50 px-2 py-1 font-bold text-red-700 hover:bg-red-100"
                          >
                            Advance Tier ➔
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AT RISK SECTION (Requirement 9) */}
      {activeTab === 'at_risk' && (
        <div className="rounded-xl border-2 border-nb-ink bg-white p-6 shadow-[4px_4px_0_#111] space-y-4">
          <div className="border-b-2 border-gray-100 pb-3">
            <h2 className="text-lg font-black uppercase text-nb-ink">At-Risk Projects</h2>
            <p className="text-xs text-gray-500">
              Projects falling behind schedule, missing milestones, or requiring authority intervention
            </p>
          </div>

          {atRiskProjects.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              No projects flagged at risk in this jurisdiction.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {atRiskProjects.map((p) => (
                <div
                  key={p.projectId || p._id}
                  className="rounded-xl border-2 border-nb-ink bg-red-50/30 p-4 text-xs shadow-[3px_3px_0_#111] space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-gray-900 text-sm line-clamp-1">{p.title}</span>
                    <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-800 border border-red-300 uppercase">
                      {p.severity || 'HIGH'} RISK
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-gray-600 mb-1">
                      <span>Actual Progress / Expected</span>
                      <span>
                        {p.actualProgress || 0}% / {p.expectedProgress || 0}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${p.actualProgress || 0}%` }}
                      />
                    </div>
                  </div>

                  {p.riskFactors?.length > 0 && (
                    <ul className="space-y-1 bg-white p-2 rounded border border-red-100 text-[11px] text-red-700">
                      {p.riskFactors.map((rf, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span>•</span> {rf}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-red-100 text-[11px] text-gray-500">
                    <span>Target Due: {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : 'N/A'}</span>
                    <Link
                      to={`/projects/${p.projectId || p._id}`}
                      className="font-bold text-johar-green-700 hover:underline"
                    >
                      Inspect Project ➔
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: VERIFICATION QUEUE (Requirement 10) */}
      {activeTab === 'verification' && (
        <div className="rounded-xl border-2 border-nb-ink bg-white p-6 shadow-[4px_4px_0_#111] space-y-4">
          <div className="border-b-2 border-gray-100 pb-3">
            <h2 className="text-lg font-black uppercase text-nb-ink">Milestones Awaiting Verification</h2>
            <p className="text-xs text-gray-500">
              Submitted work by engineering teams awaiting official sign-off or revision requests
            </p>
          </div>

          {pendingMilestones.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              ✓ No milestones pending verification in your jurisdiction.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingMilestones.map((m) => (
                <div
                  key={m._id}
                  className="rounded-lg border-2 border-nb-ink bg-white p-4 text-xs shadow-[2px_2px_0_#111] space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-gray-900 text-sm">{m.title}</span>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300 uppercase">
                      Submitted for Verification
                    </span>
                  </div>

                  <p className="text-gray-700">{m.description}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-[11px]">
                    <span className="text-gray-500">
                      Project: <strong>{m.project?.title || 'Assigned Project'}</strong> · Progress: {m.progress || 0}%
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEvidence(m)}
                        className="rounded border border-gray-300 bg-gray-50 px-2 py-1 font-bold text-gray-700 hover:bg-gray-100"
                      >
                        📷 Evidence ({m.evidenceCount || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setVerifyModal({
                            isOpen: true,
                            milestone: m,
                            action: 'verify',
                            notes: '',
                            isSubmitting: false,
                          })
                        }
                        className="rounded bg-emerald-700 px-2.5 py-1 font-bold text-white hover:bg-emerald-800"
                      >
                        ✓ Sign Off & Verify
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setVerifyModal({
                            isOpen: true,
                            milestone: m,
                            action: 'request_changes',
                            notes: '',
                            isSubmitting: false,
                          })
                        }
                        className="rounded border border-amber-300 bg-amber-50 px-2 py-1 font-bold text-amber-800 hover:bg-amber-100"
                      >
                        Request Changes
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: OFFICERS ROSTER */}
      {activeTab === 'officers' && (
        <div className="rounded-xl border-2 border-nb-ink bg-white p-6 shadow-[4px_4px_0_#111] space-y-4">
          <div className="border-b-2 border-gray-100 pb-3">
            <h2 className="text-lg font-black uppercase text-nb-ink">Government Officers Directory</h2>
            <p className="text-xs text-gray-500">
              Roster of nodal officers across State Secretariat, Districts, Blocks and Municipalities
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {officers.map((o) => (
              <div
                key={o._id}
                className="rounded-lg border-2 border-nb-ink bg-white p-3.5 text-xs shadow-[2px_2px_0_#111] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-sm">{o.name}</span>
                  <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-bold text-blue-800 border border-blue-200 uppercase">
                    {o.authorityLevel}
                  </span>
                </div>
                <p className="text-gray-600 font-medium">{o.department}</p>
                <p className="text-[11px] text-gray-500">
                  📍 {o.district} {o.block ? `· ${o.block}` : ''}
                </p>
                {o.email && (
                  <p className="text-[11px] text-gray-700">
                    📧 {o.email}
                  </p>
                )}
                {o.phone && (
                  <p className="text-[11px] text-gray-700">
                    📞 {o.phone}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: DEPARTMENTS */}
      {activeTab === 'departments' && (
        <div className="rounded-xl border-2 border-nb-ink bg-white p-6 shadow-[4px_4px_0_#111] space-y-4">
          <div className="border-b-2 border-gray-100 pb-3">
            <h2 className="text-lg font-black uppercase text-nb-ink">Jharkhand Departments (14)</h2>
            <p className="text-xs text-gray-500">Official ministries and mapped challenge domain responsibilities</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept, idx) => (
              <div
                key={idx}
                className="rounded-lg border-2 border-nb-ink bg-white p-3.5 text-xs shadow-[2px_2px_0_#111]"
              >
                <span className="text-[10px] font-bold uppercase text-gray-400">Department #{idx + 1}</span>
                <h4 className="mt-1 font-bold text-gray-900 text-sm">{dept}</h4>
                <p className="mt-1 text-[11px] text-gray-500">Government of Jharkhand</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MILESTONE VERIFY / REJECT MODAL (Requirement 10) */}
      {verifyModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border-2 border-nb-ink bg-white p-6 shadow-[4px_4px_0_#111]">
            <h3 className="text-base font-black uppercase text-gray-900">
              {verifyModal.action === 'verify'
                ? 'Sign Off & Verify Milestone'
                : verifyModal.action === 'request_changes'
                  ? 'Request Milestone Revisions'
                  : 'Reject Milestone'}
            </h3>
            <p className="mt-1 text-xs text-gray-600">
              Milestone: <strong>{verifyModal.milestone?.title}</strong>
            </p>

            <form onSubmit={submitMilestoneAction} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {verifyModal.action === 'verify'
                    ? 'Verification Remarks / Approval Notes'
                    : verifyModal.action === 'request_changes'
                      ? 'Detailed Revisions Required *'
                      : 'Rejection Reason *'}
                </label>
                <textarea
                  required={verifyModal.action !== 'verify'}
                  rows={3}
                  value={verifyModal.notes}
                  onChange={(e) => setVerifyModal({ ...verifyModal, notes: e.target.value })}
                  placeholder="Enter official remarks..."
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-nb-ink focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setVerifyModal({ isOpen: false, milestone: null, action: 'verify', notes: '', isSubmitting: false })}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyModal.isSubmitting}
                  className={`rounded-lg px-4 py-1.5 font-bold text-white shadow-sm ${
                    verifyModal.action === 'verify'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : verifyModal.action === 'request_changes'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {verifyModal.isSubmitting ? 'Saving...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVIDENCE VIEWER MODAL (Requirement 11) */}
      {evidenceModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border-2 border-nb-ink bg-white p-6 shadow-[4px_4px_0_#111] space-y-4">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900">
                  📷 Milestone Evidence Records
                </h3>
                <p className="text-xs text-gray-500">{evidenceModal.milestoneTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setEvidenceModal({ isOpen: false, milestoneTitle: '', evidenceList: [], isLoading: false })}
                className="text-gray-400 hover:text-gray-700 font-bold"
              >
                ✕
              </button>
            </div>

            {evidenceModal.isLoading ? (
              <p className="py-6 text-center text-xs text-gray-500">Loading evidence...</p>
            ) : evidenceModal.evidenceList.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400 italic">No evidence records uploaded yet.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 text-xs">
                {evidenceModal.evidenceList.map((ev, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 uppercase">
                        {ev.type || 'Document'} · {ev.title || 'Attachment'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {ev.uploadedAt ? new Date(ev.uploadedAt).toLocaleDateString() : 'Recorded'}
                      </span>
                    </div>
                    {ev.description && <p className="text-gray-600">{ev.description}</p>}
                    {ev.url && (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs font-bold text-johar-green-700 hover:underline pt-1"
                      >
                        Open Attachment ➔
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
