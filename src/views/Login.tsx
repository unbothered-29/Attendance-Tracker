import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { GraduationCap } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent blur-3xl -z-10" />
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center mb-2 ring-1 ring-purple-500/20 shadow-inner">
            <GraduationCap className="w-10 h-10 text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-4xl font-display font-bold tracking-tight bg-gradient-to-br from-white to-purple-300 bg-clip-text text-transparent">Welcome to Tracker</CardTitle>
            <p className="text-base text-gray-400 mt-3">Log in to track your college attendance</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="college">College</Label>
              <select
                id="college"
                className="flex h-10 w-full rounded-lg border border-purple-500/20 bg-white/5 px-3 py-2 text-sm text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
              >
                <option value="">Select College</option>
                <option value="MIT">MIT</option>
                <option value="Stanford">Stanford</option>
                <option value="Harvard">Harvard</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {college === 'Other' && (
              <div className="space-y-2">
                <Label htmlFor="otherCollege">Enter your college name</Label>
                <Input
                  id="otherCollege"
                  placeholder="My College"
                  value={otherCollege}
                  onChange={(e) => setOtherCollege(e.target.value)}
                  required
                />
              </div>
            )}

            <Button type="submit" className="w-full mt-6" disabled={!name.trim()}>
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
