import NextAuth, { type AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import KakaoProvider from 'next-auth/providers/kakao'
import NaverProvider from 'next-auth/providers/naver'
import GoogleProvider from 'next-auth/providers/google'

export const dynamic = 'force-dynamic'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
const API_SECRET_KEY = process.env.NEXT_PUBLIC_X_API_KEY || ''

// 개발 환경에서 NEXTAUTH_SECRET 미설정 시 기본값 사용 (배포 시 반드시 .env에 설정)
const secret = process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-secret-change-in-production' : undefined)

const handler = NextAuth({
  secret,
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: '이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/member/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          const data = await res.json()

          if (!res.ok || !data.success) {
            return null
          }

          return {
            id: String(data.member_id),
            email: data.email,
            name: data.nickname,
            image: data.profile_image,
          }
        } catch {
          return null
        }
      },
    }),
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID ?? '',
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
    }),
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID ?? '',
      clientSecret: process.env.NAVER_CLIENT_SECRET ?? '',
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image

        // 소셜 로그인 시 BO social-login API 연동 (kakao, naver, google)
        token.lastLoginProvider = account?.provider ?? 'credentials'

        if (account && ['kakao', 'naver', 'google'].includes(account.provider)) {
          try {
            const providerId =
              account.providerAccountId ||
              user.id ||
              String(account.access_token ?? '').substring(0, 50) ||
              ''
            const email = user.email || ''
            const name = user.name || user.email?.split('@')[0] || ''

            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            }
            if (API_SECRET_KEY) {
              headers['X-API-KEY'] = API_SECRET_KEY
            }

            const response = await fetch(`${API_BASE_URL}/api/auth/social-login`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                provider: account.provider,
                email,
                name,
                provider_id: providerId,
              }),
            })

            if (response.ok) {
              const data = await response.json()
              token.isNewUser = !data.has_nickname
              token.name = data.nickname || name
              token.picture = data.profile_image || user.image
              token.nickname = data.nickname || null
              token.profileImage = data.profile_image || null
            } else {
              token.isNewUser = true
            }
          } catch {
            token.isNewUser = true
          }
        }
      }
      if (trigger === 'update' && session?.user) {
        if (session.user.name !== undefined) token.name = session.user.name
        if (session.user.image !== undefined) token.picture = session.user.image
        if (session.user.email !== undefined) token.email = session.user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string
        session.user.name = (token.nickname ?? token.name) as string
        session.user.image = (token.profileImage ?? token.picture) as string
        if (typeof token.isNewUser === 'boolean') {
          ;(session.user as { isNewUser?: boolean }).isNewUser = token.isNewUser
        }
        if (token.lastLoginProvider) {
          ;(session as { lastLoginProvider?: string }).lastLoginProvider = token.lastLoginProvider as string
        }
      }
      return session
    },
  },
} as AuthOptions)

export const GET = handler
export const POST = handler
