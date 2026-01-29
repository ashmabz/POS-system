'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, AlertTriangle, ArrowLeft, PackagePlus, Filter } from 'lucide-react'; 
import Link from 'next/link'; 

interface Product {
  id: string;
  name: string;
  sku: string;
  stockQuantity: number;
  sellingPrice: number;
  costPrice?: number;
  category: string;
  lowStockLevel: number;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [categories, setCategories] = useState<string[]>(['All']);
  const [currentCategory, setCurrentCategory] = useState('All');
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    sellingPrice: '',
    costPrice: '',
    stockQuantity: '',
    category: ''
  });
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQuantity, setRestockQuantity] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');

  const fetchProducts = useCallback(async (category: string) => {
    setLoading(true);
    try {
      setError('');
      const url = new URL('/api/products', window.location.origin);
      url.searchParams.append('category', category);
      
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setProducts(data);
        }
      } else {
        setError('Failed to fetch products');
      }
    } catch (e) {
      console.error('Error fetching products:', e);
      setError('An error occurred while fetching products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(currentCategory);
  }, [currentCategory, fetchProducts]);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/products/categories');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setCategories(['All', ...data]);
          }
        }
      } catch (e) {
        console.error("Failed to fetch categories", e);
      }
    }
    fetchCategories();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || formData.sellingPrice === '' || !formData.category) {
      return;
    }

    const sellingPrice = parseFloat(formData.sellingPrice);
    const costPrice = parseFloat(formData.costPrice) || 0;
    const stockQuantity = parseInt(formData.stockQuantity) || 0;

    if (isNaN(sellingPrice) || sellingPrice < 0 || costPrice < 0 || stockQuantity < 0) {
      alert('Invalid input for prices or quantity.');
      return;
    }

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, sellingPrice, costPrice, stockQuantity })
      });

      if (res.ok) {
        setFormData({ name: '', sku: '', sellingPrice: '', costPrice: '', stockQuantity: '', category: '' });
        setShowAddForm(false);
        fetchProducts(currentCategory); // Refetch with current filter
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save product.');
      }
    } catch (error) {
      alert('An error occurred while saving.');
    }
  }

  function openRestockModal(product: Product) {
    setRestockProduct(product);
    setRestockQuantity('');
    setAdjustmentNote('');
    setRestockModalOpen(true);
  }

  async function handleRestockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!restockProduct || !restockQuantity) return;

    const adjustment = parseInt(restockQuantity);
    if (isNaN(adjustment) || adjustment === 0) {
      alert('Please enter a valid non-zero quantity.');
      return;
    }

    try {
      const res = await fetch(`/api/products/${restockProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          stockAdjustment: adjustment,
          note: adjustmentNote || (adjustment > 0 ? 'Manual Restock' : 'Stock Adjustment')
        })
      });

      if (res.ok) {
        setRestockModalOpen(false);
        fetchProducts(currentCategory); 
      } else {
        const errorData = await res.json();
        alert('Failed to adjust stock: ' + (errorData.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred.');
    }
  }
  
  async function handleDelete(productId: string, productName: string) {
    if (!confirm(`Are you sure you want to delete "${productName}" from inventory?`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProducts(currentCategory); // Refetch with current filter
      } else {
        const err = await res.json();
        alert(err.error || `Failed to delete "${productName}".`);
      }
    } catch (error) {
      alert(`An error occurred while deleting "${productName}".`);
    }
  }
  
  const filteredProducts = products; 


  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4"> 
          <Link href="/" className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <ArrowLeft size={24} className="text-slate-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Inventory</h1>
            <p className="text-slate-500">Manage your shop's stock</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter size={20} className="absolute left-3 top-2.5 text-slate-400" />
            <select 
              value={currentCategory}
              onChange={e => setCurrentCategory(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add Product
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-8 border border-slate-200 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-xl font-semibold mb-4 text-slate-800">New Product</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <input 
              placeholder="Product Name" 
              className="p-3 border rounded-lg"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              required
            />
            <input 
              placeholder="SKU / Barcode (Optional)" 
              className="p-3 border rounded-lg"
              value={formData.sku}
              onChange={e => setFormData({...formData, sku: e.target.value})}
            />
             <input 
              placeholder="Category (e.g., Drinks)" 
              className="p-3 border rounded-lg"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
              required
            />
            <div className="relative">
              <span className="absolute left-3 top-3 text-slate-400">$</span>
              <input 
                type="number" 
                placeholder="Selling Price" 
                className="p-3 pl-8 border rounded-lg w-full"
                value={formData.sellingPrice}
                onChange={e => setFormData({...formData, sellingPrice: e.target.value})}
                required
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-3 text-slate-400">$</span>
              <input 
                type="number" 
                placeholder="Cost Price" 
                className="p-3 pl-8 border rounded-lg w-full"
                value={formData.costPrice}
                onChange={e => setFormData({...formData, costPrice: e.target.value})}
              />
            </div>
            <input 
              type="number" 
              placeholder="Initial Stock Qty" 
              className="p-3 border rounded-lg"
              value={formData.stockQuantity}
              onChange={e => setFormData({...formData, stockQuantity: e.target.value})}
            />
            <button 
              type="submit" 
              onClick={() => console.log('Save Product button clicked')}
              className="bg-green-600 text-white font-medium p-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              Save Product
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 font-semibold text-slate-600">Name</th>
                <th className="p-4 font-semibold text-slate-600">SKU</th>
                <th className="p-4 font-semibold text-slate-600">Category</th>
                <th className="p-4 font-semibold text-slate-600">Stock</th>
                <th className="p-4 font-semibold text-slate-600">Price</th>
                <th className="p-4 font-semibold text-slate-600">Cost</th>
                <th className="p-4 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-900">{product.name}</td>
                  <td className="p-4 text-slate-500 font-mono text-sm">{product.sku}</td>
                  <td className="p-4 text-slate-500">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-sm">
                      {product.category}
                    </span>
                  </td>
                  <td className={`p-4 font-bold ${product.stockQuantity <= product.lowStockLevel ? 'text-red-600' : 'text-slate-700'}`}>
                    {product.stockQuantity}
                    {product.stockQuantity <= product.lowStockLevel && (
                      <>
                        <AlertTriangle size={16} className="inline ml-2 text-red-500" />
                        <span className="ml-1 text-sm">Low Stock, Restock!</span>
                      </>
                    )}
                  </td>
                  <td className="p-4 text-slate-700">${product.sellingPrice.toFixed(2)}</td>
                  <td className="p-4 text-slate-500 text-sm">${product.costPrice?.toFixed(2) || '0.00'}</td>
                  <td className="p-4 flex items-center">
                    <button 
                      onClick={() => openRestockModal(product)}
                      className="bg-amber-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-amber-700 transition-colors mr-2 flex items-center gap-1"
                    >
                      <PackagePlus size={16} />
                      Adjust
                    </button>
                    <button 
                      onClick={() => handleDelete(product.id, product.name)}
                      className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && !loading && !error && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Search size={32} className="text-slate-300" />
                      <p>No products found.</p>
                      <button onClick={() => setShowAddForm(true)} className="text-blue-600 hover:underline">
                        Add your first product
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {restockModalOpen && restockProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-1 text-slate-800">Adjust Stock</h3>
            <p className="text-sm text-slate-500 mb-4">{restockProduct.name}</p>
            
            <form onSubmit={handleRestockSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Adjustment Quantity
                </label>
                <input 
                  type="number" 
                  autoFocus
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="e.g. 10 or -5"
                  value={restockQuantity}
                  onChange={e => setRestockQuantity(e.target.value)}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use positive for restock, negative for breakage/theft.
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Note (Optional)
                </label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="Reason for adjustment"
                  value={adjustmentNote}
                  onChange={e => setAdjustmentNote(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setRestockModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}