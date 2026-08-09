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

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useTabSession();
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
      const token = await loginUser(email, password);
      await login(token);
      toast.success('Login successful');
    } catch {
      setError('Invalid email or password');
      toast.error('Invalid email or password');
      setLoading(false);
    }
  }

  if (isAuthenticated) return null;

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
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
          />
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
          <div className="text-sm text-center text-gray-500">
            <Link href="/forgot-password" className="text-indigo-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="text-sm text-center text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-indigo-600 hover:underline">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
