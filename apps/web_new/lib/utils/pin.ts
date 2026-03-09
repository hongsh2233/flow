/**
 * 간편비밀번호(PIN) 보안 유틸리티
 *
 * - Web Crypto API로 SHA-256 해싱
 * - 랜덤 salt를 생성하여 레인보우 테이블 공격 방지
 * - localStorage에는 해시값 + salt만 저장 (원본 PIN은 절대 저장 안 함)
 * - 기기 변경 시 localStorage가 없으므로 자동으로 재설정 유도
 */

const STORAGE_KEY = "jurini_pin";
const MAX_ATTEMPTS_KEY = "jurini_pin_attempts";
const LOCK_UNTIL_KEY = "jurini_pin_lock_until";
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 3 * 60 * 1000; // 3분 잠금

interface StoredPin {
  hash: string;
  salt: string;
}

/** 랜덤 salt 생성 (16바이트) */
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** PIN + salt를 SHA-256으로 해싱 */
async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** PIN 저장 (해시 + salt만 저장) */
export async function savePin(pin: string): Promise<void> {
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  const stored: StoredPin = { hash, salt };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  resetAttempts();
}

/** PIN 검증 */
export async function verifyPin(pin: string): Promise<boolean> {
  const stored = getStoredPin();
  if (!stored) return false;

  const hash = await hashPin(pin, stored.salt);
  return hash === stored.hash;
}

/** PIN이 설정되어 있는지 확인 */
export function isPinSet(): boolean {
  return getStoredPin() !== null;
}

/** PIN 제거 */
export function removePin(): void {
  localStorage.removeItem(STORAGE_KEY);
  resetAttempts();
  localStorage.removeItem(LOCK_UNTIL_KEY);
}

/** 저장된 PIN 데이터 가져오기 */
function getStoredPin(): StoredPin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.hash && parsed.salt) return parsed as StoredPin;
    return null;
  } catch {
    return null;
  }
}

/** 실패 횟수 관리 */
export function getAttempts(): number {
  return Number(localStorage.getItem(MAX_ATTEMPTS_KEY) || "0");
}

export function incrementAttempts(): number {
  const next = getAttempts() + 1;
  localStorage.setItem(MAX_ATTEMPTS_KEY, String(next));

  if (next >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCK_UNTIL_KEY, String(Date.now() + LOCK_DURATION_MS));
  }

  return next;
}

export function resetAttempts(): void {
  localStorage.setItem(MAX_ATTEMPTS_KEY, "0");
  localStorage.removeItem(LOCK_UNTIL_KEY);
}

/** 잠금 상태 확인 */
export function getLockRemaining(): number {
  const lockUntil = Number(localStorage.getItem(LOCK_UNTIL_KEY) || "0");
  if (!lockUntil) return 0;
  const remaining = lockUntil - Date.now();
  if (remaining <= 0) {
    resetAttempts();
    return 0;
  }
  return remaining;
}

export { MAX_ATTEMPTS };
