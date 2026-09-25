import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import ThemeToggle from '../components/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const drawerLinkClass = ({ isActive }) =>
  `block border-2 border-transparent px-3 py-2 text-sm font-bold uppercase tracking-wide transition-all ${
    isActive
      ? '-rotate-1 border-nb-ink bg-nb-yellow text-nb-ink shadow-[2px_2px_0_#111]'
      : 'text-gray-700 hover:-translate-y-0.5 hover:border-nb-ink hover:bg-white hover:text-nb-ink'
  }`;

export default function RootLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  function onLogout() {
    logout();
    closeMenu();
    navigate('/');
  }

  return (
    <div className="flex min-h-screen flex-col bg-nb-cream text-nb-ink">
      <header className="sticky top-0 z-40 border-b-[3px] border-nb-ink bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6">
          <Link to="/" className="group flex shrink-0 items-center gap-2" onClick={closeMenu}>
            <span className="-rotate-2 border-[3px] border-nb-ink bg-johar-green-700 px-2.5 py-0.5 font-display text-xl tracking-tight text-white shadow-[4px_4px_0_#111] transition-transform group-hover:rotate-0 group-hover:scale-105">
              JOHAR
            </span>
            <span className="hidden font-display text-sm uppercase text-johar-earth-700 xl:inline">
              झारखंड
            </span>
          </Link>

          {/* Right cluster — compact: theme + auth actions + hamburger */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {!isAuthenticated && (
              <>
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="hidden bg-white px-3 py-1.5 text-sm font-bold text-nb-ink sm:block"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="hidden border-2 border-nb-ink bg-johar-green-600 px-3.5 py-1.5 text-sm font-bold text-white shadow-[3px_3px_0_#111] transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#111] sm:block"
                >
                  Register
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              title="Menu"
              className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] bg-nb-yellow"
            >
              {/* top line */}
              <span
                className={`block h-[3px] w-6 border-0! bg-nb-ink shadow-none! transition-all duration-300 ${
                  menuOpen ? 'translate-y-[8px] rotate-45' : ''
                }`}
              />
              {/* middle line */}
              <span
                className={`block h-[3px] w-6 bg-nb-ink transition-all duration-200 ${
                  menuOpen ? 'scale-x-0 opacity-0' : ''
                }`}
              />
              {/* bottom line */}
              <span
                className={`block h-[3px] w-6 border-0! bg-nb-ink shadow-none! transition-all duration-300 ${
                  menuOpen ? '-translate-y-[8px] -rotate-45' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <div
        onClick={closeMenu}
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Slide-in drawer */}
      <nav
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-xs flex-col overflow-y-auto border-l-[3px] border-nb-ink bg-nb-cream transition-transform duration-300 ease-out ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!menuOpen}
      >
        <div className="flex items-center justify-between border-b-[3px] border-nb-ink bg-white px-4 py-3">
          <span className="font-display text-sm uppercase tracking-widest text-johar-earth-700">
            Menu
          </span>
          <button
            type="button"
            onClick={closeMenu}
            aria-label="Close menu"
            className="bg-white px-2 py-1 text-sm font-bold text-nb-ink"
          >
            ✕
          </button>
        </div>

        <div
          className={`flex flex-col gap-1.5 px-4 py-4 transition-all duration-300 ${
            menuOpen ? 'translate-x-0 opacity-100 delay-75' : 'translate-x-6 opacity-0'
          }`}
        >
          <NavLink to="/" className={drawerLinkClass} end onClick={closeMenu}>
            Home
          </NavLink>
          <NavLink to="/challenges" className={drawerLinkClass} onClick={closeMenu}>
            Explore Problems
          </NavLink>
          <NavLink to="/samvaad" className={drawerLinkClass} onClick={closeMenu}>
            Local Samvaad
          </NavLink>
          <NavLink to="/universities" className={drawerLinkClass} onClick={closeMenu}>
            Universities
          </NavLink>
          <NavLink to="/industries" className={drawerLinkClass} onClick={closeMenu}>
            Industries & Startups
          </NavLink>
          <NavLink to="/projects" className={drawerLinkClass} onClick={closeMenu}>
            Projects
          </NavLink>
          <NavLink to="/local-projects" className={drawerLinkClass} onClick={closeMenu}>
            Track Local Work
          </NavLink>
          <NavLink to="/solutions" className={drawerLinkClass} onClick={closeMenu}>
            Solutions
          </NavLink>

          {isAuthenticated ? (
            <>
              <div className="mt-3 border-t-2 border-dashed border-gray-300 pt-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Your actions
              </div>
              <NavLink to="/report" className={drawerLinkClass} onClick={closeMenu}>
                Report Problem
              </NavLink>
              <NavLink to="/my-reports" className={drawerLinkClass} onClick={closeMenu}>
                My Reports
              </NavLink>
              {user?.role === 'university' && (
                <NavLink to="/university/challenges" className={drawerLinkClass} onClick={closeMenu}>
                  University Challenges
                </NavLink>
              )}
              {user?.role === 'industry' && (
                <NavLink to="/industry/projects" className={drawerLinkClass} onClick={closeMenu}>
                  Industry Projects
                </NavLink>
              )}
              {(user?.role === 'government' || user?.role === 'admin') && (
                <>
                  <NavLink to="/admin/dashboard" className={drawerLinkClass} onClick={closeMenu}>
                    Gov Dashboard
                  </NavLink>
                  <NavLink to="/government/hierarchy" className={drawerLinkClass} onClick={closeMenu}>
                    Government Hierarchy
                  </NavLink>
                </>
              )}
              <div className="mt-3 border-t-2 border-dashed border-gray-300 pt-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Account
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-block border-2 border-nb-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-[2px_2px_0_#111] ${
                    user?.role === 'admin'
                      ? 'bg-nb-pink text-nb-ink'
                      : user?.role === 'government'
                        ? 'bg-nb-blue text-nb-ink'
                        : 'bg-white text-gray-600'
                  }`}
                >
                  {user?.role === 'government' ? 'Government Official' : user?.role}
                </span>
              </div>
              <NavLink to="/dashboard" className={drawerLinkClass} onClick={closeMenu}>
                Profile ({user?.name})
              </NavLink>
              <button
                type="button"
                onClick={onLogout}
                className="mt-1 w-full border-2 border-nb-ink bg-white px-3 py-2 text-left text-sm font-bold text-red-600 shadow-[3px_3px_0_#111] transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#111]"
              >
                Logout
              </button>
            </>
          ) : (
            <div className="mt-3 flex flex-col gap-2 border-t-2 border-dashed border-gray-300 pt-3 sm:hidden">
              <Link
                to="/login"
                onClick={closeMenu}
                className="w-full border-2 border-nb-ink bg-white px-3 py-2 text-center text-sm font-bold text-nb-ink shadow-[3px_3px_0_#111]"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={closeMenu}
                className="w-full border-2 border-nb-ink bg-johar-green-600 px-3 py-2 text-center text-sm font-bold text-white shadow-[3px_3px_0_#111]"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t-[3px] border-nb-ink bg-nb-ink py-10 text-nb-cream">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="rotate-[-1deg] inline-block border-[3px] border-nb-cream bg-nb-yellow px-3 py-1 font-display text-lg text-nb-ink shadow-[4px_4px_0_rgba(255,255,255,0.35)]">
              JOHAR · झारखंड
            </span>
            <p className="max-w-md text-sm text-white/70">
              A digital platform to crowdsource societal challenges and facilitate collaborative
              problem solving through universities and industry partnerships.
            </p>
            <p className="text-xs uppercase tracking-widest text-white/40">
              Citizens × Universities × Industry × Government
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
