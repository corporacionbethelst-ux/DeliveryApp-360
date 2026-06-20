'use client';

import React from 'react';

export interface DataPoint {
  label: string;
  value: number;
}

export interface AreaChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  className?: string;
}

export function AreaChartCustom({ 
  data, 
  height = 200, 
  color = '#3b82f6',
  className = ''
}: AreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sin datos disponibles
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  // Generar puntos del gráfico
  const points = data.map((d, i) => {
    const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
    const y = 100 - (d.value / maxValue) * 100;
    return `${x},${y}`;
  }).join(' ');

  // Crear el área cerrada para el relleno
  const areaPath = `0,100 ${points} 100,100`;
  const gradientId = `gradient-${color.replace('#', '')}`;

  return (
    <div className={`w-full relative ${className}`} style={{ height: `${height}px` }}>
      <svg 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none" 
        className="w-full h-full overflow-visible"
        role="img"
        aria-label="Gráfico de área mostrando tendencias"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Área rellena */}
        <polygon points={areaPath} fill={`url(#${gradientId})`} />
        
        {/* Línea superior */}
        <polyline 
          points={points} 
          fill="none" 
          stroke={color} 
          strokeWidth="2" 
          vectorEffect="non-scaling-stroke" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Puntos de datos */}
        {data.map((d, i) => {
          const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
          const y = 100 - (d.value / maxValue) * 100;
          return (
            <circle 
              key={i} 
              cx={x} 
              cy={y} 
              r="1.5" 
              fill="white" 
              stroke={color} 
              strokeWidth="1" 
              vectorEffect="non-scaling-stroke"
              className="hover:r-2 transition-all duration-200 cursor-pointer"
            />
          );
        })}
      </svg>
      
      {/* Labels del Eje X */}
      <div className="flex justify-between mt-2 text-xs text-gray-500 px-1">
        {data.map((d, i) => (
          <span key={i} className="truncate max-w-[60px]" title={d.label}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}