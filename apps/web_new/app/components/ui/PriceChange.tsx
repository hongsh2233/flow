import { memo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface PriceChangeProps {
  change: number;
  iconClassName?: string;
  upClassName?: string;
  downClassName?: string;
  textClassName?: string;
  showIcon?: boolean;
}

export const PriceChange = memo(function PriceChange({
  change,
  iconClassName,
  upClassName,
  downClassName,
  textClassName,
  showIcon = true,
}: PriceChangeProps) {
  const isPositive = change >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const dirClass = isPositive ? upClassName : downClassName;

  return (
    <>
      {showIcon && (
        <Icon
          className={iconClassName ? `${iconClassName} ${dirClass ?? ""}` : dirClass}
          aria-hidden
        />
      )}
      <p className={textClassName ? `${textClassName} ${dirClass ?? ""}` : dirClass}>
        {isPositive ? "+" : ""}
        {change}%
      </p>
    </>
  );
});
