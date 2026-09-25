import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  getChallenge,
  deleteChallenge,
  analyzeChallenge,
  addValidation,
  removeValidation,
  getValidations,
  checkDuplicates,
} from '../services/challengeService.js';
import { getUniversityMatches } from '../services/universityService.js';
import { listDiscussions } from '../services/discussionService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { CATEGORIES } from '../utils/constants.js';

const STATUS_STYLES = {
  submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-amber-50 text-amber-700',
  validated: 'bg-purple-50 text-purple-700',
  assigned: 'bg-indigo-50 text-indigo-700',
  in_progress: 'bg-cyan-50 text-cyan-700',
  resolved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
};

export default function ChallengeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [community, setCommunity] = useState(null);
  const [validations, setValidations] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [similarChallenges, setSimilarChallenges] = useState(null);
  const [uniMatches, setUniMatches] = useState(null);
  const [isMatching, setIsMatching] = useState(false);
  const [localDiscussion, setLocalDiscussion] = useState(null);
  const [showVoiceDetails, setShowVoiceDetails] = useState(false);

  const isAuthenticated = Boolean(user);

  const ai = challenge?.aiClassification;
  const canStartProject =
    user && ['university', 'faculty', 'admin'].includes(user.role) &&
    !['rejected'].includes(challenge?.status || '');
  const loadCommunity = useCallback(() => {
    getValidations(id)
      .then((res) => {
        setValidations(res.validations || []);
        setCommunity(res.community);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getChallenge(id)
      .then((res) => {
        if (cancelled) return;
        setChallenge(res.challenge);
        const dup = res.challenge.duplicateCheck;
        if (dup?.isDuplicate) {
          setSimilarChallenges(
            (dup.similarChallenges || []).map((s) => ({
              challengeId: s.challenge,
              title: s.title,
              distance: s.distanceLabel,
              similarity: s.similarity,
            }))
          );
        }
        if (res.challenge.universityMatches?.matches?.length) {
          setUniMatches(res.challenge.universityMatches.matches);
        }
      })
      .catch((err) =>
        !cancelled && setError(err.response?.data?.message || 'Failed to load challenge.')
      )
      .finally(() => !cancelled && setIsLoading(false));
    loadCommunity();
    listDiscussions({ relatedChallenge: id, limit: 1, status: 'active' })
      .then((res) => !cancelled && setLocalDiscussion(res.discussions?.[0] || null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, loadCommunity]);

  async function onDelete() {
    if (!window.confirm('Delete this challenge permanently?')) return;
    setIsDeleting(true);
    try {
      await deleteChallenge(id);
      navigate('/challenges');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete.');
      setIsDeleting(false);
    }
  }

  async function runAnalysis() {
    setIsAnalyzing(true);
    setError('');
    try {
      const res = await analyzeChallenge(id);
      setChallenge(res.challenge);
    } catch (err) {
      setError(err.response?.data?.message || 'AI analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function onValidate(type, comment) {
    setValidationError('');
    try {
      const res = await addValidation(id, { type, comment });
      setCommunity(res.community);
      loadCommunity();
      setShowDispute(false);
      setDisputeReason('');
      setCommentText('');
    } catch (err) {
      setValidationError(err.response?.data?.message || 'Action failed.');
    }
  }

  async function onRemoveValidation() {
    setValidationError('');
    try {
      const res = await removeValidation(id);
      setCommunity(res.community);
      loadCommunity();
    } catch (err) {
      setValidationError(err.response?.data?.message || 'Failed to remove.');
    }
  }

  async function runDuplicateCheckNow() {
    setError('');
    try {
      const res = await checkDuplicates(id, true);
      const dup = res.duplicateCheck;
      setSimilarChallenges(
        dup.isDuplicate
          ? dup.similarChallenges.map((s) => ({
              challengeId: s.challengeId,
              title: s.title,
              distance: s.distance,
              similarity: s.similarity,
            }))
          : []
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Duplicate check failed.');
    }
  }

  async function loadUniversityMatches(force = false) {
    setIsMatching(true);
    setError('');
    try {
      const res = await getUniversityMatches(id, force);
      setUniMatches(res.matches || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load university matches.');
    } finally {
      setIsMatching(false);
    }
  }

  if (isLoading) {
    return <p className="py-24 text-center text-gray-500">Loading challenge...</p>;
  }
  if (error && !challenge) {
    return (
      <div className="py-24 text-center">
        <p className="text-red-600">{error}</p>
        <Link to="/challenges" className="mt-4 inline-block text-johar-green-700 hover:underline">
          Back to challenges
        </Link>
      </div>
    );
  }

  const isOwner = user && challenge.submittedBy?._id === user._id;
  const canEdit = isOwner || user?.role === 'admin';
  const categoryLabel =
    CATEGORIES.find((c) => c.value === challenge.category)?.label || challenge.category;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link to="/challenges" className="text-sm text-gray-500 hover:text-johar-green-700">
        ← All Challenges
      </Link>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium uppercase tracking-wide text-johar-green-700">
            {categoryLabel}
          </span>
          <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${STATUS_STYLES[challenge.status]}`}>
            {challenge.status.replace('_', ' ')}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 capitalize">
            Severity: {challenge.severity}
          </span>
          {challenge.voiceInput?.enabled && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 font-medium text-amber-800">
              🎙 Reported via Voice ({challenge.voiceInput.originalLanguage || 'Local'})
            </span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-bold">{challenge.title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          Reported by {challenge.submittedBy?.name || 'Anonymous'} · {challenge.district} district ·{' '}
          {new Date(challenge.createdAt).toLocaleDateString()}
        </p>
      </header>

      {challenge.voiceInput?.originalTranscript && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-900 flex items-center gap-1.5">
              <span>🎙</span> Original Voice Transcript ({challenge.voiceInput.originalLanguage}):
            </span>
            <button
              type="button"
              onClick={() => setShowVoiceDetails((v) => !v)}
              className="text-amber-800 font-semibold underline text-[11px]"
            >
              {showVoiceDetails ? 'Hide' : 'Show full transcript'}
            </button>
          </div>
          {showVoiceDetails && (
            <div className="mt-2 space-y-1.5 text-gray-800">
              <p className="italic bg-white p-2.5 rounded border border-amber-100 whitespace-pre-wrap">
                "{challenge.voiceInput.originalTranscript}"
              </p>
              {challenge.voiceInput.standardizedText && (
                <p className="text-[11px] text-gray-600">
                  <strong className="text-gray-700">Standardized: </strong>
                  {challenge.voiceInput.standardizedText}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 whitespace-pre-wrap leading-relaxed text-gray-800">
        {challenge.description}
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-5 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-gray-500">Affected</dt>
          <dd className="mt-0.5 font-medium">{challenge.affectedPopulation || '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Sub-category</dt>
          <dd className="mt-0.5 font-medium">{challenge.subCategory || '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Area</dt>
          <dd className="mt-0.5 font-medium">{challenge.address || '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Language</dt>
          <dd className="mt-0.5 font-medium uppercase">{challenge.language}</dd>
        </div>
      </dl>

      {challenge.tags?.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {challenge.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-green-50 px-3 py-1 text-xs text-johar-green-700">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <section className="mt-8 rounded-xl border border-johar-green-600/20 bg-johar-green-50 p-5">
        <h2 className="font-semibold">Discuss locally</h2>
        {challenge.solutionProject && (
          <p className="mt-2 text-sm">
            <span className="font-semibold">Solution Project: </span>
            <Link
              to={`/projects/${challenge.solutionProject._id}`}
              className="font-medium text-johar-green-700 hover:underline"
            >
              {challenge.solutionProject.title}
            </Link>
            <span className="ml-2 capitalize text-xs text-gray-500">
              {String(challenge.solutionProject.status).replace(/_/g, ' ')} ·{' '}
              {challenge.solutionProject.currentProgress || 0}% complete
              {challenge.solutionProject.university?.name
                ? ` · ${challenge.solutionProject.university.name}`
                : ''}
            </span>
          </p>
        )}
        {localDiscussion ? (
          <p className="mt-2 text-sm">
            Neighbours are already discussing this issue:{' '}
            <Link
              to={`/samvaad/${localDiscussion._id}`}
              className="font-medium text-johar-green-700 hover:underline"
            >
              {localDiscussion.title} →
            </Link>
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm">
              Start a community discussion in your area about this problem.{' '}
              <Link
                to={`/samvaad/new?challenge=${challenge._id}`}
                className="font-medium text-johar-green-700 hover:underline"
              >
                Discuss locally →
              </Link>
            </p>
            {canStartProject && (
              <p className="mt-1 text-sm text-gray-600">
                No solution project yet.{' '}
                <Link
                  to={`/projects/new?challenge=${challenge._id}`}
                  className="font-medium text-johar-green-700 hover:underline"
                >
                  Start one →
                </Link>
              </p>
            )}
          </>
        )}
      </section>

      {(challenge.images?.length > 0 ||
        challenge.videos?.length > 0 ||
        challenge.documents?.length > 0) && (
        <section className="mt-8">
          <h2 className="font-semibold">Attachments</h2>
          {challenge.images?.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {challenge.images.map((img) => (
                <img
                  key={img.url}
                  src={img.url}
                  alt={img.originalName || 'Challenge image'}
                  onError={(e) => {
                    e.currentTarget.replaceWith(
                      Object.assign(document.createElement('div'), {
                        className:
                          'flex h-40 w-full items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400',
                        textContent: 'Image unavailable',
                      })
                    );
                  }}
                  className="h-40 w-full rounded-lg object-cover"
                />
              ))}
            </div>
          )}
          {[['Videos', challenge.videos], ['Documents', challenge.documents]].map(
            ([label, items]) =>
              items?.length > 0 && (
                <ul key={label} className="mt-3 space-y-1 text-sm">
                  {items.map((item) => (
                    <li key={item.url}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-johar-green-700 hover:underline"
                      >
                        {label.slice(0, -1)}: {item.originalName || item.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )
          )}
        </section>
      )}

      {isAuthenticated && (
        <section className="mt-10 rounded-xl border border-johar-earth-500/20 bg-johar-earth-50/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Recommended Universities</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                AI-assisted suggestions based on research areas, expertise and location. Only
                admins or the assigned university can formally accept a challenge.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadUniversityMatches(Boolean(uniMatches))}
              disabled={isMatching}
              className="rounded-lg border border-johar-green-700 px-4 py-2 text-sm font-medium text-johar-green-700 transition-colors hover:bg-green-50 disabled:opacity-50"
            >
              {isMatching
                ? 'Matching...'
                : uniMatches
                  ? 'Refresh Matches'
                  : 'Find Matching Universities'}
            </button>
          </div>

          {uniMatches && uniMatches.length === 0 && (
            <p className="mt-4 text-sm text-gray-500">
              No matching universities found yet. University profiles are added over time.
            </p>
          )}

          {uniMatches && uniMatches.length > 0 && (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {uniMatches.slice(0, 6).map((m) => (
                <li key={m.universityId} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{m.name}</p>
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
                      {m.matchingAreas.map((area) => (
                        <span key={area} className="rounded-full bg-johar-green-50 px-2 py-0.5 text-xs text-johar-green-700">
                          {area}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.reason && <p className="mt-2 text-xs text-gray-600">{m.reason}</p>}
                  <Link
                    to={`/universities/${m.universityId}`}
                    className="mt-3 inline-block text-sm font-medium text-johar-green-700 hover:underline"
                  >
                    View University →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {challenge.aiStatus === 'completed' && ai && (
        <section className="mt-10 rounded-xl border border-purple-100 bg-purple-50/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">AI-Assisted Analysis</h2>
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
              Priority Score: {ai.priorityScore ?? challenge.priorityScore}/100
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            This analysis is AI-generated and may contain errors. It is not an official government
            or expert assessment.
          </p>

          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-gray-600">Summary</dt>
              <dd className="mt-1 text-gray-800">{ai.summary || '—'}</dd>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-gray-500">Suggested Category</dt>
                <dd className="mt-0.5 font-medium capitalize">
                  {(ai.category || '—').replace(/_/g, ' ')}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Sub-category</dt>
                <dd className="mt-0.5 font-medium">{ai.subCategory || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">AI Severity</dt>
                <dd className="mt-0.5 font-medium capitalize">{ai.severity}</dd>
              </div>
            </div>
            {ai.skillsRequired?.length > 0 && (
              <div>
                <dt className="text-gray-500">Required Skills</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {ai.skillsRequired.map((s) => (
                    <span key={s} className="rounded-full bg-white px-2.5 py-0.5 text-xs border border-purple-100">
                      {s}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {ai.solutionDomains?.length > 0 && (
              <div>
                <dt className="text-gray-500">Solution Domains</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {ai.solutionDomains.map((s) => (
                    <span key={s} className="rounded-full bg-white px-2.5 py-0.5 text-xs border border-purple-100">
                      {s}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {ai.jharkhandContext && (
              <div>
                <dt className="text-gray-500">Jharkhand Context</dt>
                <dd className="mt-1 text-gray-800">{ai.jharkhandContext}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {Array.isArray(similarChallenges) && similarChallenges.length > 0 && (
        <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-800">Similar challenges already reported</h2>
          <p className="mt-1 text-xs text-amber-700">
            These may describe the same problem. Your report stays available for review either way.
          </p>
          <ul className="mt-3 space-y-2">
            {similarChallenges.map((s) => (
              <li key={s.challengeId}>
                <Link
                  to={`/challenges/${s.challengeId}`}
                  className="block rounded-lg border border-amber-200 bg-white p-3 transition-colors hover:border-amber-400"
                >
                  <span className="text-sm font-medium">{s.title}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {s.distance} · {s.similarity} similarity
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Community Validation</h2>
          {community && (
            <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-johar-green-700">
              Community Score: {community.communityValidationScore}/100
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Community signals only — this is not official government verification.
        </p>

        {!isAuthenticated ? (
          <p className="mt-4 text-sm text-gray-600">
            <Link to="/login" className="font-medium text-johar-green-700 hover:underline">
              Log in
            </Link>{' '}
            to support or discuss this challenge.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onValidate('support')}
                className="rounded-lg bg-johar-green-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-johar-green-600"
              >
                Support{community ? ` (${community.supportCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setShowDispute((v) => !v)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-red-300 hover:text-red-600"
              >
                Dispute{community ? ` (${community.disputeCount})` : ''}
              </button>
              <button
                type="button"
                onClick={onRemoveValidation}
                className="text-xs text-gray-500 underline hover:text-gray-700"
              >
                Remove my reactions
              </button>
            </div>

            {showDispute && (
              <div className="mt-4 rounded-lg border border-gray-200 p-4">
                <label htmlFor="disputeReason" className="block text-sm font-medium text-gray-700">
                  Why is this information incorrect?
                </label>
                <textarea
                  id="disputeReason"
                  rows={2}
                  minLength={10}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className={`${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => onValidate('dispute', disputeReason)}
                  disabled={disputeReason.trim().length < 10}
                  className="mt-2 rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 disabled:opacity-40"
                >
                  Submit Dispute
                </button>
              </div>
            )}

            {validationError && (
              <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {validationError}
              </p>
            )}
          </>
        )}

        <div className="mt-6">
          <h3 className="text-sm font-semibold">
            Comments ({community?.commentCount ?? 0})
          </h3>
          {isAuthenticated && (
            <div className="mt-2 flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add local context, updates or evidence..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onValidate('comment', commentText)}
                disabled={!commentText.trim()}
                className="rounded-lg border border-johar-green-700 px-4 py-2 text-sm font-medium text-johar-green-700 disabled:opacity-40"
              >
                Comment
              </button>
            </div>
          )}
          <ul className="mt-4 space-y-3">
            {validations
              .filter((v) => v.type === 'comment')
              .map((v) => (
                <li key={v._id} className="rounded-lg bg-gray-50 p-3 text-sm">
                  <p className="text-gray-800">{v.comment}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {v.userName} · {new Date(v.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            {validations.filter((v) => v.type === 'comment').length === 0 && (
              <li className="text-sm text-gray-500">No comments yet.</li>
            )}
          </ul>
        </div>
      </section>

      {(isOwner || user?.role === 'admin') && challenge.aiStatus !== 'completed' && (
        <section className="mt-8">
          <button
            type="button"
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="rounded-lg bg-johar-green-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-johar-green-600 disabled:opacity-50"
          >
            {isAnalyzing
              ? 'Analyzing...'
              : challenge.aiStatus === 'failed'
                ? 'Retry AI Analysis'
                : 'Run AI Analysis'}
          </button>
        </section>
      )}

      {canEdit && (
        <footer className="mt-10 flex gap-3 border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={() => navigate(`/report?edit=${id}`)}
            disabled
            title="Editing coming soon"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-400"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </footer>
      )}
    </article>
  );
}
