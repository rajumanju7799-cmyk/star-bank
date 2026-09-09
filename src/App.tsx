import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Star, Settings, LogOut, Lock, UserCircle, MailCheck } from 'lucide-react';
import ParentMode from './pages/ParentMode';
import KidMode from './pages/KidMode';
import SettingsPage from './pages/SettingsPage';
import { useStarBankStore } from './store/starBankStore';
import BrandLogo from './components/BrandLogo';
import {
  activateLocalDemoAccount,
  clearSession,
  getSessionEmail,
  isSupabaseEnabled,
  loginWithEmail,
  registerWithEmail,
  resendActivationEmail,
} from './services/authService';

const DAILY_NOTICE_KEY_PREFIX = 'starbank_daily_notice';

function App() {
  const [mode, setMode] = useState<'parent' | 'kid' | 'settings' | 'login'>('login');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [sessionUser, setSessionUser] = useState<string | null>(() => getSessionEmail());
  const settings = useStarBankStore((state) => state.settings);
  const getTodayStars = useStarBankStore((state) => state.getTodayStars);
  const getTotalStars = useStarBankStore((state) => state.getTotalStars);
  const getWeeklyReport = useStarBankStore((state) => state.getWeeklyReport);

  useEffect(() => {
    // Check if there's a mode in URL params
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    if (urlMode === 'parent' || urlMode === 'kid') {
      setMode(urlMode as 'parent' | 'kid');
    }
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (!sessionUser || !settings.notificationsEnabled || typeof Notification === 'undefined') {
      return;
    }

    if (Notification.permission !== 'granted') {
      return;
    }

    const now = new Date();
    if (now.getHours() < settings.dailyNotificationHour) {
      return;
    }

    const dateKey = now.toISOString().split('T')[0];
    const noticeKey = `${DAILY_NOTICE_KEY_PREFIX}_${sessionUser}`;
    const alreadySentForToday = localStorage.getItem(noticeKey) === dateKey;
    if (alreadySentForToday) {
      return;
    }

    const todayStars = getTodayStars();
    const totalStars = getTotalStars();
    const weeklyData = getWeeklyReport();
    const weeklyTotal = Object.values(weeklyData).reduce<number>((sum, stars) => sum + Number(stars), 0);

    new Notification('Little Starts Bank Daily Update', {
      body: `Today: ${todayStars} stars. Week: ${weeklyTotal} stars. Lifetime: ${totalStars} stars.`,
      icon: '/star-bank-logo.png',
      badge: '/star-bank-logo.png',
    });
    localStorage.setItem(noticeKey, dateKey);
  }, [
    sessionUser,
    settings.notificationsEnabled,
    settings.dailyNotificationHour,
    getTodayStars,
    getTotalStars,
    getWeeklyReport,
  ]);

  const handleParentLogin = (enteredPin: string) => {
    if (enteredPin === settings.parentPin) {
      setMode('parent');
      setPinAttempts(0);
    } else {
      setPinAttempts((prev) => prev + 1);
    }
  };

  const handleLogout = () => {
    setMode('login');
    setPinAttempts(0);
  };

  const handleAccountLogout = async () => {
    await clearSession();
    setSessionUser(null);
    setMode('login');
    window.location.reload();
  };

  const handleLogoClick = () => {
    if (mode === 'settings') {
      setMode('parent');
      return;
    }
    if (mode === 'parent' || mode === 'kid') {
      setMode(mode);
      return;
    }
    setMode('login');
  };

  if (!sessionUser) {
    return <AuthGate onAuthenticated={(username) => setSessionUser(username)} />;
  }

  return (
    <div className="min-h-screen app-bg transition-colors duration-300">
      {/* Header */}
      <header className="app-header text-white p-3 md:p-4 shadow-lg transition-colors duration-300 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={handleLogoClick} className="hover:opacity-90 transition-opacity" title="Go to home page">
            <BrandLogo size={40} />
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
              <UserCircle className="w-4 h-4" />
              {sessionUser}
            </span>
            {mode === 'parent' && (
              <>
                <button
                  onClick={() => setMode('settings')}
                  className="p-2 hover:bg-star-700 rounded-full transition-colors"
                  title="Settings"
                >
                  <Settings className="w-6 h-6" />
                </button>
                <button
                  onClick={handleAccountLogout}
                  className="p-2 hover:bg-star-700 rounded-full transition-colors"
                  title="Account Logout"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </>
            )}
            {mode === 'settings' && (
              <button
                onClick={() => setMode('parent')}
                className="px-4 py-2 bg-white text-star-600 rounded-full font-bold hover:bg-gray-100 transition-colors"
              >
                Back
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-3 md:p-4">
        {mode === 'login' && (
          <ModeSelectPage
            onParentLogin={handleParentLogin}
            onKidMode={() => setMode('kid')}
            pinAttempts={pinAttempts}
          />
        )}
        {mode === 'kid' && <KidMode onLogout={handleLogout} />}
        {mode === 'parent' && <ParentMode />}
        {mode === 'settings' && <SettingsPage onBack={() => setMode('parent')} />}
      </main>
    </div>
  );
}

function AuthGate({ onAuthenticated }: { onAuthenticated: (email: string) => void }) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const isDemoMode = !isSupabaseEnabled();

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setError('');
    setInfo('');

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }

    setLoading(true);

    if (authMode === 'register') {
      if (password !== confirmPassword) {
        setLoading(false);
        setError('Passwords do not match.');
        return;
      }

      const registration = await registerWithEmail(normalizedEmail, password);
      setLoading(false);
      if (!registration.ok) {
        setError(registration.error);
        return;
      }
      setInfo(registration.message);
      setAuthMode('login');
      return;
    }

    const loginResult = await loginWithEmail(normalizedEmail, password);
    setLoading(false);
    if (!loginResult.ok) {
      setError(loginResult.error);
      return;
    }

    onAuthenticated(loginResult.email);
    window.location.reload();
  };

  const handleResendEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter the same email used during registration.');
      return;
    }
    setError('');
    const result = await resendActivationEmail(normalizedEmail);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInfo(result.message);
  };

  const handleActivateDemo = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const activated = activateLocalDemoAccount(normalizedEmail);
    if (!activated.ok) {
      setError(activated.error);
      return;
    }
    setInfo('Demo account activated. You can login now.');
  };

  return (
    <div className="min-h-screen app-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8 border border-orange-100">
        <div className="text-center mb-6">
          <BrandLogo size={56} className="justify-center" />
          <p className="text-sm text-gray-600 mt-2">Sign in with email to keep each family's data in their own account.</p>
          {isDemoMode && (
            <p className="text-xs text-amber-700 mt-2">
              Demo mode active: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for real activation emails.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setAuthMode('login');
              setError('');
              setInfo('');
            }}
            className={`rounded-lg py-2 font-bold ${authMode === 'login' ? 'bg-white shadow text-star-700' : 'text-gray-600'}`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setAuthMode('register');
              setError('');
              setInfo('');
            }}
            className={`rounded-lg py-2 font-bold ${authMode === 'register' ? 'bg-white shadow text-star-700' : 'text-gray-600'}`}
          >
            Register
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-star-200"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            placeholder="Password"
            className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-star-200"
          />
          {authMode === 'register' && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              placeholder="Confirm Password"
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-star-200"
            />
          )}
          {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
          {info && <p className="text-sm text-green-700 font-bold">{info}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold bg-gradient-to-r from-star-600 to-star-500 hover:shadow-lg transition-all disabled:opacity-60"
          >
            {loading ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create Account'}
          </button>
          <button
            onClick={handleResendEmail}
            className="w-full py-2 rounded-xl text-star-700 font-bold border border-star-200 hover:bg-star-50 transition-all inline-flex items-center justify-center gap-2"
          >
            <MailCheck className="w-4 h-4" /> Resend Activation Email
          </button>
          {isDemoMode && (
            <button
              onClick={handleActivateDemo}
              className="w-full py-2 rounded-xl text-amber-800 font-bold border border-amber-200 hover:bg-amber-50 transition-all"
            >
              Activate Demo Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeSelectPage({
  onParentLogin,
  onKidMode,
  pinAttempts,
}: {
  onParentLogin: (pin: string) => void;
  onKidMode: () => void;
  pinAttempts: number;
}) {
  const [pin, setPin] = useState('');
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const handlePinChange = (index: number, rawValue: string) => {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    const chars = pin.split('');
    chars[index] = digit;
    setPin(chars.join('').slice(0, 4));

    if (digit && index < 3) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && pin.length === 4) {
      onParentLogin(pin);
      return;
    }

    if (event.key === 'Backspace' && !pin[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center py-6 md:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 w-full max-w-4xl">
        {/* Kid Mode Card */}
        <div className="bg-gradient-to-br from-kid-100 to-kid-200 rounded-3xl p-6 md:p-8 shadow-xl transform hover:scale-[1.02] transition-transform cursor-pointer"
             onClick={onKidMode}>
          <div className="text-center">
            <Star className="w-20 h-20 md:w-24 md:h-24 text-kid-600 mx-auto mb-4 animate-bounce fill-current" />
            <h2 className="text-2xl md:text-3xl font-bold text-kid-900 mb-2">Kid Mode</h2>
            <p className="text-kid-700 text-lg">View your stars and rewards!</p>
            <button className="mt-6 px-8 py-3 bg-gradient-to-r from-kid-600 to-kid-500 text-white rounded-full font-bold hover:shadow-lg transition-all">
              Enter Kid Mode
            </button>
          </div>
        </div>

        {/* Parent Mode Card */}
        <div className="bg-gradient-to-br from-star-100 to-star-200 rounded-3xl p-6 md:p-8 shadow-xl">
          <div className="text-center">
            <Lock className="w-16 h-16 text-star-600 mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold text-star-900 mb-2">Parent Mode</h2>
            <p className="text-star-700 text-sm mb-6">Enter PIN to access</p>

            {pinAttempts > 0 && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                <p className="text-red-700 text-sm">
                  {pinAttempts >= 3 ? 'Too many attempts. Please try again later.' : `Attempt ${pinAttempts}/3`}
                </p>
              </div>
            )}

            <div className="flex gap-2 mb-4 justify-center">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  ref={(el) => {
                    pinInputRefs.current[i] = el;
                  }}
                  type="password"
                  maxLength={1}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin[i] || ''}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  disabled={pinAttempts >= 3}
                  className="w-14 h-14 text-center text-2xl font-bold border-2 border-star-400 rounded-lg focus:outline-none focus:border-star-600 focus:bg-star-50 disabled:opacity-50"
                />
              ))}
            </div>

            <button
              onClick={() => {
                if (pin.length === 4) {
                  onParentLogin(pin);
                }
              }}
              disabled={pin.length !== 4 || pinAttempts >= 3}
              className="w-full px-6 py-3 bg-gradient-to-r from-star-600 to-star-500 text-white rounded-full font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enter Parent Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
