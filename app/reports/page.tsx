'use client';

import { useState, useEffect } from 'react';
import { DollarSign, ShoppingBag, AlertTriangle, Clock, ArrowLeft, History, Archive, PackagePlus, FileDown, TrendingUp, Ban, Trash2, Trophy, FileText, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types ---
interface ReportData {
  summary: {
    totalSales: number;
    transactionCount: number;
    netProfit: number;
    margin: number;
    voidedCount: number;
    voidedAmount: number;
  };
  lowStock: Array<{
    id: string;
    name: string;
    stockQuantity: number;
    sku: string;
    shop?: { name: string };
  }>;
  recentActivity: Array<{
    id: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
    items: Array<{ name: string; quantity: number }>;
    user: { name: string } | null;
    shop?: { name: string };
  }>;
  inventoryHistory: Array<{
    id: string;
    type: string;
    quantity: number;
    note: string | null;
    createdAt: string;
    product: {
      name: string;
      sku: string;
    };
    shop?: { name: string };
  }>;
  topSellers: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  paymentStats: Array<{
    method: string;
    amount: number;
  }>;
}

// Helper to format date to YYYY-MM-DD for input
const toYYYYMMDD = (date: Date) => date.toISOString().split('T')[0];

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(toYYYYMMDD(new Date()));
  const [endDate, setEndDate] = useState(toYYYYMMDD(new Date()));
  
  // Shop Selector State
  const [shops, setShops] = useState<{id: string, name: string}[]>([]);
  const [selectedShopId, setSelectedShopId] = useState('all');

  // Void Logic
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [saleToVoid, setSaleToVoid] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Closure Logic
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('');
  const [isDayClosed, setIsDayClosed] = useState(false);

  useEffect(() => {
    fetchShops();
    checkClosureStatus();
  }, []);

  useEffect(() => {
    fetchReports(startDate, endDate, selectedShopId);
  }, [startDate, endDate, selectedShopId]);

  async function checkClosureStatus() {
    try {
      const res = await fetch('/api/reports/closure');
      if (res.ok) {
        const data = await res.json();
        setIsDayClosed(data.isClosed);
      }
    } catch (e) { console.error(e); }
  }

  async function handleDayClosure(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("Are you sure? This will lock today's sales and generate a Z-Report.")) return;

    try {
      const res = await fetch('/api/reports/closure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          shopId: selectedShopId === 'all' ? null : selectedShopId, 
          openingFloat 
        })
      });

      if (res.ok) {
        alert('Day closed successfully. Z-Report generated.');
        setClosureModalOpen(false);
        setIsDayClosed(true);
        fetchReports(startDate, endDate, selectedShopId);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to close day');
      }
    } catch (e) {
      alert('Network error');
    }
  }

  async function fetchShops() {
    try {
      const res = await fetch('/api/shops');
      if (res.ok) {
        const data = await res.json();
        setShops(data);
      }
    } catch (e) {
      console.error("Failed to fetch shops", e);
    }
  }

  async function fetchReports(start: string, end: string, shopId: string) {
    setLoading(true);
    try {
      const url = new URL('/api/reports', window.location.origin);
      url.searchParams.append('startDate', start);
      url.searchParams.append('endDate', end);
      url.searchParams.append('shopId', shopId);
      
      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleExport = () => {
    if (!data) return;
    
    // Simple CSV Export for Sales Activity
    const headers = ['Sale ID', 'Date', 'Items', 'Total', 'Payment Method', 'User'];
    const rows = data.recentActivity.map(sale => [
      sale.id,
      new Date(sale.createdAt).toLocaleString(),
      sale.items.map(i => `${i.quantity}x ${i.name}`).join('; '),
      sale.totalAmount.toFixed(2),
      sale.paymentMethod,
      sale.user?.name || 'Unknown'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!data) return;

    const doc = new jsPDF();
    const dateRange = startDate === endDate ? startDate : `${startDate} to ${endDate}`;

    // Title
    doc.setFontSize(20);
    doc.text('Sales & Inventory Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Period: ${dateRange}`, 14, 36);

    // Summary Cards
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Summary', 14, 50);

    const summaryData = [
      ['Total Sales', `$${data.summary.totalSales.toFixed(2)}`],
      ['Net Profit', `$${data.summary.netProfit.toFixed(2)}`],
      ['Transactions', data.summary.transactionCount.toString()],
      ['Margin', `${data.summary.margin.toFixed(1)}%`],
      ['Voided', `${data.summary.voidedCount} ($${data.summary.voidedAmount.toFixed(2)})`]
    ];

    autoTable(doc, {
      startY: 55,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: { 0: { fontStyle: 'bold' } },
      margin: { left: 14, right: 100 }
    });

    // Payment Methods
    let finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.text('Payment Methods', 14, finalY);

    const paymentData = data.paymentStats?.map(s => [s.method, `$${s.amount.toFixed(2)}`]) || [];
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Method', 'Revenue']],
      body: paymentData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }, // Blue
      margin: { left: 14, right: 100 }
    });

    // Recent Activity Table
    finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.text('Recent Sales Activity', 14, finalY);

    const salesData = data.recentActivity.map(sale => [
      new Date(sale.createdAt).toLocaleTimeString(),
      `#${sale.id.slice(0, 8)}`,
      sale.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
      sale.paymentMethod,
      `$${sale.totalAmount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Time', 'ID', 'Items', 'Method', 'Amount']],
      body: salesData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96] }, // Green
    });

    // Low Stock Table (if any)
    if (data.lowStock.length > 0) {
      finalY = (doc as any).lastAutoTable.finalY + 15;
      
      // Check if we need a new page
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }
      
      doc.setTextColor(231, 76, 60); // Red
      doc.text('Low Stock Alerts', 14, finalY);
      doc.setTextColor(0);

      const stockData = data.lowStock.map(item => [
        item.name,
        item.sku,
        item.stockQuantity.toString()
      ]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Product', 'SKU', 'Remaining']],
        body: stockData,
        theme: 'striped',
        headStyles: { fillColor: [192, 57, 43] }, // Red
      });
    }

    doc.save(`report_${startDate}.pdf`);
  };

  const openVoidModal = (saleId: string) => {
    setSaleToVoid(saleId);
    setVoidReason('');
    setVoidModalOpen(true);
  };

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToVoid || !voidReason) return;

    if (!confirm('Are you sure you want to void this sale? This action cannot be undone.')) return;

    try {
      const res = await fetch('/api/sales/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId: saleToVoid, reason: voidReason })
      });

      if (res.ok) {
        setVoidModalOpen(false);
        fetchReports(startDate, endDate, selectedShopId); // Refresh data with current filters
        alert('Sale voided successfully.');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to void sale');
      }
    } catch (error) {
      alert('An error occurred');
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading reports...</div>;

  if (!data) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Failed to load data</div>;

  const isDailyReport = startDate === endDate;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 bg-white rounded-full hover:bg-slate-100 shadow-sm transition-colors">
            <ArrowLeft className="text-slate-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              {isDailyReport ? "Daily Report" : "Custom Report"}
            </h1>
            <p className="text-slate-500">
              {isDailyReport 
                ? `Overview for today, ${new Date(startDate).toLocaleDateString()}`
                : `Showing data from ${startDate} to ${endDate}`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          
          {/* Shop Selector */}
          {shops.length > 0 && (
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Shops (Combined)</option>
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2">
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-slate-500">to</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText size={18} />
            Export PDF
          </button>
          
          {selectedShopId !== 'all' && !isDayClosed && (
            <button 
              onClick={() => setClosureModalOpen(true)}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors border border-slate-700"
            >
              <Archive size={18} />
              Close Day
            </button>
          )}

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors"
          >
            <FileDown size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ... (Existing Content) ... */}

      {/* Closure Modal */}
      {closureModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
              <Archive size={24} className="text-blue-600" />
              Daily Closure (Z-Report)
            </h3>
            <div className="bg-blue-50 p-4 rounded-lg mb-4 text-sm text-blue-800">
              <p className="font-bold">Current Totals:</p>
              <p>Sales: ${data?.summary.totalSales.toFixed(2)}</p>
              <p>Tax: ${((data?.summary.totalSales || 0) * 0.15).toFixed(2)} (Est)</p>
            </div>
            <form onSubmit={handleDayClosure}>
              <label className="block text-sm font-medium text-slate-700 mb-1">Opening Float Amount</label>
              <input 
                type="number"
                required
                className="w-full p-3 border rounded-lg mb-6 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.00"
                value={openingFloat}
                onChange={e => setOpeningFloat(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setClosureModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
                >
                  Confirm Closure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-green-100 text-green-600 rounded-xl">
            <DollarSign size={32} />
          </div>
          <div>
            <p className="text-slate-500 font-medium">Revenue</p>
            <h3 className="text-2xl font-bold text-slate-800">${data.summary.totalSales.toFixed(2)}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-emerald-100 text-emerald-600 rounded-xl">
            <TrendingUp size={32} />
          </div>
          <div>
            <p className="text-slate-500 font-medium">Net Profit</p>
            <h3 className="text-2xl font-bold text-slate-800">${data.summary.netProfit.toFixed(2)}</h3>
            <p className="text-xs text-emerald-600 font-bold">{data.summary.margin.toFixed(1)}% Margin</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-xl">
            <ShoppingBag size={32} />
          </div>
          <div>
            <p className="text-slate-500 font-medium">Sales</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.summary.transactionCount}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-red-100 text-red-600 rounded-xl">
            <Ban size={32} />
          </div>
          <div>
            <p className="text-slate-500 font-medium">Voided</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.summary.voidedCount}</h3>
            <p className="text-xs text-red-400">-${data.summary.voidedAmount.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Clock size={20} className="text-slate-400" />
            Recent Sales
          </h2>
          
          <div className="space-y-4">
            {data.recentActivity.map(sale => (
              <div key={sale.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center hover:shadow-md transition-shadow group">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-700">Sale #{sale.id.slice(0, 8)}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{sale.paymentMethod}</span>
                    {selectedShopId === 'all' && sale.shop && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold">{sale.shop.name}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Sold by: <span className="font-medium text-slate-700">{sale.user?.name || 'Unknown'}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(sale.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right flex items-center gap-4">
                  <span className="block text-lg font-bold text-green-600">+${sale.totalAmount.toFixed(2)}</span>
                  <button 
                    onClick={() => openVoidModal(sale.id)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Void Sale"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            {data.recentActivity.length === 0 && (
              <p className="text-slate-400 italic">No sales in this period.</p>
            )}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="space-y-6">
          
          {/* Top Sellers */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Trophy size={20} className="text-yellow-500" />
              Top Selling Items
            </h2>
            <div className="space-y-4">
              {data.topSellers?.map((item, index) => (
                <div key={index} className="flex items-center justify-between border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className={`
                      w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                      ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                        index === 1 ? 'bg-slate-200 text-slate-700' : 
                        index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}
                    `}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.quantity} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-700">${item.revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))}
              {(!data.topSellers || data.topSellers.length === 0) && (
                <p className="text-center text-slate-400 py-4">No sales data for this period.</p>
              )}
            </div>
          </div>

          {/* Sales by Payment Method */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Payment Methods</h2>
            <div className="space-y-4">
              {data.paymentStats?.map((stat) => {
                const percentage = data.summary.totalSales > 0 
                  ? (stat.amount / data.summary.totalSales) * 100 
                  : 0;
                
                return (
                  <div key={stat.method}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{stat.method}</span>
                      <span className="text-slate-500">${stat.amount.toFixed(2)} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          stat.method === 'CASH' ? 'bg-green-500' : 
                          stat.method === 'CARD' ? 'bg-blue-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              {(!data.paymentStats || data.paymentStats.length === 0) && (
                <p className="text-center text-slate-400 py-4">No data</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" />
                Low Stock Alerts
              </h2>
            </div>
            {data.lowStock.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {data.lowStock.map(item => (
                  <div key={item.id} className="p-4 flex justify-between items-center hover:bg-red-50 transition-colors group">
                    <div>
                      <h4 className="font-medium text-slate-800 group-hover:text-red-700">{item.name}</h4>
                      <p className="text-xs text-slate-400">{item.sku}</p>
                    </div>
                    <div className="text-center">
                      <span className="block text-xl font-bold text-red-600">{item.stockQuantity}</span>
                      <span className="text-[10px] text-red-400 uppercase font-bold tracking-wider">Left</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                <p>All stock levels healthy!</p>
              </div>
            )}
            
            {data.lowStock.length > 0 && (
              <div className="p-3 bg-red-50 border-t border-red-100 text-center">
                <Link href="/inventory" className="text-sm font-bold text-red-600 hover:underline">
                  Restock Now &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inventory History Section */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <History size={20} className="text-slate-400" />
          Inventory History
        </h2>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-semibold text-slate-600">Type</th>
                  <th className="p-4 font-semibold text-slate-600">Product</th>
                  <th className="p-4 font-semibold text-slate-600">Quantity</th>
                  <th className="p-4 font-semibold text-slate-600">Time</th>
                  <th className="p-4 font-semibold text-slate-600">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.inventoryHistory?.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      {log.type === 'RESTOCK' && (
                        <span className="flex items-center gap-2 text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-lg w-fit">
                          <PackagePlus size={16} /> Restock
                        </span>
                      )}
                      {log.type === 'DELETE' && (
                        <span className="flex items-center gap-2 text-red-600 font-medium bg-red-50 px-2 py-1 rounded-lg w-fit">
                          <Archive size={16} /> Deleted
                        </span>
                      )}
                      {log.type !== 'RESTOCK' && log.type !== 'DELETE' && (
                        <span className="flex items-center gap-2 text-slate-600 font-medium bg-slate-100 px-2 py-1 rounded-lg w-fit">
                          <History size={16} /> {log.type}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-slate-800">{log.product.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{log.product.sku}</p>
                    </td>
                    <td className="p-4">
                      {log.type === 'RESTOCK' ? (
                        <span className="text-emerald-600 font-bold">+{log.quantity}</span>
                      ) : (
                        <span className="text-slate-400">{log.quantity}</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 text-sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4 text-slate-500 text-sm italic">
                      {log.note || '-'}
                    </td>
                  </tr>
                ))}
                {(!data.inventoryHistory || data.inventoryHistory.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No recent inventory history found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Void Modal */}
      {voidModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2">
              <AlertTriangle size={24} />
              Void Sale
            </h3>
            <p className="text-slate-600 mb-4">
              Are you sure you want to void this sale? Stock will be returned to inventory.
            </p>
            <form onSubmit={handleVoidSubmit}>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Voiding</label>
              <textarea 
                required
                className="w-full p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="e.g., Customer returned items, Accidental entry..."
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setVoidModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
