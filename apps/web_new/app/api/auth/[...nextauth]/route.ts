import NextAuth, { type AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
// import KakaoProvider from 'next-auth/providers/kakao' // 카카오 가입 비활성화
// import NaverProvider from 'next-auth/providers/naver' // 네이버 로그인 비활성화
// import GoogleProvider from 'next-auth/providers/google' // 구글 로그인 비활성화
import { API_BASE_URL, API_SECRET_KEY } from '@/lib/config/api'

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

// 프로덕션에서는 NEXTAUTH_SECRET 필수. 개발 환경에서만 미설정 시 기본값 허용
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.VERCEL
const secret = process.env.NEXTAUTH_SECRET || (!isProduction ? 'dev-secret-change-in-production' : undefined)

/** 백엔드(Admin/FastAPI) 절대 URL — 끝 슬래시 제거 */
function backendBaseUrl(): string {
  return API_BASE_URL.replace(/\/+$/, '')
}

if (isProduction && !API_BASE_URL.trim()) {
  console.error(
    '[NextAuth] 로그인 불가: API_BASE_URL / NEXT_PUBLIC_API_BASE_URL 미설정. 서버가 백엔드로 프록시하지 못합니다.'
  )
}
if (isProduction && !process.env.NEXTAUTH_SECRET) {
  console.error('[NextAuth] NEXTAUTH_SECRET 미설정 — 프로덕션에서 세션/로그인이 실패할 수 있습니다.')
}

// trustHost + 배포 환경의 AUTH_TRUST_HOST(비 Vercel)로 x-forwarded-* 기반 origin 사용 → OAuth state 쿠키와 일치
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

        const base = backendBaseUrl()
        if (!base) {
          console.error(
            '[NextAuth] credentials 로그인: 백엔드 URL 없음. Vercel/Railway 등에 NEXT_PUBLIC_API_BASE_URL 또는 API_BASE_URL 설정.'
          )
          return null
        }

        try {
          const res = await fetch(`${base}/api/auth/member/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          const text = await res.text()
          let data: Record<string, unknown> = {}
          try {
            data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
          } catch {
            console.error(
              '[NextAuth] /api/auth/member/login 응답이 JSON이 아님',
              res.status,
              text.slice(0, 400)
            )
            return null
          }

          if (!res.ok || !data.success) {
            return null
          }

          return {
            id: String(data.member_id),
            email: data.email as string,
            name: data.nickname as string,
            image: data.profile_image as string | undefined,
            grade: (data.grade as string | undefined) ?? 'regular',
            backendAccessToken: (data.access_token as string | null | undefined) ?? null,
          }
        } catch (e) {
          console.error('[NextAuth] credentials 로그인 fetch 오류:', e)
          return null
        }
      },
    }),
    // 카카오 가입 비활성화
    // KakaoProvider({
    //   clientId: process.env.KAKAO_CLIENT_ID ?? '',
    //   clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
    // }),
    // 네이버 로그인 비활성화
    // NaverProvider({
    //   clientId: process.env.NAVER_CLIENT_ID ?? '',
    //   clientSecret: process.env.NAVER_CLIENT_SECRET ?? '',
    // }),
    // 구글 로그인 비활성화
    // GoogleProvider({
    //   clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    // }),
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

        // 소셜 로그인 시 BO social-login API 연동 (google 비활성화; naver 비활성화)
        token.lastLoginProvider = account?.provider ?? 'credentials'

        // 구글 로그인 비활성화
        // if (account && account.provider === 'google') {
        //   const base = backendBaseUrl()
        //   if (!base) {
        //     console.error('[NextAuth] Google 콜백: 백엔드 URL 없음 — social-login 호출 생략')
        //     token.isNewUser = true
        //   } else {
        //     try {
        //       const providerId =
        //         account.providerAccountId ||
        //         user.id ||
        //         String(account.access_token ?? '').substring(0, 50) ||
        //         ''
        //       const email = user.email || ''
        //       const name = user.name || user.email?.split('@')[0] || ''
        //       const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        //       if (API_SECRET_KEY) { headers['X-API-KEY'] = API_SECRET_KEY }
        //       const response = await fetch(`${base}/api/auth/social-login`, {
        //         method: 'POST',
        //         headers,
        //         body: JSON.stringify({ provider: account.provider, email, name, provider_id: providerId }),
        //       })
        //       if (response.ok) {
        //         const data = await response.json()
        //         token.isNewUser = !data.has_nickname
        //         token.name = data.nickname || name
        //         token.picture = data.profile_image || user.image
        //         token.nickname = data.nickname || null
        //         token.profileImage = data.profile_image || null
        //         token.grade = data.grade ?? 'regular'
        //         token.backendAccessToken = data.access_token ?? null
        //       } else {
        //         token.isNewUser = true
        //       }
        //     } catch {
        //       token.isNewUser = true
        //     }
        //   }
        // }
      }
      if (trigger === 'update' && session?.user) {
        if (session.user.name !== undefined) token.name = session.user.name
        if (session.user.image !== undefined) token.picture = session.user.image
        if (session.user.email !== undefined) token.email = session.user.email
      }

      // backendAccessToken 만료 시 자동 재발급 (만료 5분 전 또는 이미 만료된 경우)
      if (token.backendAccessToken && token.email) {
        const reissueBase = backendBaseUrl()
        try {
          const exp = getTokenExpiry(token.backendAccessToken as string)
          const nowSec = Date.now() / 1000
          if (
            reissueBase &&
            (!exp || exp < nowSec + 300)
          ) {
            const res = await fetch(`${reissueBase}/api/auth/member/reissue-token`, {
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
