import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getIndustry } from '../services/industryService.js';
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

export default function IndustryDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [industry, setIndustry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getIndustry(id)
      .then((res) => !cancelled && setIndustry(res.industry))
      .catch((err) =>
        !cancelled && setError(err.response?.data?.message || 'Failed to load company.')
      )
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) return <p className="py-24 text-center text-gray-500">Loading company...</p>;
  if (error)
    return (
      <div className="py-24 text-center">
        <p className="text-red-600">{error}</p>
        <Link to="/industries" className="mt-4 inline-block text-johar-green-700 hover:underline">
          Back to industries
        </Link>
      </div>
    );

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link to="/industries" className="text-sm text-gray-500 hover:text-johar-green-700">
        ← All Industries
      </Link>

      <header className="mt-5">
        <span className="text-xs font-medium uppercase tracking-wide text-johar-earth-700">
          {String(industry.companyType).replace(/_/g, ' ')}
        </span>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-bold">{industry.companyName}</h1>
          {industry.verificationStatus === 'verified' ? (
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              Verified
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize text-gray-500">
              {industry.verificationStatus}
            </span>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-gray-600">{industry.description}</p>
        {industry.address && <p className="mt-2 text-sm text-gray-500">{industry.address}</p>}
      </header>

      <div className="mt-8 space-y-8">
        <TagList title="Industries Served" items={industry.industries} />
        <TagList title="Expertise" items={industry.expertise} color="bg-johar-earth-50 text-johar-earth-700" />
        <TagList title="Technologies" items={industry.technologies} color="bg-blue-50 text-blue-700" />
        <TagList
          title="Collaboration Types"
          items={(industry.collaborationTypes || []).map((c) => String(c).replace(/_/g, ' '))}
          color="bg-purple-50 text-purple-700"
        />
      </div>

      {user && industry.fundingCapacity && (
        <section className="mt-8 rounded-xl bg-gray-50 p-5 text-sm">
          <h2 className="font-semibold">Funding Capacity</h2>
          <p className="mt-1 text-gray-600 capitalize">
            {(industry.fundingCapacity.currency || 'INR')}{' '}
            {industry.fundingCapacity.min?.toLocaleString('en-IN') ?? '?'} –{' '}
            {industry.fundingCapacity.max?.toLocaleString('en-IN') ?? '?'}
          </p>
        </section>
      )}

      {industry.previousCollaborations?.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold">Previous Collaborations</h2>
          <ul className="mt-3 space-y-3">
            {industry.previousCollaborations.map((p, i) => (
              <li key={i} className="rounded-lg bg-johar-earth-50/60 p-4 text-sm">
                <p className="font-medium">
                  {p.title}
                  {p.year ? ` (${p.year})` : ''}
                </p>
                {p.partner && <p className="text-xs text-gray-500">with {p.partner}</p>}
                {p.description && <p className="mt-1 text-gray-600">{p.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {user && industry.contactInformation && (
        <section className="mt-10 rounded-xl bg-gray-50 p-5 text-sm">
          <h2 className="font-semibold">Contact</h2>
          <ul className="mt-2 space-y-1 text-gray-600">
            {industry.contactInformation.email && <li>Email: {industry.contactInformation.email}</li>}
            {industry.contactInformation.phone && <li>Phone: {industry.contactInformation.phone}</li>}
            {industry.contactInformation.website && <li>Web: {industry.contactInformation.website}</li>}
          </ul>
        </section>
      )}
    </article>
  );
}
