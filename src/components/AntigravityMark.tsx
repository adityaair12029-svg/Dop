import React from 'react';

interface AntigravityMarkProps {
  variant?: 'color' | 'monochrome';
  className?: string;
}

export const AntigravityMark: React.FC<AntigravityMarkProps> = ({
  variant = 'color',
  className = 'w-6 h-6',
}) => {
  const gradId = variant === 'color' ? 'agMarkColorGrad' : 'agMarkMonoGrad';
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="agMarkColorGrad" x1="8" y1="54" x2="56" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2F71E3" />
          <stop offset="45%" stopColor="#34A853" />
          <stop offset="72%" stopColor="#FBBC05" />
          <stop offset="100%" stopColor="#EA4335" />
        </linearGradient>
        <linearGradient id="agMarkMonoGrad" x1="16" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.92" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.32" />
        </linearGradient>
      </defs>
      <path
        d="M32 9C35.8 9 39.2 13.6 43.2 24.4L51.8 48.2C53 51.6 50.6 54.8 47 54.4C43.8 54 41.2 50.2 38.6 43.6C36.6 38.6 34.4 36.2 32 36.2C29.6 36.2 27.4 38.6 25.4 43.6C22.8 50.2 20.2 54 17 54.4C13.4 54.8 11 51.6 12.2 48.2L20.8 24.4C24.8 13.6 28.2 9 32 9Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
};
