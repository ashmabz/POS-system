'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Calendar, RefreshCcw, XCircle, ChevronDown, ChevronUp, FileDown, FileText, RotateCcw, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Sale {
  id: string;
  receiptNumber: string;
  totalAmount: number;
  subTotal: number;
  taxAmount?: number;
  netAmount?: number;
  discount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  user: { name: string };
  voidedBy?: { name: string };
  voidReason?: string;
  items: {
    id: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
    taxRate: number;
    taxAmount: number;
    netAmount: number;
  }[];
}

export default function TransactionsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Auth/Role
  const [user, setUser] = useState<any>(null);

  // Void States
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Refund States
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundItems, setRefundItems] = useState<any[]>([]);
  const [refundReason, setRefundReason] = useState('');

  useEffect(() => {
    fetchSales();
    fetchUser();
  }, []);

  async function fetchUser() {
    const res = await fetch('/api/auth/me');
    if (res.ok) setUser(await res.json());
  }

  async function fetchSales() {
    setLoading(true);
    try {
      const res = await fetch('/api/sales');
      if (res.ok) {
        const data = await res.json();
        setSales(data.sales || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleVoid() {
    if (!selectedSale || !voidReason) return;
    try {
      const res = await fetch('/api/sales/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId: selectedSale.id, reason: voidReason })
      });
      if (res.ok) {
        setVoidModalOpen(false);
        setVoidReason('');
        setSelectedSale(null);
        fetchSales();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to void sale');
      }
    } catch (e) { alert('An error occurred'); }
  }

  async function handleRefund() {
    if (!selectedSale || refundItems.length === 0 || !refundReason) return;
    const itemsToRefund = refundItems.filter(i => i.refundQty > 0);
    if (itemsToRefund.length === 0) return alert('Select items to refund');

    try {
      const res = await fetch('/api/sales/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: selectedSale.id, 
          items: itemsToRefund.map(i => ({
            productId: i.productId,
            name: i.name,
            quantity: i.refundQty
          })),
          reason: refundReason
        })
      });

      if (res.ok) {
        setRefundModalOpen(false);
        setRefundReason('');
        setSelectedSale(null);
        fetchSales();
        alert('Refund processed successfully');
      } else {
        const err = await res.json();
        alert(err.error || 'Refund failed');
      }
    } catch (e) { alert('An error occurred'); }
  }

  const openRefundModal = (sale: Sale) => {
    setSelectedSale(sale);
    setRefundItems(sale.items.map(item => ({
      ...item,
      refundQty: 0
    })));
    setRefundReason('');
    setRefundModalOpen(true);
  };

  const updateRefundQty = (productId: string, delta: number, max: number) => {
    setRefundItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const newVal = Math.min(max, Math.max(0, item.refundQty + delta));
        return { ...item, refundQty: newVal };
      }
      return item;
    }));
  };

  const handleExport = () => {
    if (sales.length === 0) return;
    const headers = ['Receipt #', 'Date', 'Time', 'Cashier', 'Method', 'Total', 'Status', 'Items'];
    const rows = sales.map(sale => {
      const date = new Date(sale.createdAt);
      return [
        sale.receiptNumber || `#${sale.id.slice(0, 8)}`,
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        sale.user.name,
        sale.paymentMethod,
        sale.totalAmount.toFixed(2),
        sale.status,
        sale.items.map(i => `${i.quantity}x ${i.name}`).join('; ')
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (sales.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Transactions History', 14, 22);
    const tableData = sales.map(sale => [
      sale.receiptNumber || `#${sale.id.slice(0, 8)}`,
      new Date(sale.createdAt).toLocaleString(),
      sale.user.name,
      sale.paymentMethod,
      `$${sale.totalAmount.toFixed(2)}`,
      sale.status
    ]);
    autoTable(doc, {
      startY: 35,
      head: [['Receipt #', 'Date', 'Cashier', 'Method', 'Total', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [44, 62, 80] },
    });
    doc.save(`transactions_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-slate-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Transactions</h1>
            <p className="text-slate-500">View and manage sales history</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
            <FileText size={18} /> Export PDF
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50">
            <FileDown size={18} /> Export CSV
          </button>
          <button onClick={fetchSales} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <RefreshCcw size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-20 text-center text-slate-400">Loading transactions...</div>
        ) : sales.length === 0 ? (
          <div className="p-20 text-center text-slate-400">No transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-semibold text-slate-600">Date & Time</th>
                  <th className="p-4 font-semibold text-slate-600">Receipt #</th>
                  <th className="p-4 font-semibold text-slate-600">Cashier</th>
                  <th className="p-4 font-semibold text-slate-600">Method</th>
                  <th className="p-4 font-semibold text-slate-600">Total</th>
                  <th className="p-4 font-semibold text-slate-600">Status</th>
                  <th className="p-4 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <React.Fragment key={sale.id}>
                    <tr 
                      className={`border-b hover:bg-slate-50 transition-colors cursor-pointer ${expandedId === sale.id ? 'bg-blue-50/30' : ''}`}
                      onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                    >
                      <td className="p-4 text-slate-700">{new Date(sale.createdAt).toLocaleString()}</td>
                      <td className="p-4 text-slate-500 font-mono text-sm">{sale.receiptNumber || sale.id.slice(0, 8)}</td>
                      <td className="p-4 text-slate-700">{sale.user.name}</td>
                      <td className="p-4"><span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-600">{sale.paymentMethod}</span></td>
                      <td className="p-4 font-bold text-slate-900">${sale.totalAmount.toFixed(2)}</td>
                      <td className="p-4"><span className={`text-xs font-bold px-2 py-1 rounded ${sale.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{sale.status}</span></td>
                      <td className="p-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)} className="p-1 hover:bg-slate-200 rounded">
                          {expandedId === sale.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                        {sale.status === 'COMPLETED' && (user?.role === 'MASTER' || user?.role === 'ADMIN') && (
                          <>
                            <button 
                              onClick={() => openRefundModal(sale)}
                              className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded"
                              title="Refund"
                            >
                              <RotateCcw size={20} />
                            </button>
                            <button 
                              onClick={() => { setSelectedSale(sale); setVoidModalOpen(true); }}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Void Sale"
                            >
                              <XCircle size={20} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {expandedId === sale.id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="p-6 border-b">
                          <div className="grid grid-cols-2 gap-8">
                            <div>
                              <h4 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-4">Items Sold</h4>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-slate-400 border-b">
                                    <th className="text-left py-2">Item</th>
                                    <th className="text-center py-2">Qty</th>
                                    <th className="text-right py-2">Price</th>
                                    <th className="text-right py-2">Tax</th>
                                    <th className="text-right py-2">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sale.items.map(item => (
                                    <tr key={item.id} className="border-b border-slate-100">
                                      <td className="py-2 text-slate-700">{item.name}</td>
                                      <td className="py-2 text-center text-slate-500">{item.quantity}</td>
                                      <td className="py-2 text-right text-slate-500">${item.price.toFixed(2)}</td>
                                      <td className="py-2 text-right text-slate-400">${(item.taxAmount || 0).toFixed(2)}</td>
                                      <td className="py-2 text-right text-slate-700 font-medium">${(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 h-fit">
                               <div className="flex justify-between py-1"><span className="text-slate-500 text-sm">Gross Amount</span><span className="text-slate-700">${sale.subTotal.toFixed(2)}</span></div>
                               <div className="flex justify-between py-1"><span className="text-slate-500 text-sm">VAT Amount</span><span className="text-slate-700">${(sale.taxAmount || 0).toFixed(2)}</span></div>
                               <div className="flex justify-between py-1"><span className="text-slate-500 text-sm">Net Amount</span><span className="text-slate-700">${(sale.netAmount || 0).toFixed(2)}</span></div>
                               <div className="flex justify-between py-1"><span className="text-slate-500 text-sm">Discount</span><span className="text-red-500">-${sale.discount.toFixed(2)}</span></div>
                               <div className="flex justify-between py-2 border-t mt-2 font-bold text-lg"><span>Total</span><span className="text-blue-600">${sale.totalAmount.toFixed(2)}</span></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Void Modal */}
      {voidModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-1 text-slate-800">Void Transaction</h3>
            <p className="text-sm text-slate-500 mb-4">Are you sure you want to void sale {selectedSale?.receiptNumber || selectedSale?.id.slice(0, 8)}?</p>
            <textarea className="w-full p-3 border rounded-lg mb-4" placeholder="Reason..." rows={3} value={voidReason} onChange={e => setVoidReason(e.target.value)} />
            <div className="flex justify-end gap-3">
              <button onClick={() => setVoidModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
              <button onClick={handleVoid} className="px-4 py-2 bg-red-600 text-white rounded-lg">Void Sale</button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl">
            <h3 className="text-xl font-bold mb-1 text-slate-800">Process Refund</h3>
            <p className="text-sm text-slate-500 mb-4">Receipt: {selectedSale?.receiptNumber}</p>
            
            <div className="max-h-[40vh] overflow-y-auto mb-4 border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-center">Orig Qty</th>
                    <th className="p-3 text-center">Refund Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {refundItems.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => updateRefundQty(item.productId, -1, item.quantity)} className="p-1 border rounded hover:bg-slate-50"><Minus size={14}/></button>
                          <span className="w-8 text-center font-bold">{item.refundQty}</span>
                          <button onClick={() => updateRefundQty(item.productId, 1, item.quantity)} className="p-1 border rounded hover:bg-slate-50"><Plus size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Refund</label>
            <textarea className="w-full p-3 border rounded-lg mb-4" placeholder="Enter reason..." rows={2} value={refundReason} onChange={e => setRefundReason(e.target.value)} />

            <div className="flex justify-end gap-3">
              <button onClick={() => setRefundModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
              <button onClick={handleRefund} className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold">Process Refund</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';