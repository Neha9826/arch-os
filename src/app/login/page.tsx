'use client';

import { useState } from 'react';
import { signInWithRedirect } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ArrowRight, Cpu, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase';

export default function Login() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
      // Firebase redirects back to this route and AuthContext resolves the session.
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in could not be started. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-12 text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute bottom-[-15rem] right-[-8rem] h-[30rem] w-[30rem] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/30 md:grid-cols-2">
        <section className="flex flex-col justify-between border-b border-slate-800 p-8 sm:p-12 md:border-b-0 md:border-r">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30"><Cpu size={23} /></span>
              <span className="text-xl font-bold tracking-tight">arch-os</span>
            </div>
            <p className="mt-16 text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">Engineering workspace</p>
            <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">From system design to delivery.</h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">Plan projects, record engineering decisions, map architecture, and keep delivery work connected in one workspace.</p>
          </div>
          <div className="mt-12 flex items-center gap-3 text-xs text-slate-500">
            <ShieldCheck size={17} className="text-emerald-400" />
            <span>Private workspace access · Sessions expire after 24 hours</span>
          </div>
        </section>

        <section className="flex flex-col justify-center p-8 sm:p-12">
          <p className="text-sm font-medium text-blue-400">Welcome back</p>
          <h2 className="mt-2 text-2xl font-semibold">Sign in to ArchOS</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Use your Google account to access your projects and architecture workspaces.</p>

          {error && <div role="alert" className="mt-6 rounded-xl border border-red-900/70 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={submitting}
            className="mt-8 flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-sm font-semibold transition hover:border-slate-500 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-900">G</span>
              {submitting ? 'Redirecting to Google…' : 'Continue with Google'}
            </span>
            {!submitting && <ArrowRight size={17} className="text-slate-400" />}
          </button>
          <p className="mt-5 text-center text-xs leading-5 text-slate-500">You’ll be redirected to Google to authenticate securely.</p>
        </section>
      </div>
    </main>
  );
}
