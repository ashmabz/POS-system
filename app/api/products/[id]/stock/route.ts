import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await request.json();
  const { stockQuantity, shopId } = body; // Expecting shopId for consistency

  if (typeof stockQuantity !== 'number' || stockQuantity < 0) {
    return NextResponse.json({ error: 'Invalid stock quantity' }, { status: 400 });
  }

  // IMPORTANT: In a real application, you would perform role-based authorization here.
  // For example, check if the current user (from session) has 'MANAGER' or 'MASTER' role.
  // if (currentUserRole !== 'MANAGER' && currentUserRole !== 'MASTER') {
  //   return NextResponse.json({ error: 'Unauthorized to update stock' }, { status: 403 });
  // }

  try {
    const updatedProduct = await prisma.product.update({
      where: { id: id },
      data: { stockQuantity: stockQuantity },
    });

    // Log the inventory change
    await prisma.inventoryLog.create({
      data: {
        type: 'ADJUSTMENT',
        quantity: stockQuantity - updatedProduct.stockQuantity, // Calculate difference
        productId: id,
        note: `Manual stock adjustment to ${stockQuantity}`,
        shopId: shopId, // Assuming shopId is passed from frontend or derived from user session
      },
    });

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error("Error updating product stock:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return NextResponse.json({ error: 'Failed to update product stock' }, { status: 500 });
  }
}
