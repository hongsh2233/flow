"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, ShieldOff } from "lucide-react";
import PinKeypad from "../../components/ui/PinKeypad";
import { StockTermBox } from "../../components/module/stock-term-box";
import { Button } from "../../components/ui/Button";
import {
  savePin,
  verifyPin,
  isPinSet,
  removePin,
} from "@/lib/utils/pin";
import styles from "./PinSettings.module.css";

type Step = "menu" | "verify-current" | "enter-new" | "confirm-new" | "done";

export default function PinSettingsPage() {
  const router = useRouter();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [action, setAction] = useState<"set" | "change" | "remove">("set");

  useEffect(() => {
    setPinEnabled(isPinSet());
  }, []);

  const resetState = () => {
    setPin("");
    setFirstPin("");
    setError("");
  };

  const handleSetNew = () => {
    setAction("set");
    resetState();
    setStep("enter-new");
  };

  const handleChange = () => {
    setAction("change");
    resetState();
    setStep("verify-current");
  };

  const handleRemove = () => {
    setAction("remove");
    resetState();
    setStep("verify-current");
  };

  const handleVerifyCurrent = useCallback(async (value: string) => {
    const valid = await verifyPin(value);
    if (!valid) {
      setError("비밀번호가 일치하지 않습니다.");
      setPin("");
      return;
    }
    setError("");
    setPin("");

    if (action === "remove") {
      removePin();
      setPinEnabled(false);
      setStep("done");
    } else {
      setStep("enter-new");
    }
  }, [action]);

  const handleEnterNew = useCallback((value: string) => {
    setFirstPin(value);
    setPin("");
    setError("");
    setStep("confirm-new");
  }, []);

  const handleConfirmNew = useCallback(async (value: string) => {
    if (value !== firstPin) {
      setError("비밀번호가 일치하지 않습니다. 다시 입력해주세요.");
      setPin("");
      setStep("enter-new");
      setFirstPin("");
      return;
    }
    await savePin(value);
    setPinEnabled(true);
    setStep("done");
  }, [firstPin]);

  const stepConfig: Record<
    Exclude<Step, "menu" | "done">,
    { title: string; subtitle: string; onComplete: (v: string) => void }
  > = {
    "verify-current": {
      title: "현재 비밀번호 확인",
      subtitle: "설정된 간편 비밀번호를 입력해주세요.",
      onComplete: handleVerifyCurrent,
    },
    "enter-new": {
      title: "새 비밀번호 입력",
      subtitle: "6자리 숫자를 입력해주세요.",
      onComplete: handleEnterNew,
    },
    "confirm-new": {
      title: "비밀번호 확인",
      subtitle: "한번 더 입력해주세요.",
      onComplete: handleConfirmNew,
    },
  };

  // 메뉴 화면
  if (step === "menu") {
    return (
      <div className="content__wrap">
        <div className={styles.screen}>
          <div className={styles.topBar}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => router.back()}
              aria-label="뒤로가기"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className={styles.topBarTitle}>간편 비밀번호</h2>
            <div className={styles.topBarSpacer} />
          </div>

          <div className={styles.statusSection}>
            <div className={styles.statusIcon}>
              {pinEnabled ? (
                <ShieldCheck size={48} className={styles.statusIconEnabled} />
              ) : (
                <ShieldOff size={48} className={styles.statusIconDisabled} />
              )}
            </div>
            <h3 className={styles.statusTitle}>
              {pinEnabled ? "간편 비밀번호가 설정되어 있습니다" : "간편 비밀번호가 설정되지 않았습니다"}
            </h3>
            <p className={styles.statusDesc}>
              {pinEnabled
                ? "앱 실행 시 간편 비밀번호로 잠금 해제합니다."
                : "6자리 숫자로 앱을 보호하세요."}
            </p>
          </div>

          <div className={styles.actions}>
            {!pinEnabled && (
              <Button
                variant="primary"
                fullWidth
                large
                onClick={handleSetNew}
              >
                간편 비밀번호 설정
              </Button>
            )}
            {pinEnabled && (
              <>
                <Button
                  variant="primary"
                  fullWidth
                  large
                  onClick={handleChange}
                >
                  비밀번호 변경
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  large
                  onClick={handleRemove}
                  className={styles.removeBtn}
                >
                  비밀번호 해제
                </Button>
              </>
            )}
          </div>
          <StockTermBox wrapperStyle={{ marginTop: "1.5rem" }} />
        </div>
      </div>
    );
  }

  // 완료 화면
  if (step === "done") {
    return (
      <div className="content__wrap">
        <div className={styles.screen}>
          <div className={styles.topBar}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => router.back()}
              aria-label="뒤로가기"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className={styles.topBarTitle}>간편 비밀번호</h2>
            <div className={styles.topBarSpacer} />
          </div>

          <div className={styles.doneSection}>
            <div className={styles.doneIcon}>
              {action === "remove" ? (
                <ShieldOff size={56} className={styles.statusIconDisabled} />
              ) : (
                <ShieldCheck size={56} className={styles.statusIconEnabled} />
              )}
            </div>
            <h3 className={styles.doneTitle}>
              {action === "remove"
                ? "간편 비밀번호가 해제되었습니다"
                : action === "change"
                  ? "비밀번호가 변경되었습니다"
                  : "간편 비밀번호가 설정되었습니다"}
            </h3>
            <Button
              variant="primary"
              large
              onClick={() => router.back()}
              className={styles.doneBtn}
            >
              설정으로 돌아가기
            </Button>
          </div>
          <StockTermBox wrapperStyle={{ marginTop: "1.5rem" }} />
        </div>
      </div>
    );
  }

  // PIN 입력 화면
  const config = stepConfig[step];

  return (
    <div className="content__wrap">
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => {
              resetState();
              setStep("menu");
            }}
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.topBarTitle}>간편 비밀번호</h2>
          <div className={styles.topBarSpacer} />
        </div>

        <PinKeypad
          pin={pin}
          maxLength={6}
          title={config.title}
          subtitle={config.subtitle}
          error={error}
          onPinChange={(v) => {
            setError("");
            setPin(v);
          }}
          onComplete={config.onComplete}
        />
        <StockTermBox wrapperStyle={{ marginTop: "1.5rem" }} />
      </div>
    </div>
  );
}
