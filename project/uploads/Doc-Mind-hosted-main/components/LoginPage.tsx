
import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import Logo from './Logo';

interface LoginPageProps {
  onLogin: () => void;
  onSwitchToSignUp: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onSwitchToSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <div className="w-full max-w-md animate-fadeIn">
      <div className="glass-card rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <Logo className="w-48 h-auto" />
        </div>
        <h2 className="text-2xl font-bold text-center mb-1">Welcome Back!</h2>
        <p className="text-center text-muted-text dark:text-dark-muted-text mb-8">Log in to continue to DocMind.</p>
        
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-text dark:text-dark-muted-text" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" aria-label="Password" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">Password</label>
            <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-text dark:text-dark-muted-text" />
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text"
                />
            </div>
            <a href="#" className="text-xs text-primary hover:underline mt-2 block text-right">Forgot password?</a>
          </div>
          <button
            type="submit"
            className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-primary text-dark-text text-lg font-bold rounded-xl hover:bg-opacity-80 disabled:bg-opacity-50 transition-all duration-300 shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95"
          >
            Log In
          </button>
        </form>
        
        <p className="text-center text-sm text-muted-text dark:text-dark-muted-text mt-8">
          Don't have an account?{' '}
          <button onClick={onSwitchToSignUp} className="font-semibold text-primary hover:underline">
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
