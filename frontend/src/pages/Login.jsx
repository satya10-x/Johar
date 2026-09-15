import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(form);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <span className="nb-sticker mb-4 inline-block -rotate-2 bg-nb-blue px-3 py-1 text-xs uppercase tracking-wide">
        Welcome back
      </span>
      <h1 className="font-display text-3xl uppercase">Log in to JOHAR</h1>

      {error && (
        <p className="mt-4 border-2 border-nb-ink bg-red-100 px-4 py-3 text-sm font-bold text-red-700 shadow-[3px_3px_0_#111]">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-bold uppercase tracking-wide text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={onChange}
            className="mt-1 w-full bg-white px-3 py-2 text-sm focus:border-johar-green-700 focus:outline-none"
          />
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
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-johar-green-600 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <p className="mt-6 border-2 border-nb-ink bg-white p-3 text-center text-sm text-gray-600 shadow-[3px_3px_0_#111]">
        Don't have an account?{' '}
        <Link to="/register" className="font-bold text-johar-green-700 underline hover:text-johar-green-600">
          Register
        </Link>
      </p>
    </section>
  );
}
