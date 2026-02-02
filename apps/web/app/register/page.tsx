'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect, Suspense } from 'react'
import { updateMember, getCharacters } from '@/lib/services/authService'
import type { CharacterInfo } from '@/lib/types/api'
import { getImageUrl } from '@/lib/config/api'
import styles from './Register.module.css'

function RegisterForm() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // URL 파라미터로 모드 확인 (정보 수정 모드인지 신규 가입 모드인지)
  const isEditMode = searchParams.get('mode') === 'edit'

  const [nickname, setNickname] = useState('')
  const [profileImage, setProfileImage] = useState<string>(
    '/image/icon/icon_account.svg'
  )
  const [agreed, setAgreed] = useState(isEditMode) // 정보 수정 모드면 이미 동의한 것으로 간주
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCharacterModal, setShowCharacterModal] = useState(false)
  const [characters, setCharacters] = useState<CharacterInfo[]>([])
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false)

  // 세션에서 프로필 정보 가져오기
  useEffect(() => {
    if (session?.user) {
      // @ts-expect-error: 타입 에러 무시
      const sessionNickname = session.user.nickname
      if (sessionNickname) {
        setNickname(sessionNickname)
      } else if (session.user.name) {
        setNickname(session.user.name)
      }

      if (session.user.image) {
        setProfileImage(session.user.image)
      }
    }
  }, [session, isEditMode])

  // 캐릭터 목록 가져오기
  useEffect(() => {
    const loadCharacters = async () => {
      if (!session) return
      setIsLoadingCharacters(true)
      try {
        const result = await getCharacters()
        if (result.success && result.data) {
          setCharacters(result.data.characters || [])
        }
      } catch (error) {
        console.error('캐릭터 목록 로드 오류:', error)
      } finally {
        setIsLoadingCharacters(false)
      }
    }
    loadCharacters()
  }, [session])

  // 신규 가입이 아닌데 register 페이지에 접근한 경우 메인으로 리다이렉트
  useEffect(() => {
    if (!isEditMode && session?.user) {
      // @ts-expect-error: isNewUser 타입 무시
      if (!session.user.isNewUser) {
        // 이미 가입 완료한 회원은 메인으로 리다이렉트
        router.replace('/')
      }
    }
  }, [session, isEditMode, router])

  // 프로필 이미지 클릭 핸들러
  const handleProfileImageClick = () => {
    // 캐릭터 선택 모달 표시
    if (characters.length > 0) {
      setShowCharacterModal(true)
    } else {
      // 캐릭터가 없으면 파일 업로드
      fileInputRef.current?.click()
    }
  }

  // 캐릭터 선택 핸들러
  const handleCharacterSelect = (character: CharacterInfo) => {
    setProfileImage(character.image)
    setShowCharacterModal(false)
  }

  // 파일 변경 핸들러 (이미지 미리보기)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB 이하여야 합니다.')
        return
      }
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        if (reader.result) {
          setProfileImage(reader.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!session?.user?.email) {
      alert('로그인이 필요합니다.')
      router.push('/login')
      return
    }

    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요.')
      return
    }

    // 약관 동의 체크 (정보수정 모드에서는 이미 동의한 것으로 간주)
    if (!agreed) {
      alert('필수 약관에 동의해주세요.')
      return
    }

    setIsSubmitting(true)

    try {
      // 정보수정 모드에서는 닉네임을 변경하지 않음 (세션의 기존 닉네임 사용)
      let finalNickname = nickname.trim()
      if (isEditMode) {
        // @ts-expect-error: 타입 에러 무시
        const sessionNickname = session?.user?.nickname
        if (sessionNickname) {
          finalNickname = sessionNickname
        }
      }

      const result = await updateMember({
        email: session.user.email,
        nickname: finalNickname,
        profile_image: profileImage, // data URL 또는 URL 모두 전송
      })

      if (result.success) {
        // 세션 갱신하여 isNewUser 상태 업데이트
        await updateSession()

        if (isEditMode) {
          alert('정보가 수정되었습니다.')
          router.replace('/setting')
        } else {
          alert(`'${nickname}'님 환영합니다! 회원가입이 완료되었습니다.`)
          router.replace('/')
        }
      } else {
        alert(result.detail || '처리 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('처리 오류:', error)
      alert('처리 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <h1 className={styles.title}>
          {isEditMode ? '정보 수정' : '회원가입'}
        </h1>
        <p className={styles.description}>
          {isEditMode ? (
            '프로필 정보를 수정할 수 있습니다.'
          ) : (
            <>
              주리니 서비스 이용을 위해
              <br />
              프로필을 설정해주세요.
            </>
          )}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* 1. 프로필 사진 변경 */}
          <div className={styles.profileSection}>
            <div
              className={styles.profileImageWrapper}
              onClick={handleProfileImageClick}
            >
              <img
                src={getImageUrl(profileImage)}
                alt="프로필"
                className={styles.profileImage}
              />
              <div className={styles.cameraIconWrapper}>
                <span>📷</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <p className={styles.profileHint}>
              {isEditMode
                ? '프로필 사진을 눌러 변경하세요 (캐릭터 선택 또는 파일 업로드)'
                : '프로필 사진을 눌러 변경하세요'}
            </p>
          </div>

          {/* 캐릭터 선택 모달 */}
          {showCharacterModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
              onClick={() => setShowCharacterModal(false)}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '24px',
                  maxWidth: '90%',
                  width: '400px',
                  maxHeight: '80vh',
                  overflow: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                  }}
                >
                  <h2
                    style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}
                  >
                    캐릭터 선택
                  </h2>
                  <button
                    onClick={() => setShowCharacterModal(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      padding: 0,
                      width: '30px',
                      height: '30px',
                    }}
                  >
                    ×
                  </button>
                </div>
                {isLoadingCharacters ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    로딩 중...
                  </div>
                ) : characters.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: '#666',
                    }}
                  >
                    사용 가능한 캐릭터가 없습니다.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(80px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {characters.map((character, index) => (
                      <div
                        key={index}
                        onClick={() => handleCharacterSelect(character)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          cursor: 'pointer',
                          padding: '12px',
                          borderRadius: '8px',
                          border:
                            profileImage === character.image
                              ? '2px solid #0070f3'
                              : '2px solid transparent',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (profileImage !== character.image) {
                            e.currentTarget.style.background = '#f5f5f5'
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <img
                          src={getImageUrl(character.image)}
                          alt={character.name}
                          style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            marginBottom: '8px',
                          }}
                        />
                        <span style={{ fontSize: '12px', textAlign: 'center' }}>
                          {character.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <button
                    onClick={() => {
                      setShowCharacterModal(false)
                      fileInputRef.current?.click()
                    }}
                    style={{
                      padding: '10px 20px',
                      background: '#f5f5f5',
                      color: '#333',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    직접 업로드
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. 닉네임 (정보수정 모드에서는 읽기 전용) */}
          <div className={styles.inputGroup}>
            <label htmlFor="nickname" className={styles.label}>
              닉네임
            </label>
            {isEditMode ? (
              <input
                id="nickname"
                type="text"
                value={nickname}
                readOnly
                disabled
                className={styles.input}
                style={{
                  backgroundColor: '#f5f5f5',
                  cursor: 'not-allowed',
                  color: '#666',
                }}
              />
            ) : (
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="사용하실 닉네임을 입력하세요"
                className={styles.input}
                maxLength={10}
              />
            )}
            {isEditMode && (
              <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                닉네임은 변경할 수 없습니다.
              </p>
            )}
          </div>

          {/* 3. 약관 동의 */}
          <div className={styles.termsGroup}>
            <label
              className={styles.checkboxLabel}
              style={{ cursor: isEditMode ? 'default' : 'pointer' }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => !isEditMode && setAgreed(e.target.checked)}
                disabled={isEditMode}
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>
                [필수] 서비스 이용약관 및 개인정보 처리방침에 동의합니다.
                {isEditMode && (
                  <span
                    style={{
                      color: '#999',
                      fontSize: '12px',
                      marginLeft: '8px',
                    }}
                  >
                    (이미 동의함)
                  </span>
                )}
              </span>
            </label>
            <div className={styles.termsBox}>
              제1조 (목적) 본 약관은 주리니 서비스의 이용조건 및 절차...
              <br />
              제2조 (개인정보) 회사는 회원의 개인정보를 중요시하며...
              <br />
              (본 내용은 예시이며 실제 약관 내용이 들어갑니다.)
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? '처리 중...'
              : isEditMode
              ? '수정 완료'
              : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  )
}

// Loading fallback 컴포넌트
function RegisterLoading() {
  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <h1 className={styles.title}>회원가입</h1>
        <p className={styles.description}>로딩 중...</p>
      </div>
    </div>
  )
}

// 메인 페이지 컴포넌트 (Suspense로 감싸기)
export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterLoading />}>
      <RegisterForm />
    </Suspense>
  )
}
