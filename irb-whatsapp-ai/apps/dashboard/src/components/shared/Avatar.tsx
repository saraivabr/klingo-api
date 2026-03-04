import React from 'react';

const COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500',
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

interface AvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Avatar({ name = '?', size = 'md' }: AvatarProps) {
  const initial = name.charAt(0).toUpperCase();
  const color = COLORS[hashName(name) % COLORS.length];
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };

  return (
    <div className={`${sizes[size]} ${color} text-white rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {initial}
    </div>
  );
}
