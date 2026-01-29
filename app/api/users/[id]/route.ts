import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    // IMPORTANT: In a real application, the current user's ID would be obtained from an authenticated session.
    // For demonstration, we'll assume a 'current_user_id' is provided, perhaps in a request header or body.
    // In a production environment, this would come from a secure authentication system (e.g., JWT token in Authorization header).
    const currentUserId = request.headers.get('x-current-user-id'); // Placeholder: expects client to send this
    const currentUserRole = request.headers.get('x-current-user-role'); // Placeholder: expects client to send this

    if (!currentUserId || !currentUserRole) {
      // If authentication context is missing, deny the request or handle as unauthenticated
      return NextResponse.json({ error: 'Authentication context missing.' }, { status: 401 });
    }

    const userToDelete = await prisma.user.findUnique({
      where: { id: id },
    });

    if (!userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent a manager/master from deleting their *own* account
    if (id === currentUserId && (userToDelete.role === "MASTER" || userToDelete.role === "ADMIN")) {
      return NextResponse.json(
        { error: `A ${userToDelete.role} cannot delete their own account.` },
        { status: 403 } // Forbidden
      );
    }

    // Additional checks based on role hierarchy:
    // 1. A non-MASTER user cannot delete a MASTER account.
    if (userToDelete.role === "MASTER" && currentUserRole !== "MASTER") {
        return NextResponse.json(
            { error: 'Only a MASTER can delete other MASTER accounts (if allowed by policy).' },
            { status: 403 } // Forbidden
        );
    }

    // 2. An ADMIN user cannot delete another ADMIN user (if that's the policy, otherwise remove)
    // if (userToDelete.role === "ADMIN" && currentUserRole === "ADMIN") {
    //     return NextResponse.json(
    //         { error: 'ADMIN users cannot delete other ADMIN users.' },
    //         { status: 403 } // Forbidden
    //     );
    // }


    await prisma.user.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
