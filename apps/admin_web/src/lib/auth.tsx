'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
  type AuthError,
} from 'firebase/auth';
import { ensureAdminAccess } from './adminAccess';
import { firebaseProjectLabel, getFirebaseAuth, useEmulators } from './firebase';
import { logError, logInfo, timed } from './logger';

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  adminReady: boolean;
  adminRoles: string[];
  adminError: string | null;
  projectLabel: string;
  usingEmulators: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshAdminAccess: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function mapAuthError(err: unknown): string {
  const code = (err as AuthError)?.code;
  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found for that email. Create one first.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists for that email. Sign in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Popup blocked — retrying with full-page Google redirect.';
    case 'auth/unauthorized-domain': {
      const host =
        typeof window !== 'undefined' ? window.location.hostname : 'this host';
      return (
        `Domain "${host}" is not authorized. In Firebase Console → Authentication → Settings → Authorized domains, add: ${host}, localhost, and 127.0.0.1. Then use http://localhost:3000/login (not 127.0.0.1).`
      );
    }
    case 'auth/operation-not-allowed':
      return 'This sign-in method is disabled in Firebase Console (enable Email/Password and Google).';
    case 'auth/network-request-failed':
      return 'Network error talking to Firebase. Check .env.local (live config, USE_EMULATORS=false) and your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    default:
      return (err as Error)?.message ?? 'Authentication failed.';
  }
}

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  provider.addScope('email');
  provider.addScope('profile');
  return provider;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminReady, setAdminReady] = useState(false);
  const [adminRoles, setAdminRoles] = useState<string[]>([]);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);

  const refreshAdminAccess = useCallback(async () => {
    setAdminBusy(true);
    setAdminError(null);
    try {
      const result = await ensureAdminAccess();
      setAdminRoles(result.roles ?? ['ADMIN_SUPER']);
      setAdminReady(true);
    } catch (e) {
      setAdminReady(false);
      setAdminRoles([]);
      setAdminError(
        e instanceof Error
          ? e.message
          : 'Could not grant admin access for this account.',
      );
      throw e;
    } finally {
      setAdminBusy(false);
    }
  }, []);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    try {
      const auth = getFirebaseAuth();

      getRedirectResult(auth)
        .catch((e) => {
          setError(mapAuthError(e));
        })
        .finally(() => {
          // Auth state listener below is source of truth for user.
        });

      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
        if (!u) {
          setAdminReady(false);
          setAdminRoles([]);
          setAdminError(null);
          return;
        }
        logInfo('auth_state', { uid: u.uid.slice(0, 8), signedIn: true });
        setAdminBusy(true);
        ensureAdminAccess()
          .then((result) => {
            if (cancelled) return;
            setAdminRoles(result.roles ?? ['ADMIN_SUPER']);
            setAdminReady(true);
            setAdminError(null);
          })
          .catch((e) => {
            if (cancelled) return;
            setAdminReady(false);
            setAdminRoles([]);
            setAdminError(
              e instanceof Error
                ? e.message
                : 'Could not grant admin access for this account.',
            );
          })
          .finally(() => {
            if (!cancelled) setAdminBusy(false);
          });
      });
    } catch (e) {
      const msg = mapAuthError(e);
      setError(msg);
      logError('auth_init_failed', { error: msg });
      setLoading(false);
    }
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await timed('admin_email_sign_in', () =>
        signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password),
      );
    } catch (e) {
      const msg = mapAuthError(e);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      setError(null);
      try {
        await timed('admin_email_sign_up', async () => {
          const cred = await createUserWithEmailAndPassword(
            getFirebaseAuth(),
            email.trim(),
            password,
          );
          const name = displayName.trim();
          if (name) {
            await updateProfile(cred.user, { displayName: name });
          }
        });
      } catch (e) {
        const msg = mapAuthError(e);
        setError(msg);
        throw new Error(msg);
      }
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    logInfo('admin_google_redirect_start');
    await signInWithRedirect(getFirebaseAuth(), googleProvider());
  }, []);

  const logout = useCallback(async () => {
    logInfo('admin_logout');
    await signOut(getFirebaseAuth());
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      user,
      loading:
        loading || (Boolean(user) && adminBusy && !adminReady && !adminError),
      error,
      adminReady,
      adminRoles,
      adminError,
      projectLabel: firebaseProjectLabel(),
      usingEmulators: useEmulators,
      signIn,
      signUp,
      signInWithGoogle,
      logout,
      clearError,
      refreshAdminAccess,
    }),
    [
      user,
      loading,
      adminBusy,
      adminReady,
      adminError,
      error,
      adminRoles,
      signIn,
      signUp,
      signInWithGoogle,
      logout,
      clearError,
      refreshAdminAccess,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requires AuthProvider');
  return ctx;
}
