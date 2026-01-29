import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const secretKey = process.env.JWT_SECRET;

if (!secretKey) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is missing! Production deployment halted for security.');
  } else {
    console.warn('⚠️ WARNING: JWT_SECRET is not set. Using insecure default for development only.');
  }
}

const key = new TextEncoder().encode(secretKey || "default-dev-secret-key-change-me");

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  });
  return payload;
}

export async function getSession() {
  const session = cookies().get("session")?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function login(userData: any) {
  // Fetch managed shops if the user is an ADMIN
  // Note: We need to import prisma here or assume userData already has it. 
  // Ideally, userData passed here should be lightweight. 
  // But to be safe, let's keep the session payload clean.
  // We will trust the passed userData has the necessary info or we re-fetch it here.
  
  // Since we can't easily import prisma in this edge-compatible file without issues in some Next.js setups,
  // we will assume the caller of login() (usually the API route) provides the full user object including managedShops.
  
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
  const session = await encrypt({ user: userData, expires });

  cookies().set("session", session, { expires, httpOnly: true });
}

export async function logout() {
  // Destroy the session
  cookies().set("session", "", { expires: new Date(0) });
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  if (!session) return;

  // Refresh the session so it doesn't expire
  const parsed = await decrypt(session);
  parsed.expires = new Date(Date.now() + 60 * 60 * 1000);
  const res = NextResponse.next();
  res.cookies.set({
    name: "session",
    value: await encrypt(parsed),
    httpOnly: true,
    expires: parsed.expires,
  });
  return res;
}
