import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/auth';
import { withAuth } from '@/lib/api-middleware';
import { cookies } from 'next/headers';

export const PATCH = withAuth(async (request, { user }) => {
  try {
    const { shopId } = await request.json();

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
    }

    // Role-based validation
    if (user.role === 'MASTER') {
      user.shopId = shopId;
    } else if (user.role === 'ADMIN') {
      const isManaged = user.managedShops?.includes(shopId);
      const isPrimary = user.shopId === shopId;
      
      if (isManaged || isPrimary) {
        user.shopId = shopId;
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the session cookie
    const expires = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const encryptedSession = await encrypt({ user, expires });
    cookies().set("session", encryptedSession, { expires, httpOnly: true });

    return NextResponse.json({ success: true, shopId: user.shopId });
  } catch (error) {
    console.error("Session Update Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
