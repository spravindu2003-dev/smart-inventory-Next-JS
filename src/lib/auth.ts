import NextAuth, { getServerSession } from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validations';
import { DEFAULT_CURRENCY } from '@/lib/currencies';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const validatedFields = loginSchema.safeParse(credentials);

        if (!validatedFields.success) {
          return null;
        }

        const { email, password } = validatedFields.data;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { business: { select: { currency: true } } },
        });

        if (!user || !user.isActive || user.isDeleted) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          businessId: user.businessId,
          currency: user.business?.currency || DEFAULT_CURRENCY,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId ?? null;
        token.currency = user.currency ?? DEFAULT_CURRENCY;
      }

      if (token.businessId && !token.currency) {
        try {
          const business = await prisma.business.findUnique({
            where: { id: token.businessId as number },
            select: { currency: true },
          });
          token.currency = business?.currency || DEFAULT_CURRENCY;
        } catch {
          token.currency = DEFAULT_CURRENCY;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.businessId = token.businessId as number;
        session.user.currency = (token.currency as string) || DEFAULT_CURRENCY;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
export const auth = () => getServerSession(authOptions);
export const signIn = handler.signIn;
export const signOut = handler.signOut;

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      businessId: number;
      currency: string;
    };
  }

  interface User {
    role: string;
    businessId: number | null;
    currency?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    businessId: number | null;
    currency?: string;
  }
}
