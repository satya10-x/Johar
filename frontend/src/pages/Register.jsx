import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

const SELF_REGISTRATION_ROLES = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'university', label: 'University' },
  { value: 'industry', label: 'Industry / Startup' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'citizen',
    district: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password.length < 8 || !/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      setError('Password must be at least 8 characters and contain letters and numbers.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <span className="nb-sticker mb-4 inline-block rotate-1 bg-nb-yellow px-3 py-1 text-xs uppercase tracking-wide">
        Join the movement
      </span>
      <h1 className="font-display text-3xl uppercase">Create your JOHAR account</h1>

      {error && (
        <p className="mt-4 border-2 border-nb-ink bg-red-100 px-4 py-3 text-sm font-bold text-red-700 shadow-[3px_3px_0_#111]">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {[
          { name: 'name', label: 'Full Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone (optional)', type: 'tel', required: false },
          { name: 'district', label: 'District (optional)', type: 'text', required: false },
        ].map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name} className="block text-sm font-bold uppercase tracking-wide text-gray-700">
              {field.label}
            </label>
            <input
              id={field.name}
              name={field.name}
              type={field.type}
              required={field.required}
              value={form[field.name]}
              onChange={onChange}
              className="mt-1 w-full bg-white px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none"
            />
          </div>
        ))}

        <div>
          <label htmlFor="role" className="block text-sm font-bold uppercase tracking-wide text-gray-700">
            I am a
          </label>
          <select
            id="role"
            name="role"
            value={form.role}
            onChange={onChange}
            className="mt-1 w-full bg-white px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none"
          >
            {SELF_REGISTRATION_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-bold uppercase tracking-wide text-gray-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={form.password}
            onChange={onChange}
            className="mt-1 w-full bg-white px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            Minimum 8 characters with letters and numbers.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-johar-green-600 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Creating account...' : 'Register'}
        </button>
      </form>

      <p className="mt-6 border-2 border-nb-ink bg-white p-3 text-center text-sm text-gray-600 shadow-[3px_3px_0_#111]">
        Already have an account?{' '}
        <Link to="/login" className="font-bold text-johar-green-700 underline hover:text-johar-green-600">
          Log in
        </Link>
      </p>
    </section>
  );
}
