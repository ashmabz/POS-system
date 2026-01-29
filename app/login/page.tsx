'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User } from 'lucide-react';

export default function LoginPage() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (res.ok) {
           if (data.role === 'MASTER') router.push('/master');
           else if (data.role === 'ADMIN') router.push('/');
           else router.push('/pos');
           router.refresh();
        } else {
           setError(data.error || 'Login failed');
        }
      } else {
        const text = await res.text();
        console.error('Non-JSON response:', text);
        setError(`Server Error: ${text.slice(0, 100)}`);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection failed. Please check if the server is running.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Welcome Back</h1>
          <p className="text-slate-500">Sign in to your account</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={20} />
              <input 
                type="text" 
                required
                className="w-full pl-10 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter username"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
              <input 
                type="password" 
                required
                className="w-full pl-10 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter password"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            Sign In
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">Demo Access</p>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => {
                setFormData({ username: 'manager', password: '123' });
                // Small delay to allow state update before submission if we wanted auto-submit
                // But let's just fill it and let them click or we can use a helper
                handleQuickLogin('manager', '123');
              }}
              className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors border border-slate-200"
            >
              Manager Demo
            </button>
            <button 
              onClick={() => handleQuickLogin('cashier', '123')}
              className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors border border-slate-200"
            >
              Cashier Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  async function handleQuickLogin(u: string, p: string) {
    setFormData({ username: u, password: p });
    setError('');
    
    // We can't use handleLogin directly easily because of e.preventDefault()
    // Let's just perform the fetch here or use a shared function
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.role === 'MASTER') router.push('/master');
        else if (data.role === 'ADMIN') router.push('/');
        else router.push('/pos');
        router.refresh();
      } else {
        setError('Demo login failed. Please ensure the database is seeded.');
      }
    } catch (e) {
      setError('Connection failed.');
    }
  }
}
