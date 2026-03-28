export type AddPicksIconProps = {
  size?: number;
  className?: string;
  isAdded?: boolean;
};

export function AddPicksIcon({ size = 18, className, isAdded = false }: AddPicksIconProps) {
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
      <path
        d="M5 8H19L17.5 20C17.4 21.1 16.5 22 15.4 22H8.6C7.5 22 6.6 21.1 6.5 20L5 8Z"
        fill="currentColor"
        fillOpacity={isAdded ? "1" : "0.1"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V5C9 3.34315 10.3431 2 12 2C13.6569 2 15 3.34315 15 5V8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!isAdded && (
        <path
          d="M12 12V18M9 15H15"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {isAdded && (
        <path
          d="M9.5 14L11.5 16L15 11"
          stroke="var(--app-card-bg, #ffffff)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
