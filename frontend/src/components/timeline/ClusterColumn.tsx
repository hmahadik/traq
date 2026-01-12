import { Network, ChevronDown, ChevronUp } from 'lucide-react';
import { ActivityCluster } from '../../types/timeline';
import { useState } from 'react';

interface ClusterColumnProps {
  clusters: ActivityCluster[];
  hourHeight: number;
}

export function ClusterColumn({ clusters, hourHeight }: ClusterColumnProps) {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

  const toggleCluster = (clusterId: string) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };

  if (!clusters || clusters.length === 0) {
    return null;
  }

  return (
    <div className="relative" style={{ height: '100%', minWidth: '140px' }}>
      {clusters.map((cluster) => {
        const isExpanded = expandedClusters.has(cluster.id);

        return (
          <div
            key={cluster.id}
            className="absolute left-0 right-0 group cursor-pointer"
            style={{
              top: `${cluster.pixelPosition}px`,
              height: `${Math.max(cluster.pixelHeight, 32)}px`,
            }}
            onClick={() => toggleCluster(cluster.id)}
          >
            {/* Cluster card with gradient background */}
            <div
              className={`
                mx-1 h-full rounded-md border-2 transition-all
                ${isExpanded
                  ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50'
                  : 'border-amber-300 bg-gradient-to-br from-amber-50/50 to-orange-50/50 hover:border-amber-400'
                }
                group-hover:shadow-md
              `}
            >
              <div className="p-2 h-full flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <Network className="w-3 h-3 text-amber-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-amber-900">
                      {cluster.eventCount} Events
                    </span>
                  </div>
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3 text-amber-600" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-amber-600" />
                    )}
                  </div>
                </div>

                {/* Summary */}
                <div className="text-xs text-amber-800 flex-1 min-w-0">
                  <p className={`${isExpanded ? '' : 'line-clamp-2'}`}>
                    {cluster.summary}
                  </p>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-amber-200 space-y-1">
                    {cluster.gitEventIds && cluster.gitEventIds.length > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span className="text-xs text-gray-600">
                          {cluster.gitEventIds.length} Git commit{cluster.gitEventIds.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {cluster.shellEventIds && cluster.shellEventIds.length > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                        <span className="text-xs text-gray-600">
                          {cluster.shellEventIds.length} Shell command{cluster.shellEventIds.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {cluster.fileEventIds && cluster.fileEventIds.length > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        <span className="text-xs text-gray-600">
                          {cluster.fileEventIds.length} File event{cluster.fileEventIds.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {cluster.browserEventIds && cluster.browserEventIds.length > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                        <span className="text-xs text-gray-600">
                          {cluster.browserEventIds.length} Browser visit{cluster.browserEventIds.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Visual connection lines to event columns (when expanded) */}
            {isExpanded && (
              <div className="absolute left-full top-0 bottom-0 w-4">
                <svg className="w-full h-full">
                  <line
                    x1="0"
                    y1="50%"
                    x2="100%"
                    y2="50%"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="3,3"
                    opacity="0.4"
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
