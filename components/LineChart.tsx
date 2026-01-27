import React, { useState } from 'react';

interface ChartData {
  date: string;
  value: number;
}

interface LineChartProps {
  data: ChartData[];
  color?: string;
}

const LineChart: React.FC<LineChartProps> = ({ data, color = '#4f46e5' }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: ChartData } | null>(null);

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        需要至少兩筆數據才能繪製圖表。
      </div>
    );
  }

  const width = 500;
  const height = 300;
  const padding = 50;
  
  const dates = data.map(d => new Date(d.date).getTime());
  const values = data.map(d => d.value);

  const minX = Math.min(...dates);
  const maxX = Math.max(...dates);
  const minY = 0; // Always start Y axis from 0
  const maxY = Math.max(...values);

  const getX = (date: number) => {
    return ((date - minX) / (maxX - minX)) * (width - padding * 2) + padding;
  };

  const getY = (value: number) => {
    return height - padding - ((value - minY) / (maxY - minY)) * (height - padding * 2);
  };
  
  const path = data
    .map((d, i) => {
      const x = getX(new Date(d.date).getTime());
      const y = getY(d.value);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  
  const yAxisLabels = [];
  for (let i = 0; i <= 5; i++) {
    const value = minY + (i / 5) * (maxY - minY);
    yAxisLabels.push({
      value: value.toFixed(1),
      y: getY(value)
    });
  }

  const xAxisLabels = data.map((d, i) => {
     if (data.length <= 7 || i % Math.floor(data.length / 6) === 0) {
        return {
          value: new Date(d.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit'}),
          x: getX(new Date(d.date).getTime())
        }
     }
     return null;
  }).filter(Boolean);


  return (
    <div className="relative w-full overflow-x-auto custom-scrollbar">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[500px]">
        {/* Grid lines */}
        {yAxisLabels.map(label => (
          <line
            key={label.y}
            x1={padding}
            y1={label.y}
            x2={width - padding}
            y2={label.y}
            stroke="rgba(203, 213, 225, 0.5)"
            strokeDasharray="2,2"
          />
        ))}

        {/* Axes */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(148, 163, 184, 0.8)" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(148, 163, 184, 0.8)" />
        
        {/* Y Axis Labels */}
        {yAxisLabels.map(label => (
          <text key={label.y} x={padding - 10} y={label.y + 4} textAnchor="end" fontSize="10" fill="currentColor" className="text-slate-500">
            {label.value}
          </text>
        ))}
        <text x={padding-10} y={padding-10} textAnchor="end" fontSize="10" fill="currentColor" className="text-slate-400 font-bold">KG</text>

        {/* X Axis Labels */}
        {xAxisLabels.map(label => (
          <text key={label.x} x={label.x} y={height - padding + 20} textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500">
            {label.value}
          </text>
        ))}

        {/* Data Path */}
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
        
        {/* Data Points */}
        {data.map((d, i) => {
          const x = getX(new Date(d.date).getTime());
          const y = getY(d.value);
          return (
             <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill={color}
                stroke="white"
                strokeWidth="2"
                onMouseEnter={() => setTooltip({ x, y, data: d })}
                onMouseLeave={() => setTooltip(null)}
                className="cursor-pointer"
             />
          );
        })}

        {/* Tooltip */}
        {tooltip && (
            <g transform={`translate(${tooltip.x}, ${tooltip.y})`}>
                <rect x="-40" y="-45" width="80" height="35" rx="5" fill="rgba(15, 23, 42, 0.8)" />
                <text x="0" y="-30" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                    {tooltip.data.value} KG
                </text>
                <text x="0" y="-15" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10">
                    {new Date(tooltip.data.date).toLocaleDateString('zh-TW')}
                </text>
            </g>
        )}
      </svg>
    </div>
  );
};

export default LineChart;
