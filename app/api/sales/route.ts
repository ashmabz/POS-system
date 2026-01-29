import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';
import crypto from 'crypto';

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const { items, paymentMethod, totalAmount } = body;

    // 1. Validate the Request
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // 2. Perform Everything in a Transaction
    const saleResult = await prisma.$transaction(async (tx) => {
      
      // A. Use Authenticated User
      const userId = user.id;
      let shopId = user.shopId;
      
      if (!shopId) {
        let shop = await tx.shop.findFirst();
        if (!shop) {
          throw new Error("No shops found. Please configure a shop first.");
        }
        shopId = shop.id;
      }

      // ZIMRA COMPLIANCE: Prevent sales if day is already closed
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const closure = await tx.dayClosure.findFirst({
        where: { shopId: shopId, date: today }
      });
      if (closure) {
        throw new Error("Cannot perform sale: The business day is already closed for this shop.");
      }

      const discount = body.discount || 0;
      let calculatedSubTotal = 0;
      const saleItemsData = [];

      // B. Check Stock Levels & Prepare Item Data
      let totalTaxAmount = 0;
      let totalNetAmount = 0;

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        
        if (!product) {
          throw new Error(`Product not found: ${item.name}`);
        }
        
        if (product.stockQuantity < item.quantity) {
          throw new Error(`Insufficient stock for ${item.name}. Available: ${product.stockQuantity}`);
        }

        const taxRate = product.taxRate || 15.0;
        const grossTotal = item.price * item.quantity;
        
        // ZIMRA VAT Logic: Price is inclusive
        // Net = Gross / (1 + Rate/100)
        // Tax = Gross - Net
        const netTotal = grossTotal / (1 + (taxRate / 100));
        const taxTotal = grossTotal - netTotal;

        totalTaxAmount += taxTotal;
        totalNetAmount += netTotal;
        calculatedSubTotal += grossTotal;
        
        saleItemsData.push({
          productId: item.productId,
          name: item.name,
          price: item.price,
          costPrice: product.costPrice, 
          quantity: item.quantity,
          taxRate: taxRate,
          taxAmount: taxTotal,
          netAmount: netTotal
        });
      }

      // Verify total matches
      const finalTotal = calculatedSubTotal - discount;

      // C. Generate Receipt Number
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      const salesCount = await tx.sale.count({
        where: {
          shopId: shopId,
          createdAt: { gte: startOfYear }
        }
      });
      
      const seq = (salesCount + 1).toString().padStart(6, '0');
      const year = new Date().getFullYear();
      const receiptNumber = `RCPT-${shopId.slice(0,4).toUpperCase()}-${year}-${seq}`;

      // ZIMRA COMPLIANCE: Hash Chaining
      const lastSale = await tx.sale.findFirst({
        where: { shopId: shopId },
        orderBy: { createdAt: 'desc' }
      });

      const prevHash = lastSale?.hash || "00000000000000000000000000000000";
      const hashData = `${receiptNumber}|${finalTotal}|${today.toISOString()}|${prevHash}`;
      const hash = crypto.createHash('sha256').update(hashData).digest('hex');

      // D. Create the Sale Record
      const sale = await tx.sale.create({
        data: {
          receiptNumber,
          totalAmount: finalTotal,
          subTotal: calculatedSubTotal,
          netAmount: totalNetAmount,
          taxAmount: totalTaxAmount,
          discount: discount,
          paymentMethod,
          userId: userId,
          shopId: shopId,
          hash: hash,
          previousHash: prevHash,
          items: {
            create: saleItemsData
          }
        },
        include: { items: true }
      });

      // E. Update Stock & Log Movement
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } }
        });

        await tx.inventoryLog.create({
          data: {
            type: 'SALE',
            quantity: -item.quantity,
            productId: item.productId,
            note: `Sale #${sale.id.slice(0, 8)}`,
            shopId: shopId
          }
        });
      }

      return sale;
    });

    return NextResponse.json(saleResult);

  } catch (error: any) {
    console.error("Sale Error:", error);
    return NextResponse.json({ error: error.message || 'Transaction failed' }, { status: 500 });
  }
});

export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = user.shopId;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: any = { shopId };
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          user: { select: { name: true } },
          voidedBy: { select: { name: true } }
        },
        skip,
        take: limit
      }),
      prisma.sale.count({ where })
    ]);

    return NextResponse.json({
      sales,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page
      }
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
});
