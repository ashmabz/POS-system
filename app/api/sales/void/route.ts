import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

export const POST = withAuth(async (request, { user }) => {
  try {
    const { saleId, reason } = await request.json();

    if (!saleId || !reason) {
      return NextResponse.json({ error: 'Sale ID and reason are required' }, { status: 400 });
    }

    // Transaction: Mark void, return stock, log
    await prisma.$transaction(async (tx) => {
      // 1. Fetch Sale
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true }
      });

      if (!sale) throw new Error('Sale not found');
      if (sale.shopId !== user.shopId) throw new Error('Forbidden');
      if (sale.status === 'VOIDED') throw new Error('Sale already voided');

      // 2. Update Sale Status
      await tx.sale.update({
        where: { id: saleId },
        data: {
          status: 'VOIDED',
          voidedById: user.id,
          voidReason: reason
        }
      });

      // 3. Return Stock
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } }
        });

        await tx.inventoryLog.create({
          data: {
            type: 'ADJUSTMENT',
            quantity: item.quantity,
            productId: item.productId,
            shopId: sale.shopId,
            note: `Voided Sale #${sale.receiptNumber || sale.id.slice(0, 8)}: ${reason}`
          }
        });
      }

      // 4. Create Audit Log
      await tx.auditLog.create({
        data: {
          action: 'VOID_SALE',
          details: `Reason: ${reason}`,
          entityId: saleId,
          userId: user.id,
          shopId: user.shopId
        }
      });
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Void Sale Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to void sale' }, { status: 500 });
  }
}, ['ADMIN', 'MASTER']);
