import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { createDiscussion } from '../services/discussionService.js';
import { getChallenge } from '../services/challengeService.js';
import { CATEGORIES, DISTRICTS, DISTRICT_COORDS, LANGUAGES } from '../utils/constants.js';
import { describeGeoError, getCurrentPosition } from '../utils/geo.js';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none';

export default function CreateDiscussion() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const challengeParam = searchParams.get('challenge');
  const [challenge, setChallenge] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: challengeParam ? '' : '',
    district: '',
    language: 'en',
    radius: '5',
  });
  const [coords, setCoords] = useState(null); // { lat, lng }
  const [isLocating, setIsLocating] = useState(false);
  const [locMessage, setLocMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!challengeParam) return;
    getChallenge(challengeParam)
      .then((res) => setChallenge(res.challenge))
      .catch(() => setError('Could not load the related challenge.'));
  }, [challengeParam]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onDistrictChange(district) {
    set('district', district);
    // prefill approximate coordinates from the district centroid
    const c = DISTRICT_COORDS[district];
    if (c && !coords) setCoords({ lat: c[0], lng: c[1], source: 'district' });
  }

  async function useMyLocation() {
    setIsLocating(true);
    setLocMessage('');
    try {
      const pos = await getCurrentPosition();
      setCoords({
        lat: Number(pos.coords.latitude.toFixed(4)),
        lng: Number(pos.coords.longitude.toFixed(4)),
        source: 'gps',
      });
    } catch (err) {
      setLocMessage(`${describeGeoError(err)} District area will be used instead.`);
    } finally {
      setIsLocating(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        district: form.district,
        language: form.language,
        radius: form.radius,
        relatedChallenge: challenge?._id || undefined,
        location:
          coords && coords.source === 'gps'
            ? { type: 'Point', coordinates: [coords.lng, coords.lat] }
            : undefined,
      };
      const res = await createDiscussion(payload);
      navigate(`/samvaad/${res.discussion._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create the discussion.');
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">Start a Local Samvaad Discussion</h1>
      <p className="mt-1 text-sm text-gray-500">
        Bring neighbours together around a local problem. Exact locations are never shown publicly.
      </p>

      {challenge && (
        <div className="mt-5 rounded-xl border border-johar-green-600/20 bg-johar-green-50 p-4 text-sm">
          <span className="font-semibold">Related Challenge: </span>
          <Link to={`/challenges/${challenge._id}`} className="font-medium text-johar-green-700 hover:underline">
            {challenge.title}
          </Link>
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Title *</label>
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g., Irregular water supply in Harmu housing colony"
            className={`mt-1 ${inputClass}`}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Description *</label>
          <textarea
            required
            rows={5}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Explain the local issue, share what you know and what you'd like to discuss..."
            className={`mt-1 ${inputClass}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Category *</label>
            <select
              required
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className={`mt-1 ${inputClass}`}
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
            <label className="text-sm font-medium">District *</label>
            <select
              required
              value={form.district}
              onChange={(e) => onDistrictChange(e.target.value)}
              className={`mt-1 ${inputClass}`}
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
            <label className="text-sm font-medium">Discussion language</label>
            <select
              value={form.language}
              onChange={(e) => set('language', e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Local scope</label>
            <select
              value={form.radius}
              onChange={(e) => set('radius', e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              {[1, 5, 10, 25].map((r) => (
                <option key={r} value={r}>
                  Within {r} km
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Location privacy notice */}
        <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
          <p className="font-medium">Location (optional)</p>
          {coords ? (
            <p className="mt-1">
              Using{' '}
              {coords.source === 'gps'
                ? 'your current general area'
                : `the centre of ${form.district || 'the selected district'}`}
              . Only “Near {form.district || 'your district'}” will be shown publicly.
            </p>
          ) : (
            <p className="mt-1">
              Add a rough location so neighbours can find this discussion nearby.
            </p>
          )}
          {coords?.source !== 'gps' && (
            <button
              type="button"
              onClick={useMyLocation}
              disabled={isLocating}
              className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 font-medium hover:border-johar-green-700 hover:text-johar-green-700 disabled:opacity-50"
            >
              {isLocating ? 'Detecting...' : '📍 Use my current location'}
            </button>
          )}
          {locMessage && <p className="mt-2 text-amber-600">{locMessage}</p>}
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-johar-green-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-johar-green-600 disabled:opacity-40"
        >
          {isSubmitting ? 'Creating...' : 'Create Discussion'}
        </button>
      </form>
    </section>
  );
}
