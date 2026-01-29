import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export type AuthenticatedHandler = (
  request: Request,
  context: { params: any; user: any }
) => Promise<NextResponse> | NextResponse;

export function withAuth(
  handler: AuthenticatedHandler,
  allowedRoles?: string[]
) {
  return async (request: Request, context: { params: any }) => {
    try {
      const session = await getSession();

      if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (allowedRoles && !allowedRoles.includes(session.user.role)) {
        return NextResponse.json(
          { error: `Forbidden: ${allowedRoles.join('/')} access required` },
          { status: 403 }
        );
      }

      // Execute the handler with user injected into context
      return await handler(request, { ...context, user: session.user });
    } catch (error) {
      console.error('API Auth Middleware Error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}
