import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';
import { createAuditLog } from '@/lib/audit';
import { createProductSchema } from '@/lib/validations';

export const GET = withAuth(async (request, { user }) => {
  // ... (remains same)
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const whereClause: any = { 
      isActive: true,
      shopId: user.shopId
    };

    if (category && category !== 'All') {
      whereClause.category = category;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        orderBy: { name: 'asc' },
        skip: skip,
        take: limit,
      }),
      prisma.product.count({ where: whereClause })
    ]);

    return NextResponse.json({
      products,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page
      }
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const shopId = user.shopId;
    if (!shopId) {
      return NextResponse.json({ error: 'User does not belong to a shop' }, { status: 400 });
    }

    const json = await request.json();
    const result = createProductSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input', details: result.error.format() }, { status: 400 });
    }

    const data = result.data;

    const product = await prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        sellingPrice: data.sellingPrice,
        costPrice: data.costPrice,
        taxRate: data.taxRate,
        stockQuantity: data.stockQuantity,
        lowStockLevel: data.lowStockLevel,
        category: data.category || 'Uncategorized',
        shopId: shopId as string,
      }
    });
    
    // Log initial inventory movement
    if (product.stockQuantity > 0) {
      await prisma.inventoryLog.create({
        data: {
          type: 'RESTOCK',
          quantity: product.stockQuantity,
          productId: product.id,
          note: 'Initial Stock',
          shopId: shopId,
        }
      });
    }
    
    // Audit Log
    await createAuditLog(
      'CREATE_PRODUCT', 
      `Created ${product.name} (${product.sku}) with stock ${product.stockQuantity}`,
      user.id, 
      shopId, 
      product.id
    );

    return NextResponse.json(product);
  } catch (error: any) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}, ['ADMIN', 'MASTER']);
