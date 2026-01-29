import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt, updateSession } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  
  // 1. Define Protected Routes
  const isAuthRoute = request.nextUrl.pathname.startsWith('/api/auth');
  const isLoginPars = request.nextUrl.pathname === '/login';
  const isPublic = isAuthRoute || isLoginPars;

  if (isPublic) {
    return NextResponse.next();
  }

  // 2. Check Session
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const payload = await decrypt(session);
    const user = payload.user;

    // 3. Role-Based Access Control
    const path = request.nextUrl.pathname;

    // MASTER Only Areas
    if (path.startsWith('/master') && user.role !== 'MASTER') {
      return NextResponse.redirect(new URL('/', request.url)); // Access Denied
    }

    // ADMIN Areas (Master can also access)
    if (path.startsWith('/inventory') || path.startsWith('/reports') || path.startsWith('/settings')) {
      if (user.role !== 'ADMIN' && user.role !== 'MASTER') {
         return NextResponse.redirect(new URL('/pos', request.url)); // Only Admin/Master allowed
      }
    }

    return await updateSession(request);

  } catch (e) {
    // Invalid token
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
