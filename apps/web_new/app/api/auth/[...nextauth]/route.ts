import NextAuth, { type AuthOptions } from 'next-auth'

export const dynamic = 'force-dynamic'

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
  providers: [],
  pages: {
    signIn: '/login',
  },
} as AuthOptions)

export const GET = handler
export const POST = handler
