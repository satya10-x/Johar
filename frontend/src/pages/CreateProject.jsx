import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { createProject, getProject } from '../services/projectService.js';
import { getChallenge } from '../services/challengeService.js';
import { CATEGORIES } from '../utils/constants.js';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none';

export default function CreateProject() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const challengeParam = searchParams.get('challenge');
  const [challenge, setChallenge] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    objectives: '',
    proposedSolution: '',
    estimatedBudget: '',
    startDate: '',
    expectedEndDate: '',
    technologies: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [challengeError, setChallengeError] = useState('');

  useEffect(() => {
    if (!challengeParam) {
      setChallengeError('No challenge selected. Open a challenge and choose "Start one".');
      return;
    }
    getChallenge(challengeParam)
      .then((res) => {
        setChallenge(res.challenge);
        if (res.challenge.solutionProject) {
          setChallengeError('This challenge already has a solution project.');
        }
      })
      .catch(() =>
        setChallengeError('Could not load the selected challenge. Check the link and try again.')
      );
  }, [challengeParam]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (!challenge) {
      setError('A valid challenge is required to create a project.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        challenge: challenge._id,
        title: form.title,
        description: form.description,
        proposedSolution: form.proposedSolution,
        objectives: form.objectives
          .split('\n')
          .map((o) => o.trim())
          .filter(Boolean),
        technologies: form.technologies
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        estimatedBudget: form.estimatedBudget ? Number(form.estimatedBudget) : undefined,
        startDate: form.startDate || undefined,
        expectedEndDate: form.expectedEndDate || undefined,
      };
      const res = await createProject(payload);
      navigate(`/projects/${res.project._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create the project.');
      setIsSubmitting(false);
    }
  }

  const categoryLabel = CATEGORIES.find((c) => c.value === challenge?.category)?.label;

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">Start a Solution Project</h1>
      <p className="mt-1 text-sm text-gray-500">
        Turn an accepted societal challenge into a structured university project.
      </p>

      {challenge && (
        <div className="mt-5 rounded-xl border border-johar-green-600/20 bg-johar-green-50 p-4 text-sm">
          <span className="font-semibold">Originating Challenge: </span>
          <Link
            to={`/challenges/${challenge._id}`}
            className="font-medium text-johar-green-700 hover:underline"
          >
            {challenge.title}
          </Link>{' '}
          <span className="text-xs text-gray-500">
            · {categoryLabel || challenge.category} · {challenge.district}
          </span>
        </div>
      )}
      {challengeError && (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {challengeError}{' '}
          {challenge && (
            <button
              type="button"
              onClick={() => navigate(`/challenges/${challenge._id}`)}
              className="font-semibold underline"
            >
              Go back
            </button>
          )}
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Project title *</label>
          <input
            required
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g., Low-cost water purification pilot for Ranchi"
            className={`mt-1 ${inputClass}`}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Problem being solved *</label>
          <textarea
            required
            rows={4}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Describe the problem this project addresses..."
            className={`mt-1 ${inputClass}`}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Proposed solution</label>
          <textarea
            rows={3}
            value={form.proposedSolution}
            onChange={(e) => set('proposedSolution', e.target.value)}
            placeholder="How will the project solve it?"
            className={`mt-1 ${inputClass}`}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Objectives (one per line)</label>
          <textarea
            rows={3}
            value={form.objectives}
            onChange={(e) => set('objectives', e.target.value)}
            placeholder={'Install 20 filtration units\nTrain 50 community volunteers'}
            className={`mt-1 ${inputClass}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Estimated budget (₹)</label>
            <input
              type="number"
              min="0"
              value={form.estimatedBudget}
              onChange={(e) => set('estimatedBudget', e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Technologies (comma separated)</label>
            <input
              value={form.technologies}
              onChange={(e) => set('technologies', e.target.value)}
              placeholder="IoT, Solar power"
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Expected completion</label>
            <input
              type="date"
              value={form.expectedEndDate}
              onChange={(e) => set('expectedEndDate', e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !challenge || Boolean(challengeError)}
          className="rounded-lg bg-johar-green-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-johar-green-600 disabled:opacity-40"
        >
          {isSubmitting ? 'Creating...' : 'Create Project'}
        </button>
        <p className="text-xs text-gray-400">
          The project starts in “Proposed” status and follows the lifecycle: Proposed → Approved →
          Team Formation → Development → Testing → Pilot → Deployed → Completed.
        </p>
      </form>
    </section>
  );
}
