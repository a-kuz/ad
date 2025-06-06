"use client";

import React from 'react';

interface ProgressBarProps {
  progress: number;
  label?: string;
}

export default function ProgressBar({ progress, label }: ProgressBarProps) {
  // Ensure progress is between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  
  return (
    <div className="w-full mb-4">
      {label && (
        <div className="flex justify-between mb-3">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{Math.round(clampedProgress)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div 
          className="h-full rounded-full transition-all duration-300 ease-in-out bg-primary" 
          style={{ width: `${clampedProgress}%` }}
        ></div>
      </div>
    </div>
  );
} 