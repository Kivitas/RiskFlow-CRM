import React from 'react';
import { Phone, Mail, Users, FileText, TrendingUp, ShieldAlert, UserPlus, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const typeConfig = {
  call: { icon: Phone, bg: 'bg-blue-50 text-blue-600' },
  email: { icon: Mail, bg: 'bg-purple-50 text-purple-600' },
  meeting: { icon: Users, bg: 'bg-teal-50 text-teal-600' },
  note: { icon: FileText, bg: 'bg-amber-50 text-amber-600' },
  task: { icon: CheckSquare, bg: 'bg-green-50 text-green-600' },
  deal_update: { icon: TrendingUp, bg: 'bg-primary/10 text-primary' },
  risk_alert: { icon: ShieldAlert, bg: 'bg-destructive/10 text-destructive' },
  onboarding: { icon: UserPlus, bg: 'bg-teal-50 text-teal-600' },
};

export default function RecentActivity({ activities }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">Recent Activity</h3>
      {activities.length === 0 ? (
        <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">No activity logged yet</div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {activities.slice(0, 10).map((activity) => {
            const config = typeConfig[activity.type] || typeConfig.note;
            const Icon = config.icon;
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", config.bg)}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">{activity.title}</p>
                  {activity.contact_name && <p className="text-xs text-muted-foreground">{activity.contact_name}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(activity.created_date), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}