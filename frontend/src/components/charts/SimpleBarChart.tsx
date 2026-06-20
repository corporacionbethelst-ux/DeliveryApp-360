'use client';

import React from 'react';

export interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface SimpleBarChartProps {
  data: DataPoint[];
  height?: number;
  showValues?: boolean;
  className?: string;
  formatValue?: (val: number) => string;
}

export function SimpleBarChart({ 
  data, 
  height = 200, 
  showValues = true,
  className = '',
  formatValue = (val) => val.toLocaleString()
}: SimpleBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sin datos disponibles
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className={`w-full ${className}`} style={{ height: `${height}px` }}>
      <div className="flex items-end justify-between h-full gap-2 pt-6 pb-2">
        {data.map((item, idx) => {
          const barHeight = (item.value / maxValue) * 100;
          const barColor = item.color || 'bg-blue-500';
          
          return (
            <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
              {/* Tooltip */}
              {showValues && (
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 shadow-lg transform translate-y-2 group-hover:translate-y-0">
                  {formatValue(item.value)}
                  {/* Triángulo del tooltip */}
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                </div>
              )}
              
              {/* Contenedor de la barra para animación */}
              <div className="w-full max-w-[40px] relative flex items-end h-full">
                <div 
                  className={`w-full rounded-t-md transition-all duration-700 ease-out hover:opacity-80 ${barColor}`}
                  style={{ height: `${barHeight}%` }}
                  role="progressbar"
                  aria-valuenow={item.value}
                  aria-valuemin={0}
                  aria-valuemax={maxValue}
                  aria-label={`${item.label}: ${formatValue(item.value)}`}
                />
              </div>
              
              {/* Label */}
              <span className="text-xs text-gray-500 mt-2 truncate w-full text-center font-medium">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}