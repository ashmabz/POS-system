import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { login } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { loginSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const result = loginSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input', details: result.error.format() }, { status: 400 });
    }

    const { username, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        managedShops: {
          select: { id: true, name: true }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Create session
    await login({
      id: user.id,
      username: user.username,
      role: user.role,
      shopId: user.shopId, // Still useful for Cashiers
      name: user.name,
      // For Admins/Managers:
      managedShops: user.managedShops.map(s => s.id) 
    });
    
    // Audit Log
    await createAuditLog('LOGIN', `User logged in`, user.id, user.shopId);

    return NextResponse.json({ success: true, role: user.role });

  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
