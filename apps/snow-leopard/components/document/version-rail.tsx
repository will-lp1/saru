'use client';

import * as React from 'react';
import * as Slider from '@radix-ui/react-slider';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip as ReTooltip, ReferenceLine } from 'recharts';
import { diff_match_patch, DIFF_INSERT, DIFF_DELETE } from 'diff-match-patch';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../ui/button';

interface VersionData {
  id: string;
  content: string | null;
  createdAt: Date | string;
  version?: number;
}

interface VersionRailProps {
  versions: VersionData[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  baseDocumentId: string;
  isLoading?: boolean;
  refreshVersions?: () => void;
}

export function VersionRail({ versions, currentIndex, onIndexChange, baseDocumentId, isLoading, refreshVersions }: VersionRailProps){
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [pressStart, setPressStart] = React.useState<number | null>(null);
  const [lastClickTime, setLastClickTime] = React.useState<number>(0);

  const lastRefreshRef = React.useRef(0);

  const maybeRefresh = React.useCallback(() => {
    if (!refreshVersions) return;
    const now = Date.now();
    if (now - lastRefreshRef.current > 5000) {
      refreshVersions();
      lastRefreshRef.current = now;
    }
  }, [refreshVersions]);

  const data = React.useMemo(()=>{
    const dmp = new diff_match_patch();
    return versions.map((v,i)=>{
      const prevContent = i===0? '' : versions[i-1].content || '';
      const currContent = v.content || '';

      const diffs = dmp.diff_main(prevContent, currContent);
      // Quick cleanup to merge trivial diffs
      dmp.diff_cleanupSemantic(diffs);
      let additions = 0;
      let deletions = 0;
      for (const [op, text] of diffs) {
        if (op === DIFF_INSERT) additions += text.length;
        else if (op === DIFF_DELETE) deletions += text.length;
      }

      const timeField = (i === versions.length - 1)
        ? (v as any).updatedAt ?? v.createdAt
        : v.createdAt;

      return {
        x: i,
        additions,
        deletions: -deletions,
        ts: typeof timeField==='string'? timeField : (timeField as Date).toISOString(),
      };
    });
  },[versions]);
  React.useEffect(() => {
    if (currentIndex === versions.length - 1) {
      setSelectedIndex(currentIndex);
    } else {
      setSelectedIndex(currentIndex);
    }
  }, [currentIndex, versions.length]);
  
  const isViewingHistory = selectedIndex !== null && selectedIndex < versions.length - 1;
  if (isLoading || versions.length <= 1) {
    return <div className="w-full border-b bg-background h-1 group-hover:h-12 transition-all duration-200" />;
  }

  const handleValueChange = (val:number[])=>{
    const idx=val[0];
    const v = versions[idx];
    if (!v) return;
    window.dispatchEvent(
      new CustomEvent('preview-document-update', {
        detail: { documentId: baseDocumentId, newContent: v.content },
      })
    );
    setHoverIndex(idx);
  };
  const commitIndex = (idx:number) => {
    setSelectedIndex(idx);
    
    onIndexChange(idx);

    if (idx >= versions.length - 1) {
      window.dispatchEvent(
        new CustomEvent('cancel-document-update', {
          detail: { documentId: baseDocumentId },
        })
      );
    } else {
      const v = versions[idx];
      if (v) {
        window.dispatchEvent(
          new CustomEvent('preview-document-update', {
            detail: { documentId: baseDocumentId, newContent: v.content },
          })
        );
      }
    }
  };

  const handleCommit = (val:number[]) => {
    commitIndex(val[0]);
  };

  const triggerFork = (idx: number) => {
    const version = versions[idx];
    if (!version || idx >= versions.length - 1) return;
    
    window.dispatchEvent(
      new CustomEvent('version-fork', {
        detail: { 
          originalDocumentId: baseDocumentId,
          versionIndex: idx,
          forkFromTimestamp: version.createdAt,
        },
      })
    );
  };

  const handleClickArea = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = x / rect.width;
    const idx = Math.min(Math.max(Math.round(fraction * (versions.length - 1)), 0), versions.length - 1);
    
    if (now - lastClickTime < 300) {
      triggerFork(idx);
    } else {
      commitIndex(idx);
    }
    
    setLastClickTime(now);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    maybeRefresh();
    if (!versions.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.min(Math.max(Math.round((x / rect.width) * (versions.length - 1)), 0), versions.length - 1);
    if (idx < 0 || idx >= versions.length) return;
    if (idx === hoverIndex) return;

    const v = versions[idx];
    window.dispatchEvent(
      new CustomEvent('preview-document-update', {
        detail: { documentId: baseDocumentId, newContent: v.content },
      })
    );
    setHoverIndex(idx);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    maybeRefresh();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = x / rect.width;
    const idx = Math.min(Math.max(Math.round(fraction * (versions.length - 1)), 0), versions.length - 1);
    
    setPressStart(Date.now());
    
    setTimeout(() => {
      if (pressStart !== null && Date.now() - pressStart >= 800) {
        triggerFork(idx);
        setPressStart(null);
      }
    }, 800);
  };

  const handlePointerUp = () => {
    setPressStart(null);
  };

  const handlePointerLeave = () => {
    setPressStart(null);
    if (hoverIndex !== null) {
      if (isViewingHistory && selectedIndex !== null && selectedIndex < versions.length - 1) {
        const v = versions[selectedIndex];
        window.dispatchEvent(
          new CustomEvent('preview-document-update', {
            detail: { documentId: baseDocumentId, newContent: v.content },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('cancel-document-update', {
            detail: { documentId: baseDocumentId },
          })
        );
      }
      setHoverIndex(null);
    }

    if (isViewingHistory) {
      commitIndex(versions.length - 1);
    }
  };

  const Tooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { ts: string; additions: number; deletions: number } }> }) => {
    if(active&&payload&&payload.length){
      const d=payload[0].payload;
      return (
        <div className="bg-background border px-2 py-1 text-xs rounded shadow">
          <div>{formatDistanceToNow(new Date(d.ts),{addSuffix:true})}</div>
          <div className="flex items-center gap-1">
            <span className="text-green-500">+{d.additions}</span>
            <span className="text-red-500">-{Math.abs(d.deletions)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const goToLatest = () => {
    const latestIndex = versions.length - 1;
    setSelectedIndex(latestIndex);
    onIndexChange(latestIndex);
    window.dispatchEvent(
      new CustomEvent('cancel-document-update', {
        detail: { documentId: baseDocumentId },
      })
    );
  };

  return (
    <div className="w-full">
      <div
        className={`w-full border-b bg-background transition-all duration-200 group ${isViewingHistory ? 'h-12' : 'hover:h-12 h-1'}`}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={(e) => {
          maybeRefresh();
          handlePointerUp();
          handleClickArea(e as any);
        }}
      >
      <Slider.Root
        className="relative w-full h-full flex items-center"
        value={[selectedIndex ?? currentIndex]}
        max={versions.length-1}
        step={1}
        onValueChange={handleValueChange}
        onValueCommit={handleCommit}
      >
        <Slider.Track className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{top:0,right:0,left:0,bottom:0}}>
              <ReferenceLine y={0} stroke="#d4d4d8" strokeWidth={1} />
              <XAxis dataKey="x" hide />
              <YAxis hide domain={['dataMin','dataMax']} />
              <Area 
                type="monotone" 
                dataKey="additions" 
                stroke="#16a34a" 
                fill="#16a34a" 
                fillOpacity={0.25}
                strokeWidth={1}
                isAnimationActive={false} 
              />
              <Area 
                type="monotone" 
                dataKey="deletions" 
                stroke="#dc2626" 
                fill="#dc2626" 
                fillOpacity={0.25}
                strokeWidth={1} 
                isAnimationActive={false} 
              />
              <ReTooltip content={<Tooltip/>} cursor={{stroke:'#888',strokeWidth:1}} wrapperStyle={{outline:'none'}}/>
            </AreaChart>
          </ResponsiveContainer>
          
          {isViewingHistory && (
            <div 
              className="absolute top-0 h-full w-0.5 bg-blue-500 shadow-lg"
              style={{ 
                left: `${((selectedIndex || 0) / (versions.length - 1)) * 100}%`,
                transform: 'translateX(-50%)'
              }}
            />
          )}
        </Slider.Track>
        <Slider.Thumb className="hidden" />
      </Slider.Root>
      </div>

      {isViewingHistory && (
        <div className="flex items-center justify-center py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToLatest}
            className="h-7 px-3 text-xs"
          >
            Return to latest
          </Button>
        </div>
      )}
    </div>
  );
}

