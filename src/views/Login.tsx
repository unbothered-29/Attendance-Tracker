import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { BookOpen } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-purple-600/20 w-16 h-16 rounded-2xl flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-purple-500" />
          </div>
          <div>
            <CardTitle className="text-2xl">Welcome to Tracker</CardTitle>
            <p className="text-sm text-gray-400 mt-2">Log in to track your college attendance</p>
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
                className="flex h-10 w-full rounded-lg border border-purple-500/20 bg-[#120919] px-3 py-2 text-sm text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
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
