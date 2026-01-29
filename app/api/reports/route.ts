import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const reqShopId = searchParams.get('shopId');

    // Determine Valid Shop IDs
    let validShopIds: string[] = [];
    
    if (user.role === 'MASTER') {
      if (reqShopId && reqShopId !== 'all') {
        validShopIds = [reqShopId];
      } else {
        const allShops = await prisma.shop.findMany({ select: { id: true } });
        validShopIds = allShops.map(s => s.id);
      }
    } else if (user.role === 'ADMIN') {
      const managedIds = user.managedShops || [];
      if (user.shopId && !managedIds.includes(user.shopId)) {
        managedIds.push(user.shopId);
      }

      if (reqShopId && reqShopId !== 'all') {
        if (managedIds.includes(reqShopId)) {
          validShopIds = [reqShopId];
        } else {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } else {
        validShopIds = managedIds;
      }
    } else {
      if (user.shopId) validShopIds = [user.shopId];
    }

    if (validShopIds.length === 0) {
       return NextResponse.json({ error: 'No shops accessible' }, { status: 400 });
    }

    const startDate = startDateStr ? new Date(startDateStr) : new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const commonWhere = {
      shopId: { in: validShopIds },
      createdAt: { gte: startDate, lte: endDate }
    };

    // 1. High-Performance Aggregations
    const [salesSummary, voidSummary, costSummary, paymentGroups, topSellersRaw] = await Promise.all([
      // Sales Summary
      prisma.sale.aggregate({
        where: { ...commonWhere, status: 'COMPLETED' },
        _sum: { subTotal: true, discount: true, totalAmount: true },
        _count: { id: true }
      }),
      // Void Summary
      prisma.sale.aggregate({
        where: { ...commonWhere, status: 'VOIDED' },
        _count: { id: true },
        _sum: { totalAmount: true }
      }),
      // Cost Summary (Total Cost of Goods Sold)
      prisma.saleItem.aggregate({
        where: { 
          sale: { ...commonWhere, status: 'COMPLETED' } 
        },
        _sum: { costPrice: true } // Note: This needs to be multiplied by quantity. 
        // Prisma aggregate _sum doesn't support expressions like (price * quantity).
        // For precise cost, we might still need some JS or a raw query, 
        // but let's stick to findMany for just items if we must, 
        // OR better, we use groupBy to reduce the set.
      }),
      // Payment Stats
      prisma.sale.groupBy({
        by: ['paymentMethod'],
        where: { ...commonWhere, status: 'COMPLETED' },
        _sum: { totalAmount: true }
      }),
      // Top Sellers
      prisma.saleItem.groupBy({
        by: ['name'],
        where: { 
          sale: { ...commonWhere, status: 'COMPLETED' } 
        },
        _sum: { quantity: true, price: true }, // price here is unit price, revenue needs sum of (price * quantity)
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5
      })
    ]);

    // Since Prisma _sum doesn't do (price * quantity), 
    // we use a slightly more optimized findMany for cost and precise top sellers revenue if needed,
    // but for very large datasets, raw query is best. 
    // For now, let's optimize the summary as much as possible.
    
    const transactionCount = salesSummary._count.id || 0;
    const totalGrossSales = salesSummary._sum.subTotal || 0;
    const totalDiscounts = salesSummary._sum.discount || 0;
    const totalSales = salesSummary._sum.totalAmount || 0;

    // Optimized Cost Calculation
    const soldItems = await prisma.saleItem.findMany({
      where: { sale: { ...commonWhere, status: 'COMPLETED' } },
      select: { quantity: true, costPrice: true, price: true, name: true }
    });

    let totalCost = 0;
    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

    for (const item of soldItems) {
      totalCost += item.costPrice * item.quantity;
      const existing = productMap.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.quantity * item.price;
      productMap.set(item.name, existing);
    }

    const netProfit = totalSales - totalCost;
    const margin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

    const topSellers = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Remaining Data (Recent/History)
    const [recentActivity, inventoryHistory, lowStockItems] = await Promise.all([
      prisma.sale.findMany({
        where: { ...commonWhere, status: 'COMPLETED' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { items: true, user: { select: { name: true } }, shop: { select: { name: true } } }
      }),
      prisma.inventoryLog.findMany({
        where: { ...commonWhere, type: { in: ['RESTOCK', 'DELETE', 'ADJUSTMENT'] } },
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { name: true, sku: true } }, shop: { select: { name: true } } }
      }),
      prisma.product.findMany({
        where: { shopId: { in: validShopIds }, isActive: true, stockQuantity: { lte: 20 } }, // Heuristic filter
        include: { shop: { select: { name: true } } }
      }).then(products => 
        products.filter(p => p.stockQuantity <= p.lowStockLevel)
                .sort((a, b) => a.stockQuantity - b.stockQuantity)
                .slice(0, 10)
      )
    ]);

    return NextResponse.json({
      summary: {
        totalSales,
        transactionCount,
        netProfit,
        margin,
        voidedCount: voidSummary._count.id || 0,
        voidedAmount: voidSummary._sum.totalAmount || 0
      },
      lowStock: lowStockItems,
      recentActivity,
      inventoryHistory,
      topSellers,
      paymentStats: paymentGroups.map(g => ({ method: g.paymentMethod, amount: g._sum.totalAmount || 0 }))
    });

  } catch (error) {
    console.error("Reports Error:", error);
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 });
  }
}, ['ADMIN', 'MASTER']);
