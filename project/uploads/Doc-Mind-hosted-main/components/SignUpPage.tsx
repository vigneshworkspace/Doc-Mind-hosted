
import React, { useState } from 'react';
import { User, Mail, Lock } from 'lucide-react';
import Logo from './Logo';

interface SignUpPageProps {
  onSignUp: () => void;
  onSwitchToLogin: () => void;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onSignUp, onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignUp();
  };

  return (
    <div className="w-full max-w-md animate-fadeIn">
      <div className="glass-card rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
            <Logo className="w-48 h-auto" />
        </div>
        <h2 className="text-2xl font-bold text-center mb-1">Create an Account</h2>
        <p className="text-center text-muted-text dark:text-dark-muted-text mb-8">Join DocMind and supercharge your studies.</p>
        
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-text dark:text-dark-muted-text" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full pl-10 pr-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text"
              />
            </div>
          </div>
          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-text dark:text-dark-muted-text" />
              <input
                id="signup-email"
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
            <label htmlFor="signup-password" aria-label="Password" className="block text-sm font-medium text-muted-text dark:text-dark-muted-text mb-2">Password</label>
            <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-text dark:text-dark-muted-text" />
                <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white/20 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-text dark:placeholder:text-dark-muted-text"
                />
            </div>
          </div>
          <button
            type="submit"
            className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-primary text-dark-text text-lg font-bold rounded-xl hover:bg-opacity-80 disabled:bg-opacity-50 transition-all duration-300 shadow-lg hover:shadow-primary/30 transform hover:scale-105 active:scale-95"
          >
            Create Account
          </button>
        </form>
        
        <p className="text-center text-sm text-muted-text dark:text-dark-muted-text mt-8">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="font-semibold text-primary hover:underline">
            Log in
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignUpPage;
