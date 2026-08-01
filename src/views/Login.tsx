import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

export function Login() {
  const { login } = useAppContext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [college, setCollege] = useState('');
  const [otherCollege, setOtherCollege] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const finalCollege = college === 'Other' ? otherCollege : college;
    
    login({
      name,
      email,
      college: finalCollege || 'Not specified'
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#050505] selection:bg-purple-500/30">
      {/* Background Orbs */}
      <div className="absolute top-[10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[120px] opacity-70 animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full mix-blend-screen filter blur-[150px] opacity-70 pointer-events-none" />

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-16 items-center z-10 mx-auto">
        
        {/* Left Column: Hero Copy */}
        <div className="space-y-8 text-center lg:text-left flex flex-col items-center lg:items-start animate-in slide-in-from-bottom-8 fade-in duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-purple-200 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="font-medium">Attendance tracking, simplified.</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] font-display">
            Own your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
              academic journey.
            </span>
          </h1>
          
          <p className="text-lg text-gray-400 max-w-md leading-relaxed">
            Stay on top of your classes, track your attendance effortlessly, and never miss a goal again. Built for students who care.
          </p>
        </div>

        {/* Right Column: Minimal Form */}
        <div className="w-full max-w-md mx-auto lg:ml-auto animate-in slide-in-from-bottom-12 fade-in duration-1000 delay-150 fill-mode-backwards">
          <div className="bg-white/[0.02] border border-white/[0.05] p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            
            <div className="mb-8 relative">
              <h2 className="text-2xl font-semibold text-white mb-2">Get Started</h2>
              <p className="text-sm text-gray-400">Enter your details to create your workspace.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 relative">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-gray-300">
                  Your Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="college" className="text-sm font-medium text-gray-300">
                  College / University
                </label>
                <div className="relative">
                  <select
                    id="college"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all appearance-none"
                  >
                    <option value="" className="bg-gray-900 text-gray-400">Select your college</option>
                    <option value="MIT" className="bg-gray-900">MIT</option>
                    <option value="Stanford" className="bg-gray-900">Stanford</option>
                    <option value="Harvard" className="bg-gray-900">Harvard</option>
                    <option value="Other" className="bg-gray-900">Other...</option>
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {college === 'Other' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label htmlFor="otherCollege" className="text-sm font-medium text-gray-300">
                    College Name
                  </label>
                  <input
                    id="otherCollege"
                    type="text"
                    placeholder="Enter your college name"
                    value={otherCollege}
                    onChange={(e) => setOtherCollege(e.target.value)}
                    required
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                  />
                </div>
              )}

              <Button 
                type="submit" 
                disabled={!name.trim()}
                className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-500 text-white mt-6 text-base font-medium transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:hover:bg-purple-600 shadow-lg shadow-purple-900/20"
              >
                <span>Enter Workspace</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
