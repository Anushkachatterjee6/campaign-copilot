import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const map: Record<string, string> = {
  Active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  Completed: "bg-muted text-muted-foreground border-border",
  Draft: "bg-muted text-muted-foreground border-border",
  Paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const channelMap: Record<string, string> = {
  Email: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  WhatsApp: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  SMS: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Push: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", map[status] ?? "")}>
      <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full",
        status === "Active" && "bg-emerald-500",
        status === "Scheduled" && "bg-blue-500",
        status === "Paused" && "bg-amber-500",
        (status === "Completed" || status === "Draft") && "bg-muted-foreground/60",
      )} />
      {status}
    </Badge>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", channelMap[channel] ?? "")}>
      {channel}
    </Badge>
  );
}
