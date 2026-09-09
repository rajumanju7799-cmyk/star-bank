import { createClient, type Session, type User } from '@supabase/supabase-js';

const AUTH_USERS_KEY = 'starbank_auth_users';
const AUTH_SESSION_KEY = 'starbank_auth_session';
const ACTIVE_ACCOUNT_KEY = 'starbank_active_account';

type LocalUser = {
  password: string;
  createdAt: string;
  activated: boolean;
};

type LocalUsersMap = Record<string, LocalUser>;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseEnabled = () => Boolean(supabase);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const readLocalUsers = (): LocalUsersMap => {
  const raw = localStorage.getItem(AUTH_USERS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as LocalUsersMap;
  } catch {
    return {};
  }
};

const writeLocalUsers = (users: LocalUsersMap) => {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
};

export const getSessionEmail = (): string | null => {
  return localStorage.getItem(AUTH_SESSION_KEY);
};

export const clearSession = async () => {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  if (supabase) {
    await supabase.auth.signOut();
  }
};

export const registerWithEmail = async (email: string, password: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> => {
  const normalized = normalizeEmail(email);

  if (supabase) {
    const { error } = await supabase.auth.signUp({
      email: normalized,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, message: 'Activation email sent. Please verify your email before login.' };
  }

  const users = readLocalUsers();
  if (users[normalized]) {
    return { ok: false, error: 'Email already registered. Please login.' };
  }

  users[normalized] = {
    password,
    createdAt: new Date().toISOString(),
    activated: false,
  };
  writeLocalUsers(users);

  return {
    ok: true,
    message: 'Demo mode: activation email is simulated. Click "Activate Demo Account" to continue.',
  };
};

export const activateLocalDemoAccount = (email: string): { ok: true } | { ok: false; error: string } => {
  const normalized = normalizeEmail(email);
  const users = readLocalUsers();
  if (!users[normalized]) {
    return { ok: false, error: 'Account not found.' };
  }
  users[normalized].activated = true;
  writeLocalUsers(users);
  return { ok: true };
};

export const loginWithEmail = async (email: string, password: string): Promise<{ ok: true; email: string } | { ok: false; error: string; needsVerification?: boolean }> => {
  const normalized = normalizeEmail(email);

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) {
      return { ok: false, error: error.message };
    }

    const session: Session | null = data.session;
    const user: User | undefined = session?.user;

    if (!user?.email_confirmed_at) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error: 'Please verify your email first. Check your inbox for activation email.',
        needsVerification: true,
      };
    }

    localStorage.setItem(AUTH_SESSION_KEY, normalized);
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, normalized);
    return { ok: true, email: normalized };
  }

  const users = readLocalUsers();
  const user = users[normalized];
  if (!user || user.password !== password) {
    return { ok: false, error: 'Invalid email or password.' };
  }
  if (!user.activated) {
    return {
      ok: false,
      error: 'Please activate this account first (demo mode).',
      needsVerification: true,
    };
  }

  localStorage.setItem(AUTH_SESSION_KEY, normalized);
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, normalized);
  return { ok: true, email: normalized };
};

export const resendActivationEmail = async (email: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> => {
  const normalized = normalizeEmail(email);

  if (supabase) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalized,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, message: 'Activation email resent.' };
  }

  return { ok: true, message: 'Demo mode: use "Activate Demo Account" to complete activation.' };
};

