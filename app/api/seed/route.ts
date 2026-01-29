import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';

export async function GET() {
  try {
    // 1. Clean up
    await prisma.saleItem.deleteMany()
    await prisma.sale.deleteMany()
    await prisma.inventoryLog.deleteMany()
    await prisma.product.deleteMany()
    await prisma.user.deleteMany()
    await prisma.shop.deleteMany()

    // 2. Create Master Admin (System Owner)
    const masterPassword = await bcrypt.hash('admin123', 10)
    const master = await prisma.user.create({
      data: {
        username: 'admin',
        password: masterPassword,
        name: 'Master Admin',
        role: 'MASTER',
        shopId: null
      }
    })

    // 3. Create a Demo Shop
    const shop = await prisma.shop.create({
      data: {
        name: 'Downtown Store',
        address: '123 Main St'
      }
    })

    // 4. Create Shop Admin (Owner of this shop)
    const managerPassword = await bcrypt.hash('123', 10)
    await prisma.user.create({
      data: {
        username: 'manager',
        password: managerPassword,
        name: 'Shop Manager',
        role: 'ADMIN',
        shopId: shop.id
      }
    })

    // 5. Create Cashier
    const cashierPassword = await bcrypt.hash('123', 10)
    await prisma.user.create({
      data: {
        username: 'cashier',
        password: cashierPassword,
        name: 'Jane Doe',
        role: 'CASHIER',
        shopId: shop.id
      }
    })

    return NextResponse.json({ success: true, message: "Database seeded successfully" });
  } catch (error: any) {
    console.error("Seed Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
