import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';

export function LoginPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post<{
        success: boolean;
        data: { accessToken: string; refreshToken: string; user: User };
      }>('/auth/login', { email, password });

      const { accessToken, refreshToken, user } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nazar-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-nazar-accent mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-nazar-text tracking-wider">NAZAR</h1>
          <p className="text-nazar-muted text-sm mt-1">Political Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-lg font-semibold text-nazar-text text-center">Sign In</h2>

          {error && (
            <div className="bg-red-900/30 border border-red-800/50 text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-nazar-muted mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-nazar-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-9"
                placeholder="analyst@nazar.ai"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-nazar-muted mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-nazar-muted" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-9 pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nazar-muted hover:text-nazar-text"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-nazar-muted text-xs mt-4">
          NAZAR v1.0 — Saptanga Labs
        </p>
      </div>
    </div>
  );
}
