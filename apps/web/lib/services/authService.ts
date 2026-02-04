/**
 * 인증 및 회원 관리 서비스
 * Next.js API route를 통해 admin 서버로 프록시 (CORS 문제 방지)
 */

import type { ApiResponse, CharacterInfo } from '@/lib/types/api'

/**
 * 관심종목 응답 타입
 */
export interface FavoriteStockResponse {
  success: boolean
  message?: string
  detail?: string
  favorite_stocks: string[]
}

/**
 * 회원 정보 업데이트 요청 타입
 */
export interface UpdateMemberRequest {
  email: string
  nickname: string
  profile_image: string
}

/**
 * 회원 정보 업데이트 응답 타입
 */
export interface UpdateMemberResponse {
  success: boolean
  message: string
  member_id?: number
  has_nickname?: boolean
  nickname?: string
  profile_image?: string
}

/**
 * 캐릭터 목록 응답 타입
 */
export interface CharactersResponse {
  success: boolean
  message: string
  characters: CharacterInfo[]
}

/**
 * 관심종목 조회
 * @param email - 회원 이메일
 * @returns 관심종목 목록
 */
export async function getFavoriteStocks(
  email: string
): Promise<ApiResponse<FavoriteStockResponse>> {
  try {
    const response = await fetch(
      `/api/auth/member/favorites?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Get favorite stocks API error (${response.status}):`, errorText)
      return {
        success: false,
        message: '관심종목을 불러올 수 없습니다.',
        error: errorText,
      }
    }

    const data: FavoriteStockResponse = await response.json()
    return {
      success: data.success,
      message: data.message,
      data: data,
    }
  } catch (error) {
    console.error('관심종목 조회 오류:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '관심종목 조회 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 관심종목 추가
 * @param params - 이메일과 종목 코드
 * @returns 업데이트된 관심종목 목록
 */
export async function addFavoriteStock(params: {
  email: string
  stock_code: string
}): Promise<ApiResponse<FavoriteStockResponse>> {
  try {
    const response = await fetch('/api/auth/member/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        stock_code: params.stock_code,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Add favorite stock API error (${response.status}):`, errorText)

      // 400 에러인 경우 detail 메시지 파싱 시도
      let errorMessage = '관심종목을 추가할 수 없습니다.'
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.detail) {
          errorMessage = errorJson.detail
        }
      } catch {
        // JSON 파싱 실패 시 기본 메시지 사용
      }

      return {
        success: false,
        message: errorMessage,
        error: errorText,
      }
    }

    const data: FavoriteStockResponse = await response.json()
    return {
      success: data.success,
      message: data.message,
      data: data,
    }
  } catch (error) {
    console.error('관심종목 추가 오류:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '관심종목 추가 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 관심종목 삭제
 * @param params - 이메일과 종목 코드
 * @returns 업데이트된 관심종목 목록
 */
export async function removeFavoriteStock(params: {
  email: string
  stock_code: string
}): Promise<ApiResponse<FavoriteStockResponse>> {
  try {
    const response = await fetch('/api/auth/member/favorites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        stock_code: params.stock_code,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Remove favorite stock API error (${response.status}):`, errorText)
      return {
        success: false,
        message: '관심종목을 삭제할 수 없습니다.',
        error: errorText,
      }
    }

    const data: FavoriteStockResponse = await response.json()
    return {
      success: data.success,
      message: data.message,
      data: data,
    }
  } catch (error) {
    console.error('관심종목 삭제 오류:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '관심종목 삭제 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 회원 정보 업데이트
 * @param params - 업데이트할 회원 정보
 * @returns 업데이트 결과
 */
export async function updateMember(
  params: UpdateMemberRequest
): Promise<ApiResponse<UpdateMemberResponse>> {
  try {
    const response = await fetch('/api/auth/member/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Update member API error (${response.status}):`, errorText)
      return {
        success: false,
        message: '회원 정보를 업데이트할 수 없습니다.',
        error: errorText,
      }
    }

    const data: UpdateMemberResponse = await response.json()
    return {
      success: data.success,
      message: data.message,
      data: data,
    }
  } catch (error) {
    console.error('회원 정보 업데이트 오류:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '회원 정보 업데이트 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 캐릭터 목록 조회
 * @returns 캐릭터 목록
 */
export async function getCharacters(): Promise<ApiResponse<CharactersResponse>> {
  try {
    const response = await fetch('/api/auth/characters', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Get characters API error (${response.status}):`, errorText)
      return {
        success: false,
        message: '캐릭터 목록을 불러올 수 없습니다.',
        error: errorText,
      }
    }

    const data: CharactersResponse = await response.json()
    return {
      success: data.success,
      message: data.message,
      data: data,
    }
  } catch (error) {
    console.error('캐릭터 목록 조회 오류:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '캐릭터 목록 조회 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 회원 탈퇴
 * @param email - 회원 이메일
 * @returns 탈퇴 결과
 */
export async function withdrawMember(
  email: string
): Promise<ApiResponse<{ success: boolean; message: string }>> {
  try {
    const response = await fetch(
      `/api/auth/member/withdraw?email=${encodeURIComponent(email)}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Withdraw member API error (${response.status}):`, errorText)
      return {
        success: false,
        message: '회원 탈퇴를 처리할 수 없습니다.',
        error: errorText,
      }
    }

    const data = await response.json()
    return {
      success: data.success || true,
      message: data.message || '회원 탈퇴가 완료되었습니다.',
      data: data,
    }
  } catch (error) {
    console.error('회원 탈퇴 오류:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '회원 탈퇴 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
