import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getUniversity } from '../services/universityService.js';
import { useAuth } from '../context/AuthContext.jsx';

function TagList({ title, items, color = 'bg-johar-green-50 text-johar-green-700' }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className={`rounded-full px-3 py-1 text-xs font-medium ${color}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function UniversityDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [university, setUniversity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getUniversity(id)
      .then((res) => !cancelled && setUniversity(res.university))
      .catch((err) =>
        !cancelled && setError(err.response?.data?.message || 'Failed to load university.')
      )
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) return <p className="py-24 text-center text-gray-500">Loading university...</p>;
  if (error)
    return (
      <div className="py-24 text-center">
        <p className="text-red-600">{error}</p>
        <Link to="/universities" className="mt-4 inline-block text-johar-green-700 hover:underline">
          Back to universities
        </Link>
      </div>
    );

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link to="/universities" className="text-sm text-gray-500 hover:text-johar-green-700">
        ← All Universities
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{university.name}</h1>
          <p className="mt-2 max-w-2xl text-gray-600">{university.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {university.verificationStatus === 'verified' ? (
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              Officially Verified
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize text-gray-500">
              {university.verificationStatus}
            </span>
          )}
          {(user?.role === 'admin' ||
            (user?.role === 'university' && user?._id === String(university.createdBy))) && (
            <Link
              to="/university/challenges"
              className="rounded-lg bg-johar-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-johar-green-600"
            >
              View Assigned Challenges
            </Link>
          )}
        </div>
      </header>

      {(university.districtsCovered?.length > 0 || university.address) && (
        <p className="mt-3 text-sm text-gray-500">
          {[university.address, (university.districtsCovered || []).join(', ')]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <div className="mt-8 space-y-8">
        <TagList title="Departments" items={university.departments} />
        <TagList title="Research Areas" items={university.researchAreas} />
        <TagList title="Expertise" items={university.expertise} color="bg-johar-earth-50 text-johar-earth-700" />
        <TagList title="Facilities & Labs" items={university.facilities} color="bg-blue-50 text-blue-700" />
      </div>

      {university.facultyMembers?.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold">Faculty</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {university.facultyMembers.map((f, i) => (
              <li key={i} className="rounded-lg border border-gray-100 p-4 text-sm">
                <p className="font-medium">{f.user?.name || 'Faculty member'}</p>
                <p className="text-xs text-gray-500">
                  {[f.designation, f.department].filter(Boolean).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {university.previousProjects?.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold">Previous Projects</h2>
          <ul className="mt-3 space-y-3">
            {university.previousProjects.map((p, i) => (
              <li key={i} className="rounded-lg bg-johar-earth-50/60 p-4 text-sm">
                <p className="font-medium">
                  {p.title}
                  {p.year ? ` (${p.year})` : ''}
                </p>
                {p.description && <p className="mt-1 text-gray-600">{p.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {user && university.contactInformation && (
        <section className="mt-10 rounded-xl bg-gray-50 p-5 text-sm">
          <h2 className="font-semibold">Contact</h2>
          <ul className="mt-2 space-y-1 text-gray-600">
            {university.contactInformation.email && <li>Email: {university.contactInformation.email}</li>}
            {university.contactInformation.phone && <li>Phone: {university.contactInformation.phone}</li>}
            {university.contactInformation.website && <li>Web: {university.contactInformation.website}</li>}
          </ul>
        </section>
      )}
    </article>
  );
}
