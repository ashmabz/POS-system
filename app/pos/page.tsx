'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone, CheckCircle, ArrowLeft, LogOut, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// --- Types ---
interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  stockQuantity: number;
}

interface CartItem extends Product {
  cartId: string; // Unique ID for the cart entry
  quantity: number;
}

// --- Main Component ---
export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [discount, setDiscount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [shops, setShops] = useState<any[]>([]); // Added shops state
  const [heldSales, setHeldSales] = useState<any[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 1. Fetch Products and User on Load
  useEffect(() => {
    fetchUser();
    fetchShops(); // Fetch shops for switching
    // Load held sales from localStorage
    const saved = localStorage.getItem('heldSales');
    if (saved) setHeldSales(JSON.parse(saved));
  }, []);

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
        window.location.reload();
      } else {
        alert('Failed to switch shop');
      }
    } catch (e) { console.error(e); }
  }

  // Update localStorage when heldSales changes
  useEffect(() => {
    localStorage.setItem('heldSales', JSON.stringify(heldSales));
  }, [heldSales]);

  // Handle Search KeyDown (Barcode Scanner)
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && products.length === 1) {
      const product = products[0];
      if (product.stockQuantity > 0) {
        addToCart(product);
        setSearch(''); // Clear search for next scan
      }
    }
  };

  const holdSale = () => {
    if (cart.length === 0) return;
    const newHeldSale = {
      id: Date.now(),
      items: cart,
      discount,
      totalAmount,
      createdAt: new Date().toISOString()
    };
    setHeldSales([newHeldSale, ...heldSales]);
    clearCart();
  };

  const recallSale = (heldSale: any) => {
    setCart(heldSale.items);
    setDiscount(heldSale.discount);
    setHeldSales(heldSales.filter(s => s.id !== heldSale.id));
    setShowHeldModal(false);
  };

  const deleteHeldSale = (id: number) => {
    setHeldSales(heldSales.filter(s => s.id !== id));
  };

  // Debounced Search Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(search);
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [search]);

  async function fetchUser() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (e) {
      console.error('Failed to fetch user:', e);
    }
  }

  async function fetchProducts(query = '') {
    try {
      setLoading(true);
      const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=40`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Handle Logout
  async function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
      try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
          router.push('/login');
        }
      } catch (e) {
        console.error('Logout failed:', e);
      }
    }
  }

  // 2. Cart Logic
  const addToCart = (product: Product) => {
    if (product.stockQuantity <= 0) return;

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        // Limit to available stock
        if (existing.quantity >= product.stockQuantity) return prev;
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, cartId: Math.random().toString(), quantity: 1 }];
    });
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        const newQty = item.quantity + delta;
        if (newQty < 1) return item; // Don't remove here, use remove button
        if (newQty > item.stockQuantity) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
  };

  // 3. Totals
  const subTotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  const totalAmount = Math.max(0, subTotal - discount);

  // 4. Checkout Logic
  const handleCheckout = async (method: 'CASH' | 'CARD' | 'MOBILE') => {
    if (cart.length === 0) return;
    setProcessing(true);

    try {
      const payload = {
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.sellingPrice,
          quantity: item.quantity
        })),
        totalAmount,
        discount,
        paymentMethod: method
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Sale failed');
        return;
      }

      // Success!
      setLastSale({ ...data, change: 0 }); // In future, handle cash change
      setCart([]);
      setDiscount(0);
      fetchProducts(); // Refresh stock levels
      
    } catch (error) {
      alert('Network error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  // --- Render ---

  // Success View
  if (lastSale) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-green-50 p-8">
        {/* Printable Receipt (Hidden on Screen) */}
        <div className="hidden print:block absolute top-0 left-0 w-full p-8 bg-white text-black">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">POS System Receipt</h1>
            <p className="text-sm">Store Address: 123 Main St</p>
            <p className="text-sm">Tel: 555-0123</p>
          </div>
          <div className="mb-4">
            <p>Date: {new Date(lastSale.createdAt).toLocaleString()}</p>
            <p className="font-bold">Receipt #: {lastSale.receiptNumber}</p>
            <p>Payment: {lastSale.paymentMethod}</p>
          </div>
          <table className="w-full mb-4 text-left">
            <thead>
              <tr className="border-b border-black">
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lastSale.items.map((item: any) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">${item.price.toFixed(2)}</td>
                  <td className="py-2 text-right">${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-right space-y-1">
             <p className="text-sm">Net Total: ${(lastSale.netAmount || 0).toFixed(2)}</p>
             <p className="text-sm border-b border-black inline-block">VAT (15%): ${(lastSale.taxAmount || 0).toFixed(2)}</p>
             <p className="font-bold text-xl pt-2">Total Amount: ${lastSale.totalAmount.toFixed(2)}</p>
          </div>
          <div className="mt-8 text-center text-sm">
            <p>Thank you for shopping with us!</p>
          </div>
        </div>

        {/* Screen UI */}
        <div className="bg-white p-12 rounded-2xl shadow-xl flex flex-col items-center text-center max-w-md w-full print:hidden">
          <CheckCircle size={64} className="text-green-500 mb-6" />
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Sale Complete!</h1>
          <p className="text-slate-500 mb-8">Total: ${lastSale.totalAmount.toFixed(2)}</p>
          
          <div className="w-full bg-slate-100 p-4 rounded-lg mb-8 text-left">
            <p className="text-sm text-slate-500">Receipt ID: #{lastSale.id.slice(0,8)}</p>
            <p className="text-sm text-slate-500">Method: {lastSale.paymentMethod}</p>
          </div>

          <div className="flex gap-4 w-full">
            <button 
              onClick={handlePrintReceipt}
              className="flex-1 bg-slate-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-900"
            >
              Print Receipt
            </button>
            <button 
              onClick={() => setLastSale(null)}
              className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700"
            >
              New Sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main POS View
  return (
    <div className="h-screen w-full bg-slate-100 flex overflow-hidden">
      
      {/* LEFT: Products Grid */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* Navigation / Logout Button */}
        <div className="flex justify-between items-center mb-4 min-h-[40px]">
          <div>
            {!user ? (
              <div className="h-10 w-32 bg-slate-200 animate-pulse rounded-full"></div>
            ) : user.role === 'CASHIER' ? (
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors inline-flex items-center group"
              >
                <LogOut size={24} className="mr-2 group-hover:scale-110 transition-transform" />
                <span className="font-medium text-lg">Logout</span>
              </button>
            ) : (
              <Link href="/" className="p-2 hover:bg-slate-200 rounded-full transition-colors inline-flex items-center">
                <ArrowLeft size={24} className="text-slate-600 mr-2" />
                <span className="text-slate-600 font-medium">Back to Dashboard</span>
              </Link>
            )}
          </div>

          {user && (user.role === 'ADMIN' || user.role === 'MASTER') && shops.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <Store size={20} className="text-blue-500" />
              <select 
                className="bg-transparent text-sm font-bold outline-none cursor-pointer text-slate-700"
                value={user.shopId || ''}
                onChange={(e) => handleShopChange(e.target.value)}
              >
                {shops.map(shop => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {user && (
            <div className="text-right hidden md:block">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1">{user.role}</p>
              <p className="text-sm font-bold text-slate-700 leading-none">{user.name}</p>
            </div>
          )}
        </div>
        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4">
          <Search className="text-slate-400" />
          <input 
            ref={searchInputRef}
            autoFocus
            placeholder="Search products or scan barcode..." 
            className="flex-1 text-lg outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          {heldSales.length > 0 && (
            <button 
              onClick={() => setShowHeldModal(true)}
              className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-bold text-sm hover:bg-amber-200 transition-colors"
            >
              Held Orders ({heldSales.length})
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
          {loading && products.length === 0 ? (
            <div className="col-span-full flex justify-center py-20 text-slate-400">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="col-span-full flex justify-center py-20 text-slate-400">No products found</div>
          ) : (
            products.map(product => {
              const outOfStock = product.stockQuantity <= 0;
              return (
                <button 
                  key={product.id}
                  disabled={outOfStock}
                  onClick={() => addToCart(product)}
                  className={`
                    flex flex-col p-4 rounded-xl text-left transition-all border
                    ${outOfStock 
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' 
                      : 'bg-white border-white hover:border-blue-500 hover:shadow-md active:scale-95'
                    }
                    ${loading ? 'opacity-50' : ''}
                  `}
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{product.sku}</p>
                  </div>
                  <div className="mt-4 flex justify-between items-end">
                    <span className="font-bold text-lg text-blue-600">${product.sellingPrice.toFixed(2)}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${outOfStock ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                      {outOfStock ? 'Empty' : `${product.stockQuantity} Left`}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* RIGHT: Cart & Checkout */}
      <div className="w-[400px] bg-white flex flex-col border-l border-slate-200 shadow-xl z-10">
        
        {/* Cart Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Current Order</h2>
          <button onClick={clearCart} className="text-red-500 text-sm hover:bg-red-50 px-3 py-1 rounded-lg transition-colors">
            Clear
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="p-4 bg-slate-50 rounded-full">
                <Search size={32} />
              </div>
              <p>Scan or click items to add</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.cartId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-700">{item.name}</h4>
                  <p className="text-sm text-blue-600 font-medium">${(item.sellingPrice * item.quantity).toFixed(2)}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm">
                    <button 
                      onClick={() => updateQuantity(item.cartId, -1)}
                      className="p-2 hover:bg-slate-50 text-slate-600"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center font-bold text-slate-800">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.cartId, 1)}
                      className="p-2 hover:bg-slate-50 text-slate-600"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.cartId)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: Totals & Payments */}
        <div className="p-6 bg-slate-50 border-t border-slate-200">
          <div className="flex gap-2 mb-4">
             <button 
                onClick={holdSale}
                disabled={cart.length === 0}
                className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-100 disabled:opacity-50"
             >
               Hold Sale
             </button>
          </div>

          <div className="flex justify-between items-center mb-4">
             <span className="text-slate-500 text-sm">Subtotal</span>
             <span className="text-slate-700 font-semibold">${subTotal.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between items-center mb-6">
             <span className="text-slate-500 text-sm flex items-center gap-2">
               Discount
             </span>
             <div className="flex items-center gap-1">
               <span className="text-slate-400">$</span>
               <input 
                 type="number" 
                 min="0"
                 className="w-20 p-1 border rounded text-right focus:ring-2 focus:ring-blue-500 outline-none"
                 value={discount}
                 onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
               />
             </div>
          </div>

          <div className="flex justify-between items-center mb-6 pt-4 border-t border-slate-100">
            <span className="text-slate-500 text-lg">Total</span>
            <span className="text-3xl font-bold text-slate-800">${totalAmount.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button 
              disabled={processing || cart.length === 0}
              onClick={() => handleCheckout('CASH')}
              className="flex flex-col items-center justify-center p-4 bg-green-600 text-white rounded-xl hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              <Banknote className="mb-1" />
              <span className="font-semibold text-sm">Cash</span>
            </button>
            
            <button 
              disabled={processing || cart.length === 0}
              onClick={() => handleCheckout('CARD')}
              className="flex flex-col items-center justify-center p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              <CreditCard className="mb-1" />
              <span className="font-semibold text-sm">Card</span>
            </button>

            <button 
              disabled={processing || cart.length === 0}
              onClick={() => handleCheckout('MOBILE')}
              className="flex flex-col items-center justify-center p-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              <Smartphone className="mb-1" />
              <span className="font-semibold text-sm">Mobile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Held Orders Modal */}
      {showHeldModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">Held Orders</h3>
              <button onClick={() => setShowHeldModal(false)} className="text-slate-400 hover:text-slate-600">
                <Plus className="rotate-45" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {heldSales.length === 0 ? (
                <p className="text-center py-10 text-slate-400">No held orders</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {heldSales.map((sale) => (
                    <div key={sale.id} className="p-4 border rounded-xl flex justify-between items-center hover:bg-slate-50">
                      <div>
                        <p className="font-bold text-slate-700">
                          {sale.items.length} items - ${sale.totalAmount.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-400">
                          Held at: {new Date(sale.id).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => deleteHeldSale(sale.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button 
                          onClick={() => recallSale(sale)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold"
                        >
                          Recall
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}