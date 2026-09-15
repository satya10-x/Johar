import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  getDiscussion,
  joinDiscussion,
  leaveDiscussion,
  getComments,
  addComment,
  reportDiscussion,
  deleteDiscussion,
} from '../services/discussionService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { CATEGORIES } from '../utils/constants.js';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'abuse', label: 'Abuse or harassment' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
];

const fmtDate = (d) => new Date(d).toLocaleDateString();

export default function SamvaadDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [discussion, setDiscussion] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadComments = useCallback(() => {
    return getComments(id)
      .then((res) => setComments(res.comments || []))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getDiscussion(id)
      .then((res) => !cancelled && setDiscussion(res.discussion))
      .catch((err) =>
        setError(err.response?.data?.message || 'Failed to load the discussion.')
      )
      .finally(() => !cancelled && setIsLoading(false));
    loadComments();
    return () => {
      cancelled = true;
    };
  }, [id, loadComments]);

  async function act(fn, successMessage) {
    setActionError('');
    setSuccessMsg('');
    try {
      await fn();
      if (successMessage) setSuccessMsg(successMessage);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
      throw err;
    }
  }

  async function toggleJoin() {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/samvaad/${id}` } } });
      return;
    }
    await act(async () => {
      if (discussion.hasJoined) await leaveDiscussion(id);
      else await joinDiscussion(id);
      const res = await getDiscussion(id);
      setDiscussion(res.discussion);
    });
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/samvaad/${id}` } } });
      return;
    }
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await addComment(id, commentText.trim());
      setCommentText('');
      await loadComments();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to post your comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  }

  async function submitReport() {
    try {
      await act(
        () => reportDiscussion(id, reportReason, reportDetails),
        'Thank you — this discussion has been reported for admin review.'
      );
      setShowReport(false);
      setReportDetails('');
    } catch {
      /* error already shown */
    }
  }

  async function setStatus(status) {
    await act(async () => {
      await updateDiscussion(id, { status });
      const res = await getDiscussion(id);
      setDiscussion(res.discussion);
    }, status === 'closed' ? 'Discussion closed.' : 'Discussion reopened.');
  }

  async function removeDiscussion() {
    await act(async () => {
      await deleteDiscussion(id);
      navigate('/samvaad');
    });
  }

  if (isLoading) return <p className="py-24 text-center text-gray-500">Loading discussion...</p>;
  if (!discussion)
    return (
      <div className="py-24 text-center">
        <p className="text-red-600">{error || 'Discussion not found.'}</p>
        <Link to="/samvaad" className="mt-3 inline-block text-sm text-johar-green-700 hover:underline">
          ← Back to Local Samvaad
        </Link>
      </div>
    );

  const categoryLabel =
    CATEGORIES.find((c) => c.value === discussion.category)?.label ||
    String(discussion.category).replace(/_/g, ' ');

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/samvaad" className="text-sm text-gray-500 hover:text-johar-green-700">
        ← Local Samvaad
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-johar-green-50 px-2 py-0.5 font-medium capitalize text-johar-green-700">
            {categoryLabel}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 capitalize text-gray-500">
            Near {discussion.district}
          </span>
          {discussion.status !== 'active' && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium capitalize text-red-600">
              {discussion.status}
            </span>
          )}
          {discussion.reportCount > 0 && discussion.canManage && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
              {discussion.reportCount} report{discussion.reportCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{discussion.title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          Started by{' '}
          <span className="font-medium text-gray-700">{discussion.createdBy?.name}</span> ·{' '}
          {fmtDate(discussion.createdAt)}
          {discussion.language && discussion.language !== 'en' && (
            <> · Language: <span className="uppercase">{discussion.language}</span></>
          )}
        </p>
      </header>

      {/* Related challenge */}
      {discussion.relatedChallenge && (
        <div className="mt-5 rounded-xl border border-johar-green-600/20 bg-johar-green-50 p-4 text-sm">
          <span className="font-semibold">Related Challenge: </span>
          <Link
            to={`/challenges/${discussion.relatedChallenge._id}`}
            className="font-medium text-johar-green-700 hover:underline"
          >
            {discussion.relatedChallenge.title}
          </Link>
        </div>
      )}

      {/* Participation */}
      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl bg-gray-50 p-5 text-sm">
        <div>
          <p className="text-xs text-gray-500">Participants</p>
          <p className="text-lg font-bold text-johar-green-700">{discussion.participantCount}</p>
        </div>
        {discussion.status === 'active' ? (
          <button
            type="button"
            onClick={toggleJoin}
            className={`ml-auto rounded-lg px-5 py-2.5 text-sm font-semibold ${
              discussion.hasJoined
                ? 'border border-gray-300 text-gray-700 hover:border-red-300 hover:text-red-600'
                : 'bg-johar-green-700 text-white hover:bg-johar-green-600'
            }`}
          >
            {discussion.hasJoined
              ? 'Leave Discussion'
              : user
                ? 'Join Discussion'
                : 'Log in to join'}
          </button>
        ) : (
          <span className="ml-auto text-sm text-gray-500">
            This discussion is {discussion.status}.
          </span>
        )}
      </div>

      <p className="mt-6 whitespace-pre-line leading-relaxed text-gray-800">
        {discussion.description}
      </p>

      {/* Creator / admin actions */}
      {discussion.canManage && (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {discussion.status === 'active' && (
            <button
              type="button"
              onClick={() => setStatus('closed')}
              className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:border-johar-green-700 hover:text-johar-green-700"
            >
              Close discussion
            </button>
          )}
          {discussion.status === 'closed' && user.role === 'admin' && (
            <>
              <button
                type="button"
                onClick={() => setStatus('archived')}
                className="rounded-lg border border-amber-200 px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50"
              >
                Archive
              </button>
              <button
                type="button"
                onClick={() => setStatus('active')}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600"
              >
                Reopen
              </button>
            </>
          )}
          <button
            type="button"
            onClick={removeDiscussion}
            className="rounded-lg border border-red-200 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      )}

      {/* Comments */}
      <section className="mt-10">
        <h2 className="font-semibold">Comments ({comments.length})</h2>

        {discussion.status === 'active' && (
          <form onSubmit={submitComment} className="mt-3">
            <textarea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={
                user
                  ? 'Share information, evidence or a suggestion...'
                  : 'Log in to join the conversation.'
              }
              disabled={!user}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none disabled:bg-gray-50"
            />
            <button
              type="submit"
              disabled={!user || isSubmittingComment || !commentText.trim()}
              className="mt-2 rounded-lg bg-johar-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-johar-green-600 disabled:opacity-40"
            >
              {isSubmittingComment ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
        )}

        {comments.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No comments yet. Be the first to contribute.</p>
        ) : (
          <ul className="mt-5 space-y-4">
            {comments.map((c) => (
              <li key={c._id} className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{c.user?.name || 'Former user'}</span>
                  {' · '}
                  {fmtDate(c.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{c.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Report */}
      {!showReport && (
        <button
          type="button"
          onClick={() => (user ? setShowReport(true) : navigate('/login'))}
          className="mt-10 text-xs text-gray-400 underline hover:text-red-500"
        >
          Report this discussion
        </button>
      )}
      {showReport && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">Why are you reporting this?</p>
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm sm:w-auto"
          >
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <textarea
            rows={2}
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            placeholder="Optional details for the moderators..."
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={submitReport}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
            >
              Submit Report
            </button>
            <button
              type="button"
              onClick={() => setShowReport(false)}
              className="px-3 py-2 text-sm text-gray-500"
            >
              Cancel
            </button>
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
