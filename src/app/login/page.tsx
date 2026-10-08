'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ArrowRight, Cpu, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace('/');
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause
        ? String(cause.code)
        : '';
      const messages: Record<string, string> = {
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/user-not-found': 'No account was found for this email.',
        'auth/wrong-password': 'The email or password is incorrect.',
        'auth/invalid-credential': 'The email or password is incorrect.',
        'auth/email-already-in-use': 'An account already exists for this email. Sign in instead.',
        'auth/weak-password': 'Choose a password with at least 6 characters.',
        'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
        'auth/operation-not-allowed': 'Email and password sign-in is disabled in Firebase Authentication settings.',
      };
      setError(messages[code] || (cause instanceof Error ? cause.message : 'Authentication failed. Please try again.'));
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign-in could not be started. Please try again.');
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
          <p className="text-sm font-medium text-blue-400">Welcome {mode === 'signin' ? 'back' : 'to ArchOS'}</p>
          <h2 className="mt-2 text-2xl font-semibold">{mode === 'signin' ? 'Sign in to your workspace' : 'Create your account'}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Use your email and password, or continue securely with Google.</p>

          {error && <div role="alert" className="mt-5 rounded-xl border border-red-900/70 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}

          <form onSubmit={handleEmailAuth} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              Email address
              <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </label>
            <label className="block text-sm font-medium text-slate-300">
              Password
              <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </label>
            <button type="submit" disabled={submitting || loading} className="flex w-full items-center justify-between rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-wait disabled:opacity-60">
              <span>{submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in with email' : 'Create account'}</span>
              {!submitting && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-600"><span className="h-px flex-1 bg-slate-800" /><span>OR</span><span className="h-px flex-1 bg-slate-800" /></div>

          <button type="button" onClick={() => void handleGoogleSignIn()} disabled={submitting || loading} className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-sm font-semibold transition hover:border-slate-500 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-wait disabled:opacity-60">
            <span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-900">G</span>Continue with Google</span>
            <ArrowRight size={17} className="text-slate-400" />
          </button>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'signin' ? 'New to ArchOS?' : 'Already have an account?'}{' '}
            <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }} className="font-semibold text-blue-400 hover:text-blue-300">
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
