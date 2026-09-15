import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import api from '../services/api.js';

import heroVideo from '../assets/videos/The land of forests - Jharkhand Tourism_1080p.mp4';
import imgPatratu from '../assets/images/patratu-valley-ranchi-jharkhand-1-hero.jpeg';
import imgRanchi from '../assets/images/3753-8-Ranchi-Best-Tourist-Places-in-Jharkhand-Jharkhand-Tourism.jpg';
import imgForest1 from '../assets/images/images.jpeg';
import imgForest2 from '../assets/images/images (1).jpeg';
import imgAvif from '../assets/images/photo-1609991148865-40902bd1f594.avif';

const DEFAULT_STATS = {
  problemsReported: 0,
  problemsBeingSolved: 0,
  communitiesInvolved: 0,
  solutionsCreated: 0,
};

const GALLERY = [
  { src: imgPatratu, label: 'Patratu Valley', accent: 'bg-nb-yellow' },
  { src: imgRanchi, label: 'Ranchi', accent: 'bg-nb-pink' },
  { src: imgForest1, label: 'Forests & Falls', accent: 'bg-nb-blue' },
  { src: imgForest2, label: 'Our Communities', accent: 'bg-johar-green-100' },
  { src: imgAvif, label: 'Jharkhand Rising', accent: 'bg-white' },
];

export default function Home() {
  const [stats, setStats] = useState(DEFAULT_STATS);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/challenges/stats')
      .then((res) => !cancelled && setStats({ ...DEFAULT_STATS, ...res.data.stats }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const statCards = [
    { label: 'Problems Reported', value: stats.problemsReported, accent: 'bg-nb-yellow' },
    { label: 'Being Solved', value: stats.problemsBeingSolved, accent: 'bg-nb-blue' },
    { label: 'Communities Involved', value: stats.communitiesInvolved, accent: 'bg-nb-pink' },
    { label: 'Solutions Created', value: stats.solutionsCreated, accent: 'bg-johar-green-100' },
  ];

  return (
    <div>
      {/* Hero — Jharkhand video behind a bold framed panel */}
      <section className="relative overflow-hidden border-b-[3px] border-nb-ink">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          src={heroVideo}
        />
        {/* cinematic dark scrim only — keeps the video clearly visible */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/55" />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="nb-sticker mb-6 rotate-[-2deg] bg-nb-pink px-4 py-1 text-sm uppercase tracking-wide shadow-[4px_4px_0_rgba(0,0,0,0.85)]">
            झारखंड · Made for Jharkhand
          </span>

          <h1 className="max-w-3xl font-display text-4xl leading-tight text-white [text-shadow:3px_3px_0_#111,6px_6px_0_rgba(0,0,0,0.55)] sm:text-5xl md:text-6xl">
            SPOT A PROBLEM.
            <br />
            JOHAR SOLVES IT{' '}
            <span className="inline-block rotate-2">TOGETHER.</span>
          </h1>

          <p className="mt-8 max-w-2xl border-y-[3px] border-nb-ink bg-white/90 py-3 text-base font-medium text-gray-800 shadow-[4px_4px_0_rgba(0,0,0,0.85)] dark:text-gray-100 sm:text-lg">
            Report the problems in your community. JOHAR connects citizens, universities,
            students, faculty, industries and startups across Jharkhand to understand and solve
            local societal challenges — together.
          </p>

          <div className="mt-9 flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
            <Link
              to="/report"
              className="nb-btn-primary px-8 py-3.5 text-center text-base uppercase tracking-wide"
            >
              Report a Problem →
            </Link>
            <Link
              to="/challenges"
              className="nb-btn-accent px-8 py-3.5 text-center text-base uppercase tracking-wide transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_#111]"
            >
              Explore Problems
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex items-center justify-center gap-3">
          <span className="hidden h-1 w-10 bg-nb-ink sm:block" />
          <h2 className="font-display text-2xl uppercase sm:text-3xl">The movement so far</h2>
          <span className="hidden h-1 w-10 bg-nb-ink sm:block" />
        </div>

        <div className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="nb-card nb-card-hover p-0">
              <div className={`h-3 border-b-[3px] border-nb-ink ${card.accent}`} />
              <div className="p-6 text-center">
                <p className="font-display text-4xl">{card.value}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  {card.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y-[3px] border-nb-ink bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-2xl uppercase sm:text-3xl">
            How JOHAR works
          </h2>
          <p className="mt-2 text-center text-sm font-medium text-gray-500">
            From citizen voice to real-world impact
          </p>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'REPORT',
                accent: 'bg-nb-yellow',
                rotate: 'md:-rotate-1',
                text: 'Citizens describe a local problem — with photos, location and district.',
              },
              {
                step: '02',
                title: 'UNDERSTAND',
                accent: 'bg-nb-blue',
                rotate: 'md:rotate-1',
                text: 'AI-assisted analysis highlights severity and priority; the community validates it.',
              },
              {
                step: '03',
                title: 'SOLVE',
                accent: 'bg-nb-pink',
                rotate: 'md:-rotate-1',
                text: 'Universities, students and industry collaborate on real solutions — and measure impact.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className={`nb-card nb-card-hover p-6 ${item.rotate} transition-transform hover:rotate-0`}
              >
                <span
                  className={`inline-block -rotate-3 border-[3px] border-nb-ink ${item.accent} px-3 py-1 font-display text-lg shadow-[3px_3px_0_#111]`}
                >
                  {item.step}
                </span>
                <h3 className="mt-4 text-xl uppercase">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery strip */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl uppercase sm:text-3xl">
          The land we're <span className="nb-highlight">building for</span>
        </h2>
        <p className="mt-2 max-w-xl text-sm text-gray-600">
          Forests, valleys, cities and villages — every challenge reported here belongs to this
          land, and every solution comes from its people.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {GALLERY.map((g, i) => (
            <figure
              key={g.label}
              className={`nb-card nb-card-hover overflow-hidden ${i % 2 ? 'rotate-1' : '-rotate-1'} transition-transform hover:rotate-0`}
            >
              <img src={g.src} alt={g.label} className="aspect-square w-full object-cover" loading="lazy" />
              <figcaption
                className={`border-t-[3px] border-nb-ink ${g.accent} px-2 py-1.5 text-center text-xs font-bold uppercase`}
              >
                {g.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Final CTA band */}
      <section className="border-t-[3px] border-nb-ink bg-johar-green-700 py-14 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center sm:px-6">
          <h2 className="font-display text-2xl uppercase sm:text-3xl">
            Your street. Your district. Your solution.
          </h2>
          <p className="max-w-xl text-sm text-white/80">
            Join thousands of citizens, students and partners turning local problems into
            measurable social impact across Jharkhand.
          </p>
          <Link
            to="/register"
            className="-rotate-1 border-[3px] border-nb-ink bg-nb-yellow px-8 py-3 font-display text-sm uppercase tracking-wide text-nb-ink shadow-[6px_6px_0_#111] transition-all hover:rotate-0 hover:-translate-y-0.5 hover:shadow-[9px_9px_0_#111]"
          >
            Join JOHAR →
          </Link>
        </div>
      </section>
    </div>
  );
}
