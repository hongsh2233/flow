import NextAuth, { type AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import NaverProvider from 'next-auth/providers/naver'

// Railway 배포 시 동적 렌더링 강제 (인증 API 캐싱 방지)
export const dynamic = 'force-dynamic'

// NEXTAUTH_SECRET 미설정 시 경고 로그
if (!process.env.NEXTAUTH_SECRET) {
  console.error(
    '[NextAuth] NEXTAUTH_SECRET 환경변수가 설정되지 않았습니다. ' +
      'Railway 대시보드 > Web 서비스 > Variables에서 NEXTAUTH_SECRET을 추가해주세요. ' +
      '터미널에서 `openssl rand -base64 32` 명령으로 생성할 수 있습니다.'
  )
}

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
  providers: [
    GoogleProvider({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_LOGIN_ID || '',
      clientSecret: process.env.NAVER_CLIENT_LOGIN_SECRET || '',
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // 1. JWT 콜백: 로그인 시 토큰에 정보 심기
    async jwt({ token, account, user, trigger }) {
      // account 객체는 초기 로그인 시에만 존재합니다.
      if (account && user) {
        token.accessToken = account.access_token
        token.email = user.email || null

        // 소셜 로그인 정보를 stock-bo 백엔드로 전송 (서버 사이드에서 직접 호출)
        if (account.provider === 'google' || account.provider === 'naver') {
          try {
            // provider_id는 account.providerAccountId 또는 user.id를 사용
            const providerId =
              account.providerAccountId ||
              user.id ||
              account.access_token?.substring(0, 50) ||
              ''
            const email = user.email || ''
            const name = user.name || user.email?.split('@')[0] || ''

            // 보안: 이메일, 이름, providerId는 콘솔에 출력하지 않음
            console.log(
              `[소셜 로그인] ${account.provider} 로그인 정보를 stock-bo로 전송 중...`
            )

            // 서버 사이드에서 직접 API 호출
            const apiBaseUrl =
              process.env.NEXT_PUBLIC_API_BASE_URL ||
              'https://stock-bo-production.up.railway.app'
            const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || ''

            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            }

            if (apiSecretKey) {
              headers['X-API-KEY'] = apiSecretKey
            }

            const response = await fetch(
              `${apiBaseUrl}/api/auth/social-login`,
              {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  provider: account.provider,
                  email,
                  name,
                  provider_id: providerId,
                }),
              }
            )

            if (response.ok) {
              const data = await response.json()
              console.log(`[소셜 로그인] stock-bo 회원 정보 저장 성공`)
              // 닉네임이 설정되어 있지 않으면 신규 회원으로 표시 (추가 정보 입력 필요)
              token.isNewUser = !data.has_nickname
              // 회원 정보 저장
              token.nickname = data.nickname || null
              token.profileImage = data.profile_image || null
            } else {
              const errorData = await response
                .json()
                .catch(() => ({ detail: 'Unknown error' }))
              console.error(
                `[소셜 로그인] stock-bo 저장 실패:`,
                errorData.detail || errorData.message
              )
              // 저장 실패 시에도 신규 회원으로 처리
              token.isNewUser = true
            }
          } catch (error) {
            console.error(`[소셜 로그인] stock-bo 전송 중 오류:`, error)
            // 오류 발생 시에도 신규 회원으로 처리
            token.isNewUser = true
          }
        }
      } else if (trigger === 'update') {
        // 세션 갱신 시 회원 정보 확인 (회원 정보 업데이트 후)
        // user 객체는 updateSession()에 전달된 값들로 채워짐
        const email = (user as any)?.email || token.email

        if (email) {
          try {
            const apiBaseUrl =
              process.env.NEXT_PUBLIC_API_BASE_URL ||
              'https://stock-bo-production.up.railway.app'
            const apiSecretKey = process.env.NEXT_PUBLIC_X_API_KEY || ''

            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            }

            if (apiSecretKey) {
              headers['X-API-KEY'] = apiSecretKey
            }

            // 회원 정보 조회 (이메일로 확인)
            // 보안: 이메일은 콘솔에 출력하지 않음
            console.log(`[세션 갱신] 회원 정보 확인 중...`)
            const response = await fetch(
              `${apiBaseUrl}/api/auth/member/info?email=${encodeURIComponent(
                email
              )}`,
              {
                method: 'GET',
                headers,
              }
            )

            if (response.ok) {
              const memberData = await response.json()
              // 보안: 회원 정보 전체는 콘솔에 출력하지 않음
              console.log(`[세션 갱신] 회원 정보 조회 성공`)

              // 토큰에 업데이트된 회원 정보 저장
              token.isNewUser = false
              token.nickname = memberData.nickname || null
              token.profileImage = memberData.profile_image || null
              token.email = email
            } else {
              console.error(`[세션 갱신] 회원 정보 조회 실패:`, response.status)
            }
          } catch (error) {
            console.error(`[세션 갱신] 회원 정보 확인 중 오류:`, error)
          }
        } else {
          // 보안: user, token 객체는 콘솔에 출력하지 않음
          console.warn(`[세션 갱신] 이메일 정보가 없습니다.`)
        }
      }
      return token
    },

    // 2. Session 콜백: 클라이언트에서 세션 조회 시 정보 전달
    async session({ session, token }) {
      if (session.user) {
        // @ts-expect-error: 타입 에러 무시 (테스트용)
        session.user.isNewUser = token.isNewUser
        // @ts-expect-error: 타입 에러 무시 (테스트용)
        session.accessToken = token.accessToken
        // @ts-expect-error: 타입 에러 무시 (테스트용)
        session.user.nickname = token.nickname || null

        // ▼ [수정] 아래 줄의 @ts-expect-error 지시어를 삭제했습니다.
        // 프로필 이미지는 nickname이 있으면 nickname의 profile_image, 없으면 token의 profileImage 사용
        if (token.profileImage) {
          session.user.image = token.profileImage as string
        }
      }
      return session
    },
  },
} as AuthOptions)

export { handler as GET, handler as POST }
