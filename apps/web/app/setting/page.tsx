'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  updateMember,
  getCharacters,
  withdrawMember,
} from '@/lib/services/authService'
import type { CharacterInfo } from '@/lib/types/api'
import { getImageUrl } from '@/lib/config/api'
import styles from './Setting.module.css'

// 로컬스토리지 키 상수
const STORAGE_KEYS = {
  DARK_MODE: 'darkMode',
  LOCAL_STORAGE_PERMISSION: 'localStoragePermission',
  NOTIFICATION_PERMISSION: 'notificationPermission',
}

export default function SettingPage() {
  const router = useRouter()
  const { data: session, status, update: updateSession } = useSession()
  const [darkMode, setDarkMode] = useState(false)
  const [localStoragePermission, setLocalStoragePermission] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState(false)
  const [nickname, setNickname] = useState('사용자')
  const [profileImage, setProfileImage] = useState<string>(
    '/image/icon/icon_account.svg'
  )
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [showCharacterModal, setShowCharacterModal] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [characters, setCharacters] = useState<CharacterInfo[]>([])
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false)

  // [추가] 권한 상태 텍스트를 저장할 state (SSR 오류 방지용)
  const [permissionStatusText, setPermissionStatusText] = useState('')

  const appVersion = '1.0.0'
  const appDescription = '주식 초보를 위한 필수 앱'

  // 초기 상태 로드 (로컬스토리지에서)
  useEffect(() => {
    // 로컬스토리지 권한 설정 로드
    const savedLocalStoragePermission =
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_PERMISSION) === 'true'
    setLocalStoragePermission(savedLocalStoragePermission)

    // 다크모드 설정 로드 (로컬스토리지 우선, 없으면 세션 스토리지)
    let savedDarkMode = false
    if (savedLocalStoragePermission) {
      savedDarkMode = localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true'
    } else {
      savedDarkMode = sessionStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true'
    }
    setDarkMode(savedDarkMode)
    applyDarkMode(savedDarkMode)

    // 알림 권한 상태 확인
    if ('Notification' in window) {
      const permission = Notification.permission
      const savedNotificationPermission = savedLocalStoragePermission
        ? localStorage.getItem(STORAGE_KEYS.NOTIFICATION_PERMISSION) === 'true'
        : false
      setNotificationPermission(
        permission === 'granted' && savedNotificationPermission
      )
    }
  }, [])

  // [추가] 권한 상태 텍스트 업데이트 (useEffect 사용)
  // window 객체 접근을 클라이언트 사이드에서만 수행하도록 보장
  useEffect(() => {
    const localStorageStatus = localStoragePermission ? '허용' : '거부'
    let notificationStatus = '미지원'

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        notificationStatus = notificationPermission ? '허용' : '거부'
      } else if (Notification.permission === 'denied') {
        notificationStatus = '거부'
      } else {
        notificationStatus = '요청 필요'
      }
    }

    setPermissionStatusText(
      `로컬스토리지: ${localStorageStatus} / 알림: ${notificationStatus}`
    )
  }, [localStoragePermission, notificationPermission])

  // 다크모드 적용 함수
  const applyDarkMode = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

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
  }, [session])

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

  const handleProfileImageClick = () => {
    // 직접 업로드는 허용하지 않음: 캐릭터 선택만 허용
    setShowCharacterModal(true)
  }

  const handleCharacterSelect = async (character: CharacterInfo) => {
    if (!session?.user?.email) {
      alert('로그인이 필요합니다.')
      return
    }

    setShowCharacterModal(false)
    setIsSavingProfile(true)

    try {
      const result = await updateMember({
        email: session.user.email,
        nickname: nickname,
        profile_image: character.image,
      })

      if (result.success) {
        setProfileImage(character.image)
        // 세션 업데이트 - 이메일을 전달하여 JWT 콜백에서 회원 정보 조회
        await updateSession({
          email: session.user.email,
          image: character.image,
        })
      } else {
        alert(result.message ?? result.error ?? '프로필 이미지 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('프로필 이미지 변경 오류:', error)
      alert('프로필 이미지 변경 중 오류가 발생했습니다.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  // 직접 업로드는 허용하지 않음: 파일 업로드 핸들러 제거

  const handleDarkMode = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    applyDarkMode(newDarkMode)

    // 로컬스토리지에 저장 (권한이 있는 경우)
    if (localStoragePermission) {
      localStorage.setItem(STORAGE_KEYS.DARK_MODE, String(newDarkMode))
    } else {
      // 권한이 없으면 세션 스토리지에 임시 저장
      sessionStorage.setItem(STORAGE_KEYS.DARK_MODE, String(newDarkMode))
    }
  }

  const handleEditInfo = () => {
    router.push('/register?mode=edit')
  }

  const handleReset = () => {
    if (
      confirm(
        '모든 설정을 초기화하시겠습니까?\n- 로컬스토리지 데이터가 삭제됩니다\n- 세션 스토리지 데이터가 삭제됩니다\n- 알림 설정이 초기화됩니다'
      )
    ) {
      try {
        // 로컬스토리지 전체 클리어
        localStorage.clear()
        // 세션 스토리지 전체 클리어
        sessionStorage.clear()

        // 상태 초기화
        setDarkMode(false)
        setLocalStoragePermission(false)
        setNotificationPermission(false)

        // 다크모드 해제
        applyDarkMode(false)

        // 알림 권한이 granted 상태라면, 사용자에게 알림 (실제 권한은 브라우저 설정에서만 변경 가능)
        if ('Notification' in window && Notification.permission === 'granted') {
          alert('알림 권한은 브라우저 설정에서 직접 변경해야 합니다.')
        }

        alert('설정이 초기화되었습니다.')
      } catch (error) {
        console.error('초기화 중 오류:', error)
        alert('초기화 중 오류가 발생했습니다.')
      }
    }
  }

  // [수정] 실제 로그아웃 로직 구현
  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      // signOut을 호출하면 세션 쿠키가 삭제되고, 지정된 url로 리다이렉트됩니다.
      await signOut({ callbackUrl: '/login' })
    }
  }

  const handleWithdraw = async () => {
    if (!session?.user?.email) {
      alert('로그인이 필요합니다.')
      return
    }

    const confirmed = confirm(
      '정말 회원탈퇴를 하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 데이터가 삭제됩니다.'
    )

    if (!confirmed) {
      return
    }

    try {
      const result = await withdrawMember(session.user.email)

      if (result.success) {
        alert('회원 탈퇴가 완료되었습니다.')
        // 로그아웃 처리
        await signOut({ callbackUrl: '/' })
        // 메인 페이지로 이동
        router.push('/')
      } else {
        alert(result.message ?? result.error ?? '회원 탈퇴에 실패했습니다.')
      }
    } catch (error) {
      console.error('회원 탈퇴 오류:', error)
      alert('회원 탈퇴 중 오류가 발생했습니다.')
    }
  }

  const handlePermission = () => {
    // 권한 설정 모달 표시
    setShowPermissionModal(true)
  }

  const handleLocalStoragePermission = () => {
    const confirmMessage =
      '로컬스토리지 사용을 허용하시겠습니까?\n(설정값이 브라우저에 저장됩니다)'
    if (confirm(confirmMessage)) {
      try {
        // 테스트 저장/삭제로 권한 확인
        const testKey = '__permission_test__'
        localStorage.setItem(testKey, 'test')
        localStorage.removeItem(testKey)

        setLocalStoragePermission(true)
        localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_PERMISSION, 'true')
        alert('로컬스토리지 권한이 허용되었습니다.')
      } catch (error) {
        console.error('로컬스토리지 권한 오류:', error)
        alert(
          '로컬스토리지 사용 권한을 얻을 수 없습니다. 브라우저 설정을 확인해주세요.'
        )
      }
    } else {
      setLocalStoragePermission(false)
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_PERMISSION, 'false')
    }
  }

  const handleNotificationPermission = () => {
    // 알림 권한 설정
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            setNotificationPermission(true)
            if (localStoragePermission) {
              localStorage.setItem(STORAGE_KEYS.NOTIFICATION_PERMISSION, 'true')
            }
            alert('알림 권한이 허용되었습니다.')
          } else if (permission === 'denied') {
            setNotificationPermission(false)
            if (localStoragePermission) {
              localStorage.setItem(
                STORAGE_KEYS.NOTIFICATION_PERMISSION,
                'false'
              )
            }
            alert(
              '알림 권한이 거부되었습니다. 브라우저 설정에서 변경할 수 있습니다.'
            )
          } else {
            setNotificationPermission(false)
            if (localStoragePermission) {
              localStorage.setItem(
                STORAGE_KEYS.NOTIFICATION_PERMISSION,
                'false'
              )
            }
          }
        })
      } else if (Notification.permission === 'granted') {
        setNotificationPermission(true)
        if (localStoragePermission) {
          localStorage.setItem(STORAGE_KEYS.NOTIFICATION_PERMISSION, 'true')
        }
        alert('알림 권한이 이미 허용되어 있습니다.')
      } else {
        setNotificationPermission(false)
        if (localStoragePermission) {
          localStorage.setItem(STORAGE_KEYS.NOTIFICATION_PERMISSION, 'false')
        }
        alert('알림 권한이 거부되어 있습니다. 브라우저 설정에서 변경해주세요.')
      }
    } else {
      alert('이 브라우저는 알림 기능을 지원하지 않습니다.')
    }
  }

  // 기본 설정 항목 (모든 사용자)
  const baseSettingItems = [
    {
      id: 'darkMode',
      label: '다크 모드',
      type: 'toggle',
      action: handleDarkMode,
      value: darkMode,
    },
    {
      id: 'permission',
      label: '권한 설정',
      type: 'button',
      action: handlePermission,
      // [수정] 함수 호출 대신 state 변수 사용
      subtitle: permissionStatusText,
    },
    {
      id: 'reset',
      label: '초기화',
      type: 'button',
      action: handleReset,
    },
  ]

  // 로그인한 사용자만 볼 수 있는 설정 항목
  const authenticatedSettingItems = [
    {
      id: 'editInfo',
      label: '정보수정',
      type: 'button',
      action: handleEditInfo,
    },
    {
      id: 'logout',
      label: '로그아웃',
      type: 'button',
      action: handleLogout,
    },
    {
      id: 'withdraw',
      label: '회원탈퇴',
      type: 'button',
      action: handleWithdraw,
      danger: true,
    },
  ]

  // 로그인 상태에 따라 설정 항목 구성
  const settingItems = session
    ? [...baseSettingItems, ...authenticatedSettingItems]
    : baseSettingItems

  // 로딩 중일 때
  if (status === 'loading') {
    return (
      <div className="inner-wrap">
        <div className={styles.setting__wrap}>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            로그인 정보 확인 중...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="inner-wrap">
      <div className={styles.setting__wrap}>
        {/* 프로필 섹션 - 로그인한 사용자만 표시 */}
        {session && (
          <div className={styles.profile__section}>
            <div
              className={styles.profile__image}
              onClick={handleProfileImageClick}
              style={{
                position: 'relative',
                opacity: isSavingProfile ? 0.6 : 1,
                pointerEvents: isSavingProfile ? 'none' : 'auto',
              }}
            >
              <img src={getImageUrl(profileImage)} alt="프로필" />
              {isSavingProfile && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    zIndex: 10,
                  }}
                >
                  저장 중...
                </div>
              )}
              <div className={styles.profile__overlay}>
                <span className={styles.profile__editIcon}>📷</span>
                <span className={styles.profile__editText}>변경</span>
              </div>
            </div>
            {/* 직접 업로드는 허용하지 않음 */}
            <div className={styles.profile__name}>{nickname}</div>
          </div>
        )}

        {/* 권한 설정 모달 */}
        {showPermissionModal && (
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
            onClick={() => setShowPermissionModal(false)}
          >
            <div
              style={{
                background: 'var(--bg-primary)',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '90%',
                width: '400px',
                maxHeight: '80vh',
                overflow: 'auto',
                color: 'var(--text-primary)',
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
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  권한 설정
                </h2>
                <button
                  onClick={() => setShowPermissionModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: 0,
                    width: '30px',
                    height: '30px',
                    color: 'var(--text-primary)',
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                      로컬스토리지 권한
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      설정값을 브라우저에 저장합니다
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginTop: '4px',
                      }}
                    >
                      상태: {localStoragePermission ? '허용' : '거부'}
                    </div>
                  </div>
                  <button
                    onClick={handleLocalStoragePermission}
                    style={{
                      padding: '8px 16px',
                      background: localStoragePermission
                        ? 'var(--color-second)'
                        : 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    {localStoragePermission ? '변경' : '허용'}
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                      알림 권한
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      브라우저 알림을 받습니다
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginTop: '4px',
                      }}
                    >
                      상태:{' '}
                      {'Notification' in window
                        ? Notification.permission === 'granted'
                          ? notificationPermission
                            ? ' 허용'
                            : ' 거부'
                          : Notification.permission === 'denied'
                          ? ' 거부'
                          : ' 요청 필요'
                        : ' 미지원'}
                    </div>
                  </div>
                  <button
                    onClick={handleNotificationPermission}
                    disabled={
                      'Notification' in window &&
                      Notification.permission === 'denied'
                    }
                    style={{
                      padding: '8px 16px',
                      background:
                        'Notification' in window &&
                        Notification.permission === 'denied'
                          ? 'var(--color-second)'
                          : 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor:
                        'Notification' in window &&
                        Notification.permission === 'denied'
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        'Notification' in window &&
                        Notification.permission === 'denied'
                          ? 0.6
                          : 1,
                    }}
                  >
                    {('Notification' in window &&
                      Notification.permission === 'granted') ||
                    ('Notification' in window &&
                      Notification.permission === 'denied')
                      ? '변경'
                      : '허용'}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => setShowPermissionModal(false)}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

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
                background: 'var(--bg-primary)',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '90%',
                width: '400px',
                maxHeight: '80vh',
                overflow: 'auto',
                color: 'var(--text-primary)',
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
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
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
                    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
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
              {/* 직접 업로드는 허용하지 않음 */}
            </div>
          </div>
        )}

        {/* 비로그인 사용자 안내 메시지 */}
        {!session && (
          <div
            className={styles.profile__section}
            style={{ textAlign: 'center', padding: '30px' }}
          >
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>👤</div>
            <div
              style={{ fontSize: '16px', color: '#666', marginBottom: '20px' }}
            >
              로그인하여 프로필을 설정하세요
            </div>
            <button
              onClick={() => router.push('/login')}
              style={{
                padding: '12px 24px',
                background: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              로그인하기
            </button>
          </div>
        )}

        {/* 앱 정보 섹션 */}
        <div className={styles.app__info}>
          <div className={styles.app__version}>버전 {appVersion}</div>
          <div className={styles.app__description}>{appDescription}</div>
        </div>

        {/* 설정 리스트 */}
        <div className={styles.setting__list}>
          {settingItems.map((item) => (
            <div
              key={item.id}
              className={`${styles.setting__item} ${
                'danger' in item && item.danger ? styles.danger : ''
              }`}
              onClick={item.action}
            >
              <div
                style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
              >
                <span className={styles.setting__label}>{item.label}</span>
                {'subtitle' in item && item.subtitle && (
                  <span className={styles.setting__subtitle}>
                    {item.subtitle}
                  </span>
                )}
              </div>
              {item.type === 'toggle' && 'value' in item ? (
                <div
                  className={styles.toggle}
                  onClick={(e) => {
                    e.stopPropagation()
                    item.action()
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.value}
                    onChange={() => {}}
                    className={styles.toggle__input}
                    readOnly
                  />
                  <span
                    className={`${styles.toggle__slider} ${
                      item.value ? styles.active : ''
                    }`}
                  ></span>
                </div>
              ) : (
                <span className={styles.setting__arrow}>›</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
