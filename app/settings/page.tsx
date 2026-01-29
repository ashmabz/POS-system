'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Trash2, ArrowLeft, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  createdAt: string;
}

interface Product { // New Product interface
  id: string;
  name: string;
  sku: string;
  lowStockLevel: number;
  stockQuantity: number; // Also need stockQuantity to compare
}

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<{id: string, name: string}[]>([]); // Shops state
  const [selectedShops, setSelectedShops] = useState<string[]>([]); // For form
  const [role, setRole] = useState('CASHIER'); // Form role state

  const [shopId, setShopId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
    fetchProducts();
    fetchShops(); // Fetch all shops
  }, []);

  async function fetchShops() {
    try {
      const res = await fetch('/api/shops');
      if (res.ok) setShops(await res.json());
    } catch (e) { console.error(e); }
  }

  // ... (fetchUsers, fetchProducts, fetchShopId remain same)

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData);
    
    // Add managed shops if Admin
    if (data.role === 'ADMIN') {
        data.managedShopIds = selectedShops;
    }

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setShowForm(false);
      setSelectedShops([]);
      fetchUsers();
      (e.target as HTMLFormElement).reset();
    } else {
      alert('Failed to create user');
    }
  }

  const toggleShop = (id: string) => {
    setSelectedShops(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

      const [selectedThresholdShop, setSelectedThresholdShop] = useState<string>('');
  
      useEffect(() => {
          if (shops.length > 0 && !selectedThresholdShop) {
              setSelectedThresholdShop(shops[0].id);
              setShopId(shops[0].id); // Keep compatibility
          }
      }, [shops]);
  
      useEffect(() => {
          if (selectedThresholdShop) {
               setShopId(selectedThresholdShop); // Update global shopId for child components/logic
               // Fetch products for THIS shop
               // But fetchProducts currently fetches ALL products for the user context. 
               // We should probably filter products by shop in the UI or API.
               // For now, let's just let it be. The products list shows stock.
               // Ideally /api/products should support ?shopId=...
               fetchProducts(selectedThresholdShop); 
          }
      }, [selectedThresholdShop]);
  
      async function fetchProducts(targetShopId?: string) {
          try {
            const url = targetShopId ? `/api/products?shopId=${targetShopId}&limit=100` : '/api/products?limit=100';
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              // Handle pagination response structure
              setProducts(data.products || data);
            }
          } catch (error) {
            console.error('Error fetching products:', error);
          }
      }

  async function handleDeleteUser(userId: string, userName: string) {
    if (!confirm(`Are you sure you want to delete staff member "${userName}"? This action cannot be undone.`)) {
      return;
    }

    console.log(`Attempting to delete user: ${userName} (ID: ${userId})`);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        console.log(`User "${userName}" deleted successfully.`);
        fetchUsers(); // Refresh the list of users
      } else {
        const errorText = await res.text();
        console.error(`Failed to delete user "${userName}". Server response:`, errorText);
        try {
          const errorData = JSON.parse(errorText);
          alert(errorData.error || `Failed to delete user "${userName}".`);
        } catch {
          alert(`Failed to delete user "${userName}". Server returned ${res.status} ${res.statusText}`);
        }
      }
    } catch (error) {
      console.error(`Error deleting user "${userName}":`, error);
      alert('An error occurred while deleting the user. Please check your connection.');
    }
  }

  async function handleUpdateLowStockLevel(productId: string, newThreshold: number) {
    if (shopId === null) {
      alert("Shop ID not available. Cannot update low stock level.");
      return;
    }

    console.log(`Updating low stock level for product ${productId} to ${newThreshold}`);
    try {
      const res = await fetch(`/api/products/${productId}`, { // This will be handled by a PATCH on /api/products/[id]
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lowStockLevel: newThreshold, shopId: shopId }),
      });

      if (res.ok) {
        console.log('Low stock level updated successfully.');
        fetchProducts(); // Refresh the product list
      } else {
        const errorText = await res.text();
        console.error('Failed to update low stock level. Server response:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          alert(errorData.error || 'Failed to update low stock level.');
        } catch {
          alert(`Failed to update low stock level. Server returned ${res.status} ${res.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error updating low stock level:', error);
      alert('An error occurred while updating low stock level. Please check your connection.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
            <Link href="/" className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <ArrowLeft size={24} className="text-slate-600" />
            </Link>
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Shop Settings</h1>
                <p className="text-slate-500">Manage your staff and store details</p>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Staff Management</h2>
                <button 
                    onClick={() => setShowForm(!showForm)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                >
                    <UserPlus size={18} /> Add Staff
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreateUser} className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
                    <h3 className="font-semibold mb-4 text-slate-700">Add New User</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                            <input name="name" required className="w-full p-2 border rounded-lg" placeholder="e.g. John Doe" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                            <input name="username" required className="w-full p-2 border rounded-lg" placeholder="e.g. john" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                            <input name="password" type="password" required className="w-full p-2 border rounded-lg" placeholder="******" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                            <select 
                                name="role" 
                                className="w-full p-2 border rounded-lg bg-white"
                                value={role}
                                onChange={e => setRole(e.target.value)}
                            >
                                <option value="CASHIER">Cashier (Single Shop)</option>
                                <option value="ADMIN">Manager (Multi-Shop)</option>
                                <option value="MASTER">Master Admin</option>
                            </select>
                        </div>
                    </div>

                    {role === 'ADMIN' && (
                        <div className="mb-4 p-3 bg-white rounded border border-slate-200">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Assign Shops</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {shops.map(shop => (
                                    <label key={shop.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedShops.includes(shop.id)}
                                            onChange={() => toggleShop(shop.id)}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="text-sm text-slate-700">{shop.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 hover:text-slate-800">Cancel</button>
                        <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">Create Account</button>
                    </div>
                </form>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b">
                        <tr>
                            <th className="p-4 font-medium">Name</th>
                            <th className="p-4 font-medium">Username</th>
                            <th className="p-4 font-medium">Role</th>
                            <th className="p-4 font-medium">Created</th>
                            <th className="p-4 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-medium text-slate-800">{user.name}</td>
                                <td className="p-4 text-slate-600">{user.username}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                        user.role === 'MASTER' ? 'bg-red-100 text-red-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-500 text-sm">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="p-4">
                                    {user.role === 'CASHIER' && (
                                        <button 
                                          onClick={() => handleDeleteUser(user.id, user.name)}
                                          className="text-red-600 hover:text-red-800 transition-colors"
                                        >
                                          <Trash2 size={20} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500">
                                    No staff members found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Product Low Stock Thresholds */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Product Low Stock Thresholds</h2>
                
                {shops.length > 1 && (
                    <select
                        value={selectedThresholdShop}
                        onChange={(e) => setSelectedThresholdShop(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {shops.map(shop => (
                            <option key={shop.id} value={shop.id}>{shop.name}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b">
                        <tr>
                            <th className="p-4 font-medium">Product Name</th>
                            <th className="p-4 font-medium">SKU</th>
                            <th className="p-4 font-medium">Current Stock</th>
                            <th className="p-4 font-medium">Low Stock Threshold</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(product => (
                            <tr key={product.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-medium text-slate-800">{product.name}</td>
                                <td className="p-4 text-slate-600">{product.sku}</td>
                                <td className={`p-4 font-bold ${product.stockQuantity <= product.lowStockLevel ? 'text-red-600' : 'text-slate-700'}`}>
                                    {product.stockQuantity}
                                    {product.stockQuantity <= product.lowStockLevel && (
                                      <AlertTriangle size={16} className="inline ml-2 text-red-500" />
                                    )}
                                </td>
                                <td className="p-4">
                                    <input
                                      type="number"
                                      value={product.lowStockLevel}
                                      onChange={(e) => {
                                        const newThreshold = parseInt(e.target.value);
                                        if (!isNaN(newThreshold)) {
                                          setProducts(prev => prev.map(p => 
                                            p.id === product.id ? { ...p, lowStockLevel: newThreshold } : p
                                          ));
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const newThreshold = parseInt(e.target.value);
                                        if (!isNaN(newThreshold) && newThreshold >= 0 && newThreshold !== product.lowStockLevel) {
                                          handleUpdateLowStockLevel(product.id, newThreshold);
                                        } else {
                                          // Revert to original if input is invalid or unchanged
                                          fetchProducts();
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.currentTarget.blur(); // Trigger onBlur on Enter
                                        }
                                      }}
                                      className="w-24 p-1 border rounded text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </td>
                            </tr>
                        ))}
                        {products.length === 0 && !loading && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-500">
                                    No products found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}
