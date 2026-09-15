import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold">
        Welcome, {user?.name}
      </h1>
      <p className="mt-2 text-gray-600">
        You are logged in as <span className="font-medium capitalize">{user?.role}</span>.
      </p>
      <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
        Your {user?.role} dashboard is coming soon.
      </div>
    </section>
  );
}
