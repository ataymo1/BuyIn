interface VipBadgeProps {
  className?: string;
}

export function VipBadge({ className = "h-5 w-5" }: VipBadgeProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="5 5 50 30"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Simple rounded rectangle background */}
      <rect
        fill="none"
        height="36"
        rx="6"
        stroke="currentColor"
        strokeWidth="3"
        width="56"
        x="2"
        y="2"
      />

      {/* VIP text as filled paths */}
      <text
        fill="currentColor"
        fontFamily="Arial, sans-serif"
        fontSize="20"
        fontWeight="bold"
        textAnchor="middle"
        x="30"
        y="28"
      >
        VIP
      </text>
    </svg>
  );
}
