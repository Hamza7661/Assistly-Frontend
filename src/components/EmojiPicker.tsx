'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import type { Theme } from 'emoji-picker-react';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface EmojiPickerPopoverProps {
  onSelect: (emoji: { native: string }) => void;
  onClose: () => void;
  position?: 'left' | 'right' | 'center';
}

export default function EmojiPickerPopover({
  onSelect,
  onClose,
  position = 'right',
}: EmojiPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Handle outside click to close picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add event listener after a short delay to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const positionClasses = {
    left: 'right-0',
    right: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
  };

  return (
    <div
      ref={popoverRef}
      className={`absolute z-50 mt-2 ${positionClasses[position]}`}
    >
      <div className="rounded-xl shadow-lg border border-gray-200 bg-white overflow-hidden">
        <EmojiPicker
          theme={'light' as Theme}
          onEmojiClick={(emojiData) => {
            if (emojiData?.emoji) {
              onSelect({ native: emojiData.emoji });
            }
            onClose();
          }}
        />
      </div>
    </div>
  );
}
