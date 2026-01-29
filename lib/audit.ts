import { prisma } from './prisma';

export async function createAuditLog(
  action: string,
  details: string,
  userId: string | null,
  shopId: string | null,
  entityId?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        details,
        userId,
        shopId,
        entityId
      }
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Fail silently to not block the main transaction? 
    // ZIMRA might prefer blocking, but for UX silent is better unless critical.
  }
}
