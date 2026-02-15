"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Eye, EyeOff, Lock, Check, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { API_BASE_URL, getAuthHeaders, getImageUrl } from "@/lib/config/api";
import styles from "./ProfileEdit.module.css";

interface CharacterImage {
  name: string;
  image: string;
}

export default function ProfileEditPage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();

  // 프로필 사진
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [characterImages, setCharacterImages] = useState<CharacterImage[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState<"success" | "error" | null>(null);

  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // 세션에서 현재 프로필 이미지 로드
  useEffect(() => {
    if (session?.user?.image && !profileImage) {
      setProfileImage(getImageUrl(session.user.image));
    }
  }, [session, profileImage]);

  // 캐릭터 이미지 목록 조회
  const fetchCharacterImages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/characters`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && data.characters) {
        setCharacterImages(data.characters);
      }
    } catch {
      // 실패 시 무시
    }
  }, []);

  useEffect(() => {
    fetchCharacterImages();
  }, [fetchCharacterImages]);

  const handleSelectImage = async (image: string) => {
    if (!session?.user?.email) return;

    const prevImage = profileImage;
    setProfileImage(getImageUrl(image));
    setShowImagePicker(false);
    setIsSavingProfile(true);
    setProfileSaveMessage(null);

    try {
      const res = await fetch("/api/auth/member/update", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: session.user.email,
          nickname: session.user?.name || "주린이",
          profile_image: image,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        await updateSession({
          user: {
            name: data.nickname ?? session.user?.name,
            image: data.profile_image ?? image,
          },
        });
        setProfileSaveMessage("success");
        setTimeout(() => setProfileSaveMessage(null), 3000);
      } else {
        setProfileImage(prevImage);
        setProfileSaveMessage("error");
        setTimeout(() => setProfileSaveMessage(null), 3000);
      }
    } catch {
      setProfileImage(prevImage);
      setProfileSaveMessage("error");
      setTimeout(() => setProfileSaveMessage(null), 3000);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const passwordValid = currentPassword.length > 0 && newPassword.length >= 8 && passwordsMatch;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) return;
    // TODO: 실제 비밀번호 변경 API 연동
    setPasswordSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  return (
    <div className="content__wrap">
      <div className={styles.screen}>
        {/* 뒤로가기 헤더 */}
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.back()}
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.topBarTitle}>정보 수정</h2>
          <div className={styles.topBarSpacer} />
        </div>

        {/* 프로필 사진 변경 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>프로필 사진</h3>
          {profileSaveMessage === "success" && (
            <div className={styles.successMsg}>
              <Check size={16} />
              프로필 사진이 저장되었습니다.
            </div>
          )}
          {profileSaveMessage === "error" && (
            <div className={styles.errorMsg}>
              프로필 사진 저장에 실패했습니다.
            </div>
          )}
          <div
            className={styles.card}
            style={{
              opacity: isSavingProfile ? 0.7 : 1,
              pointerEvents: isSavingProfile ? "none" : "auto",
            }}
          >
            <div className={styles.avatarArea}>
              <div className={styles.avatarWrap}>
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="프로필"
                    className={styles.avatarImg}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>주</div>
                )}
              </div>
              <div className={styles.avatarInfo}>
                <p className={styles.avatarName}>{session?.user?.name || "주린이"}님</p>
              </div>
            </div>
            <div className={styles.avatarActions}>
              <Button
                variant="primary"
                className={styles.avatarBtn}
                onClick={() => setShowImagePicker(true)}
              >
                사진 변경
              </Button>
            </div>
          </div>
        </section>

        {/* 캐릭터 이미지 선택 모달 */}
        {showImagePicker && (
          <div className={styles.imagePickerOverlay} onClick={() => setShowImagePicker(false)}>
            <div className={styles.imagePickerModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.imagePickerHeader}>
                <h3 className={styles.imagePickerTitle}>프로필 이미지 선택</h3>
                <button
                  type="button"
                  className={styles.imagePickerClose}
                  onClick={() => setShowImagePicker(false)}
                  aria-label="닫기"
                >
                  <X size={20} />
                </button>
              </div>
              <div className={styles.imagePickerGrid}>
                {characterImages.map((char, idx) => {
                  const imgUrl = getImageUrl(char.image);
                  const isSelected = profileImage === imgUrl;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`${styles.imagePickerItem} ${isSelected ? styles.imagePickerItemSelected : ""}`}
                      onClick={() => handleSelectImage(char.image)}
                    >
                      <img
                        src={imgUrl}
                        alt={char.name}
                        className={styles.imagePickerImg}
                      />
                      <span className={styles.imagePickerName}>{char.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 비밀번호 변경 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>비밀번호 변경</h3>
          <div className={styles.card}>
            {passwordSuccess && (
              <div className={styles.successMsg}>
                <Check size={16} />
                비밀번호가 성공적으로 변경되었습니다.
              </div>
            )}
            <form onSubmit={handlePasswordChange}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>현재 비밀번호</label>
                <div className={styles.passwordWrap}>
                  <Lock size={18} className={styles.fieldIcon} />
                  <input
                    type={showCurrent ? "text" : "password"}
                    className={styles.fieldInput}
                    placeholder="현재 비밀번호 입력"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowCurrent(!showCurrent)}
                    aria-label={showCurrent ? "숨기기" : "보기"}
                  >
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>새 비밀번호</label>
                <div className={styles.passwordWrap}>
                  <Lock size={18} className={styles.fieldIcon} />
                  <input
                    type={showNew ? "text" : "password"}
                    className={styles.fieldInput}
                    placeholder="8자 이상 입력"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowNew(!showNew)}
                    aria-label={showNew ? "숨기기" : "보기"}
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {newPassword.length > 0 && newPassword.length < 8 && (
                  <p className={styles.fieldError}>비밀번호는 8자 이상이어야 합니다.</p>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>새 비밀번호 확인</label>
                <div className={styles.passwordWrap}>
                  <Lock size={18} className={styles.fieldIcon} />
                  <input
                    type={showConfirm ? "text" : "password"}
                    className={styles.fieldInput}
                    placeholder="새 비밀번호 재입력"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? "숨기기" : "보기"}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className={styles.fieldError}>비밀번호가 일치하지 않습니다.</p>
                )}
                {passwordsMatch && confirmPassword.length > 0 && (
                  <p className={styles.fieldMatch}>비밀번호가 일치합니다.</p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                large
                disabled={!passwordValid}
                className={styles.submitBtn}
              >
                비밀번호 변경
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
