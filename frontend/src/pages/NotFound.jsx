import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-3 text-gray-600">This page does not exist.</p>
      <Link
        to="/"
        className="mt-8 rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-johar-green-700 hover:text-johar-green-700"
      >
        Back to Home
      </Link>
    </section>
  );
}
