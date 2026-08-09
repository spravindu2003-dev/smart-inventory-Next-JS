'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { loginUser } from '@/actions/login-user';
import { useTabSession } from '@/components/tab-session-provider';

export default function SignupPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useTabSession();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        toast.error(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      try {
        const token = await loginUser(email, password);
        await login(token);
        toast.success('Registration successful');
      } catch {
        toast.success('Registration successful. Please login.');
        router.push('/login');
        setLoading(false);
      }
    } catch {
      setError('An error occurred');
      toast.error('An error occurred');
      setLoading(false);
    }
  }

  if (isAuthenticated) return null;

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Start managing your inventory</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
          <Input
            label="Name"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
          <div className="text-sm text-center text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-600 hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
