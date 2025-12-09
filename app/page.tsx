'use client';

import { useState, useEffect } from 'react';
import LoginForm from '@/components/LoginForm';
import TextSafe from '@/components/TextSafe';

interface User {
  id: number;
  username: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4">
        <div className="w-full max-w-md">
          <div className="bg-white border-2 border-gray-800 rounded-lg shadow-lg p-8">          
            <LoginForm onSuccess={handleLogin} />
          </div>
          <div className="mt-6 text-center text-gray-400 text-sm">
          </div>
        </div>
      </div>
    );
  }
  return <TextSafe user={user} onLogout={handleLogout} />;
}
