import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check: Only MASTER or ADMIN can update products
    if (session.user.role !== 'MASTER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const shopId = session.user.shopId;
    if (!shopId) {
      return NextResponse.json({ error: 'User does not belong to a shop' }, { status: 400 });
    }

    // Verify product ownership
    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (existingProduct.shopId !== shopId) {
      return NextResponse.json({ error: 'Forbidden: Product belongs to another shop' }, { status: 403 });
    }

    const body = await request.json();
    const { lowStockLevel, stockAdjustment, note } = body;

    if (lowStockLevel !== undefined) {
      if (typeof lowStockLevel !== 'number' || lowStockLevel < 0) {
        return NextResponse.json({ error: 'Invalid low stock level' }, { status: 400 });
      }

      const updatedProduct = await prisma.product.update({
        where: { id: id },
        data: { lowStockLevel: lowStockLevel },
      });
      
      await createAuditLog('UPDATE_PRODUCT', `Changed Low Stock Level to ${lowStockLevel}`, session.user.id, shopId, id);

      return NextResponse.json(updatedProduct);
    }

    if (stockAdjustment !== undefined) {
      if (typeof stockAdjustment !== 'number' || stockAdjustment === 0) {
        return NextResponse.json({ error: 'Invalid stock adjustment' }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id } });
        if (!product) throw new Error("Product not found");

        const updatedProduct = await tx.product.update({
          where: { id },
          data: { stockQuantity: { increment: stockAdjustment } }
        });

        await tx.inventoryLog.create({
          data: {
            type: stockAdjustment > 0 ? 'RESTOCK' : 'ADJUSTMENT',
            quantity: stockAdjustment,
            shopId: shopId,
            productId: id,
            note: note || (stockAdjustment > 0 ? 'Manual restock' : 'Manual adjustment')
          }
        });

        return updatedProduct;
      });
      
      await createAuditLog('UPDATE_STOCK', `Adjusted stock by ${stockAdjustment}. Note: ${note}`, session.user.id, shopId, id);

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });

  } catch (error: any) {
    console.error("Error updating product:", error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check
    if (session.user.role !== 'MASTER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const shopId = session.user.shopId;
    if (!shopId) {
      return NextResponse.json({ error: 'User does not belong to a shop' }, { status: 400 });
    }

    // Check if the product exists and belongs to the shop
    const productToDelete = await prisma.product.findUnique({
      where: { id: id },
    });

    if (!productToDelete) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (productToDelete.shopId !== shopId) {
      return NextResponse.json({ error: 'Forbidden: Product belongs to another shop' }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.product.update({
        where: { id: id },
        data: { isActive: false },
      }),
      prisma.inventoryLog.create({
        data: {
          type: 'DELETE',
          quantity: 0,
          shopId: shopId,
          productId: id,
          note: 'Product Deleted'
        }
      })
    ]);
    
    await createAuditLog('DELETE_PRODUCT', `Soft deleted product ${productToDelete.name}`, session.user.id, shopId, id);

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error("Error deleting product:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
