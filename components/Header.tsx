'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Store } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [shops, setShops] = useState<any[]>([]);

  useEffect(() => {
    fetchUser();
    fetchShops();
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) setUser(await res.json());
    } catch (e) { console.error(e); }
  }

  async function fetchShops() {
    try {
      const res = await fetch('/api/shops');
      if (res.ok) setShops(await res.json());
    } catch (e) { console.error(e); }
  }

  async function handleShopChange(shopId: string) {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId })
      });
      if (res.ok) {
        // Refresh the page to update all data based on the new shopId
        window.location.reload();
      } else {
        alert('Failed to switch shop');
      }
    } catch (e) { console.error(e); }
  }

  // Hide header on login page
  if (pathname === '/login') return null;

  async function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
      try {
        const res = await fetch('/api/auth/logout', {
          method: 'POST',
        });

        if (res.ok) {
          router.push('/login');
        } else {
          alert('Failed to log out. Please try again.');
        }
      } catch (error) {
        console.error('Error logging out:', error);
        alert('An error occurred during logout.');
      }
    }
  }

  return (
    <header className="bg-gray-800 text-white p-4 shadow-md sticky top-0 z-50">
      <nav className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold flex items-center gap-2">
            <Store size={24} className="text-blue-400" />
            <span className="hidden sm:inline">POS System</span>
          </Link>

          {user && (user.role === 'ADMIN' || user.role === 'MASTER') && shops.length > 0 && (
            <div className="flex items-center gap-2 bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-600">
              <span className="text-xs text-gray-400 uppercase font-bold hidden md:inline">Active Shop:</span>
              <select 
                className="bg-transparent text-sm font-semibold outline-none cursor-pointer"
                value={user.shopId || ''}
                onChange={(e) => handleShopChange(e.target.value)}
              >
                {!user.shopId && <option value="" disabled>Select Shop</option>}
                {shops.map(shop => (
                  <option key={shop.id} value={shop.id} className="bg-gray-800 text-white">
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400 font-bold uppercase">{user.role}</p>
              <p className="text-sm font-medium">{user.name}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
          >
            <LogOut size={20} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
