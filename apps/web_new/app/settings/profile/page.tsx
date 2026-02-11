"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, ArrowLeft, Eye, EyeOff, Lock, Check } from "lucide-react";
import { Button } from "../../components/ui/Button";
import styles from "./ProfileEdit.module.css";

export default function ProfileEditPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 프로필 사진
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfileImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageRemove = () => {
    setProfileImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
          <div className={styles.card}>
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
                <button
                  type="button"
                  className={styles.cameraBtn}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="사진 변경"
                >
                  <Camera size={16} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.fileInput}
                  onChange={handleImageChange}
                />
              </div>
              <div className={styles.avatarInfo}>
                <p className={styles.avatarName}>주린이님</p>
                <p className={styles.avatarHint}>JPG, PNG 파일 (최대 5MB)</p>
              </div>
            </div>
            <div className={styles.avatarActions}>
              <Button
                variant="primary"
                className={styles.avatarBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                사진 변경
              </Button>
              {profileImage && (
                <Button
                  variant="secondary"
                  className={styles.avatarBtn}
                  onClick={handleImageRemove}
                >
                  사진 삭제
                </Button>
              )}
            </div>
          </div>
        </section>

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
