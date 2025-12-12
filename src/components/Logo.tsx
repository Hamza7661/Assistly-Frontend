'use client';

import React from 'react';

interface LogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  src?: string;
}

export default function Logo({ className = '', width, height, src = '/assistly-logo.png' }: LogoProps) {
  const defaultWidth = width || 120;
  const defaultHeight = height || (typeof defaultWidth === 'number' ? defaultWidth * 0.3 : 36);

  return (
    <img
      src={src}
      alt="Assistly Logo"
      className={`${className} logo-image`}
      width={typeof defaultWidth === 'number' ? defaultWidth : undefined}
      height={typeof defaultHeight === 'number' ? defaultHeight : undefined}
      style={{
        width: defaultWidth,
        height: 'auto',
        maxHeight: defaultHeight,
        display: 'inline-block',
        objectFit: 'contain',
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        borderRadius: 0,
      }}
    />
  );
}
