'use client';

import { useState, useEffect } from 'react';
import { Building2, UserPlus, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MasterDashboard() {
  const [shops, setShops] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/shops').then(res => res.json()).then(setShops);
  }, []);

  async function handleCreateShop(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await fetch('/api/shops', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    
    setShowForm(false);
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Master Dashboard</h1>
          <p className="text-slate-500">System Overview</p>
        </div>
        <button 
          onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); }}
          className="text-slate-500 hover:text-red-600 flex gap-2"
        >
          <LogOut size={20} /> Logout
        </button>
      </div>

      <div className="mb-8">
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-blue-700"
        >
          <Building2 size={20} /> New Shop
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateShop} className="bg-white p-6 rounded-xl shadow-md mb-8 max-w-md">
          <h3 className="font-bold mb-4">Create New Shop & Admin</h3>
          <div className="space-y-4">
            <input name="shopName" placeholder="Shop Name" required className="w-full p-2 border rounded" />
            <input name="adminUsername" placeholder="Admin Username" required className="w-full p-2 border rounded" />
            <input name="adminPassword" type="password" placeholder="Admin Password" required className="w-full p-2 border rounded" />
            <button className="w-full bg-green-600 text-white p-2 rounded">Create</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shops.map(shop => (
          <div key={shop.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-xl font-bold text-slate-800 mb-2">{shop.name}</h3>
            <div className="text-sm text-slate-500 space-y-1">
              <p>ID: {shop.id.slice(0,8)}</p>
              <p>Admins: {shop.users.filter((u: any) => u.role === 'ADMIN').length}</p>
              <p>Cashiers: {shop.users.filter((u: any) => u.role === 'CASHIER').length}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
