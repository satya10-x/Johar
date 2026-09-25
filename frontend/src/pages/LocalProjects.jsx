import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { listProjects, getProject } from '../services/projectService.js';
import { DISTRICTS, CATEGORIES } from '../utils/constants.js';

const STATUS_BADGES = {
  proposed: 'bg-amber-100 text-amber-900 border-amber-300',
  approved: 'bg-blue-100 text-blue-900 border-blue-300',
  in_progress: 'bg-cyan-100 text-cyan-900 border-cyan-300',
  under_review: 'bg-purple-100 text-purple-900 border-purple-300',
  completed: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  delayed: 'bg-red-100 text-red-900 border-red-300',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-300',
};

const MILESTONE_STATUS_BADGES = {
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
  pending: 'bg-gray-100 text-gray-700 border-gray-300',
  delayed: 'bg-red-100 text-red-800 border-red-300',
  blocked: 'bg-amber-100 text-amber-800 border-amber-300',
};

export default function LocalProjects() {
  const { id: paramProjectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedProjectId = paramProjectId || searchParams.get('project') || '';
  const initialDistrict = searchParams.get('district') || '';

  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict);
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Detailed selected project modal or expanded view
  const [expandedProjectId, setExpandedProjectId] = useState(selectedProjectId);
  const [activeProjectDetail, setActiveProjectDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedProjectId) {
      setExpandedProjectId(selectedProjectId);
      loadSingleProject(selectedProjectId);
    }
  }, [selectedProjectId]);

  function loadProjects() {
    setIsLoading(true);
    setError('');
    const params = { limit: 30 };
    if (selectedDistrict) params.district = selectedDistrict;

    listProjects(params)
      .then((res) => {
        setProjects(res.projects || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load local projects.');
      })
      .finally(() => setIsLoading(false));
  }

  function loadSingleProject(projectId) {
    if (!projectId) return;
    setIsLoadingDetail(true);
    getProject(projectId)
      .then((res) => {
        setActiveProjectDetail(res.project);
      })
      .catch(() => {})
      .finally(() => setIsLoadingDetail(false));
  }

  function handleDistrictChange(d) {
    setSelectedDistrict(d);
    const newParams = new URLSearchParams(searchParams);
    if (d) newParams.set('district', d);
    else newParams.delete('district');
    setSearchParams(newParams);
  }

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.challenge?.title?.toLowerCase().includes(q) ||
      p.university?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border-2 border-nb-ink bg-nb-yellow p-5 shadow-[4px_4px_0_#111]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-nb-ink bg-white text-lg font-black shadow-[2px_2px_0_#111]">
                📍
              </span>
              <h1 className="text-2xl font-black uppercase tracking-tight text-nb-ink sm:text-3xl">
                Track Local Work
              </h1>
            </div>
            <p className="mt-1 text-xs font-semibold text-nb-ink/80 sm:text-sm">
              Citizen Transparency Portal · Public Development Work & Verified Solution Progress Across Jharkhand
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/challenges"
              className="rounded-lg border-2 border-nb-ink bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-nb-ink shadow-[2px_2px_0_#111] transition-all hover:bg-gray-50"
            >
              ← Explore Problems
            </Link>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-nb-ink bg-white p-4 shadow-[3px_3px_0_#111]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-gray-700">Filter District:</span>
            <select
              value={selectedDistrict}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="rounded-lg border-2 border-nb-ink bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-[2px_2px_0_#111] focus:outline-none"
            >
              <option value="">All Jharkhand Districts</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search local projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border-2 border-nb-ink bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-[2px_2px_0_#111] focus:outline-none"
          />
        </div>
      </div>

      {/* Selected Project Full Roadmap View (If user clicked "Track Solution" or selected a project) */}
      {expandedProjectId && (
        <div className="rounded-xl border-2 border-nb-ink bg-white p-6 shadow-[4px_4px_0_#111] relative">
          <div className="flex items-start justify-between gap-3 border-b-2 border-gray-100 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800 border border-emerald-300">
                  Featured Solution Tracking
                </span>
                {activeProjectDetail?.status && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase border ${
                      STATUS_BADGES[activeProjectDetail.status] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {activeProjectDetail.status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-xl font-black text-gray-900 sm:text-2xl">
                {activeProjectDetail?.title || 'Loading project details...'}
              </h2>
              {activeProjectDetail?.challenge && (
                <p className="mt-1 text-xs text-gray-600">
                  <strong className="text-gray-800">Addressing Challenge: </strong>
                  <Link
                    to={`/challenges/${activeProjectDetail.challenge._id || activeProjectDetail.challenge}`}
                    className="text-johar-green-700 hover:underline font-semibold"
                  >
                    {activeProjectDetail.challenge.title || 'View original report →'}
                  </Link>
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setExpandedProjectId('');
                setActiveProjectDetail(null);
              }}
              className="rounded-lg border-2 border-nb-ink bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-gray-200"
            >
              ✕ Close Detail
            </button>
          </div>

          {isLoadingDetail ? (
            <p className="py-8 text-center text-xs text-gray-500">Loading verified milestone progress...</p>
          ) : activeProjectDetail ? (
            <div className="mt-5 space-y-5">
              {/* Overall Progress Bar */}
              <div>
                <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                  <span>Overall Solution Implementation</span>
                  <span>{activeProjectDetail.currentProgress || 0}% Complete</span>
                </div>
                <div className="h-3 w-full rounded-full border border-gray-300 bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${activeProjectDetail.currentProgress || 0}%` }}
                  />
                </div>
              </div>

              {/* Project Meta Details */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg bg-gray-50 p-3 text-xs">
                <div>
                  <span className="text-gray-500 font-semibold block">University Partner</span>
                  <span className="font-bold text-gray-900">
                    {activeProjectDetail.university?.name || 'Local Institution'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">Location</span>
                  <span className="font-bold text-gray-900">
                    {activeProjectDetail.deploymentDetails?.district ||
                      activeProjectDetail.governmentOwnership?.district ||
                      activeProjectDetail.challenge?.district ||
                      'Jharkhand'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">Expected Completion</span>
                  <span className="font-bold text-gray-900">
                    {activeProjectDetail.expectedEndDate
                      ? new Date(activeProjectDetail.expectedEndDate).toLocaleDateString()
                      : 'Scheduled'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">Full Overview</span>
                  <Link
                    to={`/projects/${activeProjectDetail._id}`}
                    className="font-bold text-johar-green-700 hover:underline"
                  >
                    View Project Page ➔
                  </Link>
                </div>
              </div>

              {/* Verified Milestones Roadmap */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">
                  Verified Milestone Progress
                </h3>
                {activeProjectDetail.milestones && activeProjectDetail.milestones.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {activeProjectDetail.milestones.map((m, idx) => (
                      <div
                        key={m._id || idx}
                        className="rounded-lg border-2 border-nb-ink bg-white p-3.5 text-xs shadow-[2px_2px_0_#111]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-nb-yellow text-[10px] font-black border border-nb-ink">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-gray-900 text-sm">{m.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${
                                MILESTONE_STATUS_BADGES[m.status || m.executionStatus] ||
                                'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {m.status || m.executionStatus || 'pending'}
                            </span>
                            {m.verificationStatus === 'verified' && (
                              <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase text-green-800 border border-green-300">
                                ✓ Verified by Authority
                              </span>
                            )}
                          </div>
                        </div>

                        {m.description && <p className="mt-1.5 text-gray-600">{m.description}</p>}

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                          <span>
                            Progress: <strong>{m.progress || 0}%</strong>
                          </span>
                          {m.dueDate && (
                            <span>
                              Target: {new Date(m.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {m.evidence && m.evidence.length > 0 && (
                            <span className="text-emerald-700 font-semibold">
                              📷 {m.evidence.length} Verified Evidence Record(s) Attached
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500 italic">
                    Milestones are being scheduled by the engineering team.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Projects List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
            Local Work in {selectedDistrict || 'All Jharkhand'} ({filteredProjects.length})
          </h2>
          <span className="text-xs text-gray-500">Public verified solutions</span>
        </div>

        {isLoading ? (
          <div className="rounded-xl border-2 border-nb-ink bg-white p-12 text-center shadow-[3px_3px_0_#111]">
            <p className="text-sm font-semibold text-gray-500">Loading local projects...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border-2 border-red-500 bg-red-50 p-6 text-center text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-xl border-2 border-nb-ink bg-white p-12 text-center shadow-[3px_3px_0_#111]">
            <p className="text-base font-bold text-gray-800">No public projects found for this area.</p>
            <p className="mt-1 text-xs text-gray-500">
              Solutions are actively matched by universities and local authorities.
            </p>
            <Link
              to="/report"
              className="mt-4 inline-block rounded-lg border-2 border-nb-ink bg-nb-yellow px-4 py-2 text-xs font-black uppercase tracking-wider shadow-[2px_2px_0_#111] hover:bg-yellow-400"
            >
              Report a Local Problem →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((proj) => {
              const pDistrict =
                proj.deploymentDetails?.district ||
                proj.governmentOwnership?.district ||
                proj.challenge?.district ||
                'Jharkhand';

              return (
                <div
                  key={proj._id}
                  className="flex flex-col justify-between rounded-xl border-2 border-nb-ink bg-white p-5 shadow-[3px_3px_0_#111] transition-all hover:-translate-y-1 hover:shadow-[5px_5px_0_#111]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 uppercase">
                        📍 {pDistrict}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${
                          STATUS_BADGES[proj.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {proj.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h3 className="mt-3 font-bold text-gray-900 leading-snug line-clamp-2">
                      {proj.title}
                    </h3>

                    {proj.challenge && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                        Problem: {proj.challenge.title || 'Reported Local Challenge'}
                      </p>
                    )}

                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] font-semibold text-gray-600 mb-1">
                        <span>Work Progress</span>
                        <span>{proj.currentProgress || 0}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600"
                          style={{ width: `${proj.currentProgress || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedProjectId(proj._id);
                        loadSingleProject(proj._id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                    >
                      Track Milestones ➔
                    </button>
                    <Link
                      to={`/projects/${proj._id}`}
                      className="text-xs font-medium text-gray-500 hover:text-gray-800"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
