import { cn } from '../../../../utils/src/frontend-utils';
import { formatNumber, timeAgo } from '../../../../utils/src/frontend-utils';

export interface ActivityItem {
  id: string;
  type: 'message' | 'lead' | 'campaign' | 'automation' | 'payment';
  title: string;
  description: string;
  timestamp: number;
  channel?: string;
}

const typeColors: Record<string, string> = {
  message: 'bg-blue-500',
  lead: 'bg-emerald-500',
  campaign: 'bg-purple-500',
  automation: 'bg-amber-500',
  payment: 'bg-green-500',
};

interface ActivityFeedProps {
  items: ActivityItem[];
  className?: string;
}

export function ActivityFeed({ items = [], className }: ActivityFeedProps) {
  if (!items.length) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No recent activity
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 px-3 py-2.5 rounded-xl
                     hover:bg-white/[0.03] transition-colors group"
        >
          <span className={cn('w-2 h-2 rounded-full mt-2 shrink-0', typeColors[item.type] || 'bg-gray-500')} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-200 group-hover:text-white transition-colors truncate">
              {item.title}
            </p>
            <p className="text-xs text-gray-500 truncate">{item.description}</p>
          </div>
          <span className="text-2xs text-gray-600 shrink-0">
            {timeAgo(item.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

