import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const shopId = session.user.shopId;
    if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const closure = await prisma.dayClosure.findFirst({
      where: {
        shopId: shopId,
        date: today
      }
    });

    return NextResponse.json({ isClosed: !!closure, closure });
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching closure status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (session.user.role !== 'ADMIN' && session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { shopId, openingFloat } = await request.json();
    const targetShopId = shopId || session.user.shopId;

    if (!targetShopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Check if already closed
    const existing = await prisma.dayClosure.findFirst({
      where: { shopId: targetShopId, date: today }
    });

    if (existing) {
      return NextResponse.json({ error: 'Day already closed' }, { status: 400 });
    }

    // Calculate totals for the day
    const sales = await prisma.sale.findMany({
      where: {
        shopId: targetShopId,
        createdAt: { gte: today, lt: tomorrow },
        status: 'COMPLETED'
      }
    });

    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalTax = sales.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
    const totalCash = sales.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCard = sales.filter(s => s.paymentMethod === 'CARD').reduce((sum, s) => sum + s.totalAmount, 0);
    const totalMobile = sales.filter(s => s.paymentMethod === 'MOBILE').reduce((sum, s) => sum + s.totalAmount, 0);

    const closure = await prisma.dayClosure.create({
      data: {
        shopId: targetShopId,
        date: today,
        openingFloat: parseFloat(openingFloat || 0),
        totalSales,
        totalTax,
        totalCash,
        totalCard,
        totalMobile,
        closedById: session.user.id
      }
    });
    
    await createAuditLog('DAY_CLOSURE', `Closed day with total sales: ${totalSales}`, session.user.id, targetShopId);

    return NextResponse.json(closure);

  } catch (error: any) {
    console.error("Closure Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to close day' }, { status: 500 });
  }
}
