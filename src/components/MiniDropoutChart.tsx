import React from 'react';
import { DropoutCurveTable } from '@/types';

interface MiniDropoutChartProps {
  dropoutData: DropoutCurveTable;
  width?: number;
  height?: number;
}

const MiniDropoutChart: React.FC<MiniDropoutChartProps> = ({ 
  dropoutData, 
  width = 120, 
  height = 80 
}) => {
  if (!dropoutData || !dropoutData.points || dropoutData.points.length === 0) {
    return (
      <div 
        className="bg-gray-50 rounded border flex items-center justify-center text-xs text-gray-400"
        style={{ width, height }}
      >
        Нет данных
      </div>
    );
  }

  const maxTime = Math.max(...dropoutData.points.map(p => p.timestamp));
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Создаем SVG path для кривой
  const pathData = dropoutData.points.map((point, index) => {
    const x = padding + (point.timestamp / maxTime) * chartWidth;
    const y = padding + ((100 - point.retentionPercentage) / 100) * chartHeight;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div className=" rounded" style={{ width, height }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {/* Кривая досмотра */}
        <path
          d={pathData}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
       
      </svg>
    </div>
  );
};

export default MiniDropoutChart; 