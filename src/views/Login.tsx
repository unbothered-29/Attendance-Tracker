import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { ArrowRight, Sparkles, Lock, User as UserIcon, Eye, EyeOff, AlertCircle, GraduationCap, AtSign, Mail, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function Login() {
  const { loginWithPassword, registerWithPassword, loginWithGoogle } = useAppContext();
  
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  
  // Sign In fields
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [college, setCollege] = useState('');
  const [otherCollege, setOtherCollege] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!signInIdentifier.trim()) {
      setError('Please enter your username or email');
      return;
    }
    if (!signInPassword) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      await loginWithPassword(signInIdentifier.trim(), signInPassword);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    if (signUpPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (signUpPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const finalCollege = college === 'Other' ? otherCollege : college;

    setIsLoading(true);
    try {
      await registerWithPassword({
        name: name.trim(),
        username: username.trim().replace(/^@/, ''),
        email: email.trim() || undefined,
        college: finalCollege || 'Not specified',
        password: signUpPassword
      });
      setSuccessMessage('Account created successfully!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to register account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-[#050505] selection:bg-purple-500/30">
      {/* Background Orbs */}
      <div className="absolute top-[10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[120px] opacity-70 animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full mix-blend-screen filter blur-[150px] opacity-70 pointer-events-none" />

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-center z-10 mx-auto py-8">
        
        {/* Left Column: Hero Copy */}
        <div className="space-y-6 sm:space-y-8 text-center lg:text-left flex flex-col items-center lg:items-start animate-in slide-in-from-bottom-8 fade-in duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-purple-200 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="font-medium">Attendance tracking & AI schedule intelligence</span>
          </div>
          
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] font-display">
            Own your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-400">
              academic journey.
            </span>
          </h1>
          
          <p className="text-base sm:text-lg text-gray-400 max-w-md leading-relaxed">
            Stay on top of your classes, track your attendance effortlessly with smart streak goals, and manage your schedule in one place.
          </p>

          <div className="hidden sm:flex items-center gap-6 pt-2 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span>Realtime Cloud Sync</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
              <span>AI Timetable OCR</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
              <span>Secure Authentication</span>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="w-full max-w-md mx-auto lg:ml-auto animate-in slide-in-from-bottom-12 fade-in duration-1000 delay-150 fill-mode-backwards">
          <div className="bg-white/[0.03] border border-white/[0.08] p-6 sm:p-9 rounded-[2rem] shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.04] to-transparent pointer-events-none" />
            
            {/* Mode Switcher Tabs */}
            <div className="flex rounded-xl bg-black/40 p-1 border border-white/10 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                  setSuccessMessage('');
                }}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-lg transition-all text-center",
                  mode === 'signin'
                    ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                    : "text-gray-400 hover:text-white"
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setSuccessMessage('');
                }}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-lg transition-all text-center",
                  mode === 'signup'
                    ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                    : "text-gray-400 hover:text-white"
                )}
              >
                Create Account
              </button>
            </div>

            {/* Error & Success banners */}
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400 mt-0.5" />
                <span className="leading-tight">{successMessage}</span>
              </div>
            )}

            {/* SIGN IN FORM */}
            {mode === 'signin' && (
              <form onSubmit={handleSignInSubmit} className="space-y-4 relative">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Username or Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <AtSign className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. jessica or jessica@example.com"
                      value={signInIdentifier}
                      onChange={(e) => setSignInIdentifier(e.target.value)}
                      required
                      className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showSignInPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      required
                      className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-11 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-200"
                    >
                      {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading || !signInIdentifier.trim() || !signInPassword}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white mt-2 text-sm font-medium transition-all flex items-center justify-center gap-2 group disabled:opacity-50 shadow-lg shadow-purple-900/30"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Signing in...
                    </span>
                  ) : (
                    <>
                      <span>Sign In to Workspace</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>

                <div className="flex items-center my-4">
                  <div className="flex-1 border-t border-white/10"></div>
                  <span className="px-3 text-xs text-gray-500 uppercase tracking-wider">or</span>
                  <div className="flex-1 border-t border-white/10"></div>
                </div>

                <Button 
                  type="button" 
                  onClick={() => {
                    loginWithGoogle().catch(() => {});
                  }}
                  variant="outline"
                  className="w-full h-11 rounded-xl border-white/10 hover:bg-white/5 text-white text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-3"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Google</span>
                </Button>
              </form>
            )}

            {/* SIGN UP FORM */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUpSubmit} className="space-y-3.5 relative">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full bg-black/30 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs sm:text-sm transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                        <AtSign className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        placeholder="jessica27"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
                        required
                        className="w-full bg-black/30 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs sm:text-sm transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                    College / University
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <select
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs sm:text-sm transition-all appearance-none"
                    >
                      <option value="" className="bg-gray-900 text-gray-400">Select your college</option>
                      <option value="MIT" className="bg-gray-900">MIT</option>
                      <option value="Stanford" className="bg-gray-900">Stanford</option>
                      <option value="Harvard" className="bg-gray-900">Harvard</option>
                      <option value="IIT" className="bg-gray-900">IIT / NIT</option>
                      <option value="Other" className="bg-gray-900">Other...</option>
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                {college === 'Other' && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                    <input
                      type="text"
                      placeholder="Enter college name"
                      value={otherCollege}
                      onChange={(e) => setOtherCollege(e.target.value)}
                      required
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs sm:text-sm transition-all"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                    Email <span className="text-gray-500 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs sm:text-sm transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type={showSignUpPassword ? "text" : "password"}
                        placeholder="Min 6 chars"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        required
                        className="w-full bg-black/30 border border-white/10 rounded-xl pl-8 pr-7 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                        className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-200"
                      >
                        {showSignUpPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                      Confirm
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type={showSignUpPassword ? "text" : "password"}
                        placeholder="Repeat"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full bg-black/30 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs transition-all"
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading || !name.trim() || !username.trim() || !signUpPassword}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white mt-3 text-sm font-medium transition-all flex items-center justify-center gap-2 group disabled:opacity-50 shadow-lg shadow-purple-900/30"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating Workspace...
                    </span>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>

                <div className="flex items-center my-3">
                  <div className="flex-1 border-t border-white/10"></div>
                  <span className="px-3 text-[11px] text-gray-500 uppercase tracking-wider">or</span>
                  <div className="flex-1 border-t border-white/10"></div>
                </div>

                <Button 
                  type="button" 
                  onClick={() => {
                    loginWithGoogle().catch(() => {});
                  }}
                  variant="outline"
                  className="w-full h-10 rounded-xl border-white/10 hover:bg-white/5 text-white text-xs font-medium transition-all flex items-center justify-center gap-3"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Google</span>
                </Button>
              </form>
            )}

            <div className="mt-6 text-center text-xs text-gray-500">
              {mode === 'signin' ? (
                <p>
                  New student?{' '}
                  <button 
                    type="button" 
                    onClick={() => {
                      setMode('signup');
                      setError('');
                    }}
                    className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-2"
                  >
                    Create your account
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button 
                    type="button" 
                    onClick={() => {
                      setMode('signin');
                      setError('');
                    }}
                    className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-2"
                  >
                    Sign in here
                  </button>
                </p>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
