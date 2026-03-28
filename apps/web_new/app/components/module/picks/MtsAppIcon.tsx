/**
 * 마켓 PICKS — 증권사 MTS 이동 버튼용 아이콘 (스마트폰 + 미니 차트 라인)
 * `currentColor`로 테마·호버색 상속
 */
type Props = {
  size?: number;
  className?: string;
};

export function MtsAppIcon({ size = 18, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="5.1"
        y="2.85"
        width="13.8"
        height="18.3"
        rx="2.85"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M8.15 5.35h7.7"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity={0.32}
      />
      <path
        d="M8.35 15.9 L10.55 11.35 L12.25 12.95 L14.85 8.15 L16.55 9.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.55" cy="9.75" r="1.1" fill="currentColor" />
      <path
        d="M9.35 18.65h5.3"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
        opacity={0.38}
      />
    </svg>
  );
}
