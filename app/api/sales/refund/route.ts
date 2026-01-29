import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Role check: Admin or Master for refunds
    if (session.user.role !== 'MASTER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { saleId, items, reason } = await request.json();

    if (!saleId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Invalid refund data' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch original sale
      const originalSale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true }
      });

      if (!originalSale) throw new Error('Original sale not found');

      let totalRefunded = 0;
      let taxRefunded = 0;
      let netRefunded = 0;
      const refundItemsData = [];

      // 2. Process each item to be refunded
      for (const refundItem of items) {
        const originalItem = originalSale.items.find(i => i.productId === refundItem.productId);
        if (!originalItem) throw new Error(`Item ${refundItem.name} was not part of original sale`);
        
        if (refundItem.quantity > originalItem.quantity) {
          throw new Error(`Cannot refund more than originally purchased for ${refundItem.name}`);
        }

        const proportion = refundItem.quantity / originalItem.quantity;
        const itemRefundGross = originalItem.price * refundItem.quantity;
        const itemRefundTax = originalItem.taxAmount * proportion;
        const itemRefundNet = originalItem.netAmount * proportion;

        totalRefunded += itemRefundGross;
        taxRefunded += itemRefundTax;
        netRefunded += itemRefundNet;

        refundItemsData.push({
          productId: refundItem.productId,
          name: refundItem.name,
          quantity: refundItem.quantity,
          price: originalItem.price,
          taxRate: originalItem.taxRate
        });

        // 3. Return stock to inventory
        await tx.product.update({
          where: { id: refundItem.productId },
          data: { stockQuantity: { increment: refundItem.quantity } }
        });

        await tx.inventoryLog.create({
          data: {
            type: 'ADJUSTMENT',
            quantity: refundItem.quantity,
            productId: refundItem.productId,
            shopId: originalSale.shopId,
            note: `Refund for Receipt #${originalSale.receiptNumber || originalSale.id.slice(0, 8)}`
          }
        });
      }

      // 4. Create the Refund Record
      const refund = await tx.refund.create({
        data: {
          originalSaleId: saleId,
          originalReceipt: originalSale.receiptNumber,
          totalRefunded,
          taxRefunded,
          netRefunded,
          reason,
          shopId: originalSale.shopId,
          userId: session.user.id,
          items: {
            create: refundItemsData
          }
        }
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          action: 'REFUND_SALE',
          details: `Refunded $${totalRefunded.toFixed(2)} for Receipt ${originalSale.receiptNumber}. Reason: ${reason}`,
          entityId: refund.id,
          userId: session.user.id,
          shopId: originalSale.shopId
        }
      });

      return refund;
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Refund Error:", error);
    return NextResponse.json({ error: error.message || 'Refund failed' }, { status: 500 });
  }
}
