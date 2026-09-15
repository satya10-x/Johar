import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createChallenge } from '../services/challengeService.js';
import { CATEGORIES, DISTRICTS, LANGUAGES, SEVERITIES } from '../utils/constants.js';
import { describeGeoError, getCurrentPosition } from '../utils/geo.js';

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-johar-green-700 focus:outline-none';

export default function ReportProblem() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    subCategory: '',
    district: '',
    language: 'en',
    severity: 'medium',
    affectedPopulation: '',
    tags: '',
    address: '',
  });
  const [location, setLocation] = useState(null);
  const [geoStatus, setGeoStatus] = useState('');
  const [files, setFiles] = useState({ images: [], videos: [], documents: [] });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [submittedId, setSubmittedId] = useState(null);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  function onFileChange(e, type) {
    setFiles({ ...files, [type]: Array.from(e.target.files || []) });
  }

  async function useMyLocation() {
    setGeoStatus('Getting your location...');
    try {
      const pos = await getCurrentPosition();
      setLocation({
        coordinates: [
          Number(pos.coords.longitude.toFixed(6)),
          Number(pos.coords.latitude.toFixed(6)),
        ],
      });
      setGeoStatus('Location captured');
    } catch (err) {
      setGeoStatus(`${describeGeoError(err)} You can continue without it.`);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value !== '' && value != null) data.append(key, value);
      });
      if (location) data.append('location', JSON.stringify(location));
      data.append(
        'tags',
        JSON.stringify(
          form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        )
      );
      files.images.forEach((f) => data.append('images', f));
      files.videos.forEach((f) => data.append('videos', f));
      files.documents.forEach((f) => data.append('documents', f));

      const res = await createChallenge(data);
      if (res.duplicateWarning) {
        setDuplicateWarning({ ...res.duplicateWarning, challengeId: res.challenge._id });
        setIsSubmitting(false);
        return;
      }
      setSubmittedId(res.challenge._id);
      setTimeout(() => navigate(`/challenges/${res.challenge._id}`), 1400);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold">Report a Problem</h1>
      <p className="mt-2 text-sm text-gray-600">
        Describe a societal challenge in your area of Jharkhand.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {submittedId ? (
        <div className="mt-10 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <p className="text-lg font-semibold text-johar-green-700">
            Your problem has been submitted successfully.
          </p>
          <p className="mt-2 text-sm text-gray-600">Taking you to your report...</p>
        </div>
      ) : duplicateWarning ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-800">
            Similar challenges already exist ({duplicateWarning.confidence}% match)
          </h2>
          <p className="mt-1 text-sm text-amber-700">
            Your report has been saved. You can view the existing reports instead — or continue to
            yours below if it is a different problem.
          </p>
          <ul className="mt-3 space-y-2">
            {duplicateWarning.similarChallenges.map((s) => (
              <li key={s.challengeId}>
                <button
                  type="button"
                  onClick={() => navigate(`/challenges/${s.challengeId}`)}
                  className="w-full rounded-lg border border-amber-200 bg-white p-3 text-left transition-colors hover:border-amber-400"
                >
                  <span className="text-sm font-medium">{s.title}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {s.distance} · {s.similarity} similarity
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => navigate(`/challenges/${duplicateWarning.challengeId}`)}
            className="mt-3 w-full rounded-lg bg-johar-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-johar-green-600"
          >
            Continue to my report
          </button>
        </div>
      ) : null}

      {!submittedId && !duplicateWarning && (
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Problem Title *
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            placeholder="e.g., Broken hand pump in village well area"
            value={form.title}
            onChange={onChange}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={5}
            maxLength={5000}
            placeholder="Explain the problem, how long it has existed, who is affected and what has been tried so far..."
            value={form.description}
            onChange={onChange}
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Category *
            </label>
            <select
              id="category"
              name="category"
              required
              value={form.category}
              onChange={onChange}
              className={`${inputClass} bg-white`}
            >
              <option value="">Select category</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="district" className="block text-sm font-medium text-gray-700">
              District *
            </label>
            <select
              id="district"
              name="district"
              required
              value={form.district}
              onChange={onChange}
              className={`${inputClass} bg-white`}
            >
              <option value="">Select district</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="subCategory" className="block text-sm font-medium text-gray-700">
              Sub-category
            </label>
            <input
              id="subCategory"
              name="subCategory"
              value={form.subCategory}
              onChange={onChange}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700">
              Language
            </label>
            <select
              id="language"
              name="language"
              value={form.language}
              onChange={onChange}
              className={`${inputClass} bg-white`}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="severity" className="block text-sm font-medium text-gray-700">
              Severity
            </label>
            <select
              id="severity"
              name="severity"
              value={form.severity}
              onChange={onChange}
              className={`${inputClass} bg-white`}
            >
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="affectedPopulation" className="block text-sm font-medium text-gray-700">
              Affected Population (approx.)
            </label>
            <input
              id="affectedPopulation"
              name="affectedPopulation"
              type="number"
              min="0"
              value={form.affectedPopulation}
              onChange={onChange}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Area / Landmark
          </label>
          <input
            id="address"
            name="address"
            placeholder="e.g., near Block office"
            value={form.address}
            onChange={onChange}
            className={inputClass}
          />
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700">Exact Location</p>
          <button
            type="button"
            onClick={useMyLocation}
            className="mt-2 rounded-lg border border-johar-green-700 px-4 py-2 text-sm font-medium text-johar-green-700 transition-colors hover:bg-green-50"
          >
            Use my current location
          </button>
          <p className="mt-2 text-xs text-gray-500">{geoStatus}</p>
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
            Tags (comma separated)
          </label>
          <input
            id="tags"
            name="tags"
            placeholder="e.g., water, summer, village"
            value={form.tags}
            onChange={onChange}
            className={inputClass}
          />
        </div>

        <div className="space-y-3 rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700">Attachments (optional)</p>
          {[
            { name: 'images', label: 'Images', accept: 'image/*', multiple: true },
            { name: 'videos', label: 'Videos', accept: 'video/*', multiple: true },
            { name: 'documents', label: 'Documents (PDF/DOC)', accept: '.pdf,.doc,.docx', multiple: false },
          ].map((f) => (
            <div key={f.name} className="flex items-center gap-3 text-sm">
              <span className="w-24 text-gray-600">{f.label}</span>
              <input
                type="file"
                accept={f.accept}
                multiple={f.multiple}
                onChange={(e) => onFileChange(e, f.name)}
                className="text-sm"
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-johar-green-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-johar-green-600 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Challenge'}
        </button>
      </form>
      )}
    </section>
  );
}
