import React from "react";

interface VipBadgeProps {
  className?: string;
}

export function VipBadge({ className = "h-5 w-5" }: VipBadgeProps) {
  return (
    <svg
      viewBox="5 5 50 30"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Simple rounded rectangle background */}
      <rect
        x="2"
        y="2"
        width="56"
        height="36"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* VIP text as filled paths */}
      <text
        x="30"
        y="28"
        fontSize="20"
        fontWeight="bold"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Arial, sans-serif"
      >
        VIP
      </text>
    </svg>
  );
}
