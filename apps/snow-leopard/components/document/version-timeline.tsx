'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { GitBranch } from 'lucide-react';

interface VersionData {
  id: string;
  content: string | null;
  title: string;
  createdAt: Date | string;
  updatedAt: Date | string; 
  version?: number;
  isCurrent?: boolean;
  diffContent?: string;
}

interface ChartDataPoint {
  version: number;
  additions: number;
  deletions: number;
  timestamp: string;
  content: string | null;
  versionId: string;
}

interface VersionTimelineProps {
  versions: VersionData[];
  currentVersionIndex: number;
  onVersionChange: (index: number) => void;
}

function generateAreaPath(data: ChartDataPoint[], key: 'additions' | 'deletions', isAbove: boolean): string {
  if (data.length === 0) return '';
  
  const maxValue = Math.max(...data.map(d => d[key]));
  if (maxValue === 0) return '';
  
  const width = 100;
  const height = 100;
  const centerY = height / 2;
  
  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width;
    const normalizedValue = point[key] / maxValue;
    const y = isAbove 
      ? centerY - (normalizedValue * centerY * 0.8)
      : centerY + (normalizedValue * centerY * 0.8);
    return `${x},${y}`;
  });
  
  const topPoints = points.join(' L');
  const bottomPoints = isAbove 
    ? `${width},${centerY} L0,${centerY}`
    : `${width},${centerY} L0,${centerY}`;
  
  return `M${topPoints} L${bottomPoints} Z`;
}

export function VersionTimeline({ 
  versions, 
  currentVersionIndex, 
  onVersionChange 
}: VersionTimelineProps) {
  const [sliderValue, setSliderValue] = useState(currentVersionIndex);

  const chartData: ChartDataPoint[] = useMemo(() => {
    return versions.map((version, index) => {
      let additions = 0;
      let deletions = 0;
      
      if (index === 0) {
        additions = 0;
        deletions = 0;
      } else {

        const previousVersion = versions[index - 1];
        const currentContent = version.content || '';
        const previousContent = previousVersion.content || '';
        
        const contentDiff = currentContent.length - previousContent.length;
        if (contentDiff > 0) {
          additions = contentDiff;
        } else if (contentDiff < 0) {
          deletions = Math.abs(contentDiff);
        }
      }
      
      const createdAt = typeof version.createdAt === 'string' 
        ? new Date(version.createdAt) 
        : version.createdAt;
      
      return {
        version: version.version || index + 1,
        additions,
        deletions,
        timestamp: createdAt.toISOString(),
        content: version.content || '',
        versionId: version.id
      };
    });
  }, [versions]);

  const handleSliderChange = useCallback((value: number[]) => {
    const newIndex = value[0];
    setSliderValue(newIndex);
    onVersionChange(newIndex);
  }, [onVersionChange]);

  React.useEffect(() => {
    setSliderValue(currentVersionIndex);
  }, [currentVersionIndex]);

  if (versions.length === 0) {
    return (
      <div className="w-full bg-background border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Version Timeline</span>
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">
          No versions available yet. Start editing to see version history.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-black border-b">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">
            Version {chartData[sliderValue]?.version || currentVersionIndex + 1}
          </span>
          <span className="text-xs text-gray-500">•</span>
          <span className="text-xs text-gray-500">
            {(chartData[sliderValue]?.content || '').split(' ').length} words
          </span>
        </div>
      </div>

      <div className="h-12 w-full relative px-4 pb-2">
        <div className="absolute top-1/2 left-4 right-4 h-px bg-gray-500 transform -translate-y-1/2 z-10"></div>
        
        <div className="relative h-full">
          <svg 
            width="calc(100% - 2rem)" 
            height="100%" 
            className="absolute inset-0 ml-4 cursor-pointer"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
              const newIndex = Math.round((percentage / 100) * (chartData.length - 1));
              handleSliderChange([newIndex]);
            }}
          >
            <defs>
              <linearGradient id="additionsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3"/>
              </linearGradient>
              <linearGradient id="deletionsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3"/>
              </linearGradient>
            </defs>
            
            <path
              d={generateAreaPath(chartData, 'additions', true)}
              fill="url(#additionsGradient)"
              stroke="#22c55e"
              strokeWidth="1"
              opacity="0.6"
            />
            
            <path
              d={generateAreaPath(chartData, 'deletions', false)}
              fill="url(#deletionsGradient)"
              stroke="#ef4444"
              strokeWidth="1"
              opacity="0.6"
            />
            
            <g transform={`translate(${((sliderValue) / (chartData.length - 1)) * 100}, 50)`}>
              <polygon
                points="0,0 -4,-8 4,-8"
                fill="white"
                stroke="#6b7280"
                strokeWidth="1"
                className="cursor-pointer"
                onMouseDown={(e) => {
                  const rect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                  if (rect) {
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const x = moveEvent.clientX - rect.left;
                      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                      const newIndex = Math.round((percentage / 100) * (chartData.length - 1));
                      handleSliderChange([newIndex]);
                    };
                    
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }
                }}
              />
              
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="50"
                stroke="#6b7280"
                strokeWidth="1"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Toolip, we can use if needed */}
      {/* <div className="px-4 pb-2">
        <div className="bg-gray-800 rounded-lg shadow-lg p-2 inline-block">
          <div className="text-xs text-gray-400">
            {chartData[sliderValue]?.timestamp 
              ? `${Math.round((Date.now() - new Date(chartData[sliderValue].timestamp).getTime()) / (1000 * 60))} minutes ago`
              : 'Current'
            }
          </div>
          <div className="text-xs mt-1">
            <span className="text-green-400">
              {chartData[sliderValue]?.additions || 0} additions +++
            </span>
          </div>
          <div className="text-xs">
            <span className="text-red-400">
              {chartData[sliderValue]?.deletions || 0} deletions ---
            </span>
          </div>
        </div>
      </div> */}
    </div>
  );
}
