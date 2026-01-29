import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';
import { createUserSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';

export const GET = withAuth(async (request, { user }) => {
  // ... (remains same)
  // Only Admin and Master can view users
  const whereClause = user.role === 'MASTER' ? {} : { shopId: user.shopId };

  const users = await prisma.user.findMany({
    where: whereClause,
    select: { id: true, username: true, name: true, role: true, createdAt: true }
  });

  return NextResponse.json(users);
}, ['ADMIN', 'MASTER']);

export const POST = withAuth(async (request, { user }) => {
  try {
    const json = await request.json();
    const result = createUserSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input', details: result.error.format() }, { status: 400 });
    }

    const { username, password, name, role, managedShopIds, shopId } = result.data;

    // Default to CASHIER if not specified, or force CASHIER if Shop Admin
    let newRole = 'CASHIER';
    if (user.role === 'MASTER') {
       // Validate allowed roles
       if (role === 'ADMIN' || role === 'CASHIER' || role === 'MASTER') {
         newRole = role;
       } else {
         newRole = 'ADMIN'; 
       }
    }
    
    // Shop ID Logic:
    const targetShopId = user.role === 'MASTER' ? shopId : user.shopId;
    const hashedPassword = await bcrypt.hash(password, 10);

    const data: any = {
        username,
        password: hashedPassword,
        name,
        role: newRole,
        shopId: targetShopId
    };

    // If MASTER is creating an ADMIN (Manager) and provided a list of shops to manage
    if (user.role === 'MASTER' && newRole === 'ADMIN' && Array.isArray(managedShopIds)) {
      data.managedShops = {
        connect: managedShopIds.map((id: string) => ({ id }))
      };
    }

    const newUser = await prisma.user.create({
      data
    });

    return NextResponse.json({ 
      success: true, 
      user: { id: newUser.id, username: newUser.username, role: newUser.role } 
    });

  } catch (error) {
    console.error("Create User Error:", error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}, ['ADMIN', 'MASTER']);
