import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';
import { createShopSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';

export const GET = withAuth(async (request, { user }) => {
  // ... (remains same)
  interface ShopData {
    id: string;
    name: string;
    address: string | null;
  }

  let shops: ShopData[] = [];

  if (user.role === 'MASTER') {
    shops = await prisma.shop.findMany({
      select: { id: true, name: true, address: true }
    });
  } else if (user.role === 'ADMIN') {
    // Fetch managed shops
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { 
        managedShops: { select: { id: true, name: true, address: true } },
        shop: { select: { id: true, name: true, address: true } } 
      }
    });

    if (dbUser) {
      const managed = dbUser.managedShops || [];
      // Include primary shop if distinct
      if (dbUser.shop && !managed.some(s => s.id === dbUser.shop?.id)) {
        managed.push(dbUser.shop);
      }
      shops = managed;
    }
  } else {
    // Cashier
    if (user.shopId) {
      const shop = await prisma.shop.findUnique({
        where: { id: user.shopId },
        select: { id: true, name: true, address: true }
      });
      if (shop) shops = [shop];
    }
  }

  return NextResponse.json(shops);
});

export const POST = withAuth(async (request) => {
  const json = await request.json();
  const result = createShopSchema.safeParse(json);

  if (!result.success) {
    return NextResponse.json({ error: 'Invalid input', details: result.error.format() }, { status: 400 });
  }

  const { shopName, adminUsername, adminPassword } = result.data;

  const shop = await prisma.shop.create({
    data: {
      name: shopName,
      staff: {
        create: {
          username: adminUsername,
          password: await bcrypt.hash(adminPassword, 10),
          role: 'ADMIN',
          name: 'Shop Admin'
        }
      }
    }
  });

  return NextResponse.json(shop);
}, ['MASTER']);
