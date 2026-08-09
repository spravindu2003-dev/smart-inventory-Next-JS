import { SignJWT, jwtVerify } from 'jose';

const SECRET_RAW = process.env.NEXTAUTH_SECRET;
const SECRET = SECRET_RAW ? new TextEncoder().encode(SECRET_RAW) : null;
const ALGORITHM = 'HS256';
const EXPIRY = '7d';

export interface TabSessionPayload {
  id: string;
  name: string;
  email: string;
  role: string;
  businessId: number;
  currency: string;
}

export async function createTabSession(payload: TabSessionPayload): Promise<string> {
  if (!SECRET) throw new Error('NEXTAUTH_SECRET is not set');
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

export async function verifyTabSession(token: string): Promise<TabSessionPayload | null> {
  try {
    let payload: Record<string, unknown>;

    if (SECRET) {
      const verified = await jwtVerify(token, SECRET, { algorithms: [ALGORITHM] });
      payload = verified.payload;
    } else {
      payload = decodeJwtPayload(token) ?? {};
    }

    const { id, name, email, role, businessId, currency } = payload as unknown as TabSessionPayload;
    if (!id || !email || !role) return null;
    return { id, name, email, role, businessId: businessId ?? 0, currency: currency ?? 'LKR' };
  } catch {
    return null;
  }
}

const STORAGE_KEY = 'auth-tab-session';

export function storeTabSession(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function getStoredTabSession(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearTabSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}
