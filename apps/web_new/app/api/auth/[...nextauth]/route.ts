import NextAuth, { type AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
// import KakaoProvider from 'next-auth/providers/kakao' // 카카오 가입 비활성화
import NaverProvider from 'next-auth/providers/naver'
import GoogleProvider from 'next-auth/providers/google'

/** JWT payload에서 만료 시간 추출 (라이브러리 없이 base64 디코딩) */
function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

export const dynamic = 'force-dynamic'

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ''
const API_SECRET_KEY = process.env.NEXT_PUBLIC_X_API_KEY || ''

// 프로덕션에서는 NEXTAUTH_SECRET 필수. 개발 환경에서만 미설정 시 기본값 허용
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.VERCEL
const secret = process.env.NEXTAUTH_SECRET || (!isProduction ? 'dev-secret-change-in-production' : undefined)

export const authOptions = {
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
            grade: data.grade ?? 'regular',
            backendAccessToken: data.access_token ?? null,
          }
        } catch {
          return null
        }
      },
    }),
    // 카카오 가입 비활성화
    // KakaoProvider({
    //   clientId: process.env.KAKAO_CLIENT_ID ?? '',
    //   clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
    // }),
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
        token.grade = (user as { grade?: string }).grade ?? 'regular'
        token.backendAccessToken = (user as { backendAccessToken?: string }).backendAccessToken ?? null

        // 소셜 로그인 시 BO social-login API 연동 (kakao, naver, google)
        token.lastLoginProvider = account?.provider ?? 'credentials'

        if (account && ['naver', 'google'].includes(account.provider)) {
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
              token.grade = data.grade ?? 'regular'
              token.backendAccessToken = data.access_token ?? null
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

      // backendAccessToken 만료 시 자동 재발급 (만료 5분 전 또는 이미 만료된 경우)
      if (token.backendAccessToken && token.email) {
        try {
          const exp = getTokenExpiry(token.backendAccessToken as string)
          const nowSec = Date.now() / 1000
          if (!exp || exp < nowSec + 300) {
            const res = await fetch(`${API_BASE_URL}/api/auth/member/reissue-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': API_SECRET_KEY,
              },
              body: JSON.stringify({ email: token.email }),
            })
            if (res.ok) {
              const data = await res.json()
              if (data.access_token) {
                token.backendAccessToken = data.access_token
              }
            }
          }
        } catch { /* 갱신 실패 시 기존 토큰 유지 */ }
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
        ;(session.user as { grade?: string }).grade = (token.grade as string) ?? 'regular'
      }
      ;(session as { backendAccessToken?: string | null }).backendAccessToken = (token.backendAccessToken as string | null) ?? null
      return session
    },
  },
} as AuthOptions

const handler = NextAuth(authOptions)

export const GET = handler
export const POST = handler
