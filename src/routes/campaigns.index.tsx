import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, MoreHorizontal, Eye, Pencil, Rocket, Loader2, AlertCircle, Trash2 } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChannelBadge, StatusBadge } from "@/components/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNum } from "@/lib/mock-data";
import { useCampaigns, useDeleteCampaign, useLaunchCampaign } from "@/hooks/use-api";
import type { CampaignStatus } from "@/lib/api/types";

const STATUS_TABS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Completed", value: "completed" },
  { label: "Draft", value: "draft" },
];

export const Route = createFileRoute("/campaigns/")({
  head: () => ({
    meta: [
      { title: "Campaigns — Campaign Copilot" },
      { name: "description", content: "Browse, launch and manage all your marketing campaigns." },
    ],
  }),
  component: Campaigns,
});

function Campaigns() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const launch = useLaunchCampaign();
  const navigate = useNavigate();
  const deleteCampaign = useDeleteCampaign();
  const [campaignToDelete, setCampaignToDelete] = useState<number | null>(null);

  const { data, isLoading, isError, error } = useCampaigns({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    ordering: "-created_at",
  });

  const campaigns = data ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        title="Campaigns"
        description="Manage active, scheduled and completed campaigns."
        actions={
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/copilot">
              <Plus className="h-4 w-4" /> New campaign
            </Link>
          </Button>
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Input
            placeholder="Search campaigns…"
            className="max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {(error as Error)?.message ?? "Failed to load campaigns."}
          </div>
        )}

        <Card>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Audience</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        {search ? "No campaigns match your search." : "No campaigns yet. Create one with the AI Copilot!"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaigns.map((c) => (
                      <TableRow 
                        key={c.id} 
                        className="cursor-pointer"
                        onClick={() => navigate({ to: '/campaigns/$id', params: { id: String(c.id) } })}
                      >
                        <TableCell>
                          <Link to="/campaigns/$id" params={{ id: String(c.id) }} className="font-medium hover:underline">
                            {c.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            #{c.id}{c.goal && c.goal !== c.name ? ` · ${c.goal}` : ""}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNum(c.audience_size)}</TableCell>
                        <TableCell>
                          <ChannelBadge channel={(c.channel || "email").charAt(0).toUpperCase() + (c.channel || "email").slice(1) as "Email" | "WhatsApp" | "SMS" | "Push"} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={(c.status || "draft").charAt(0).toUpperCase() + (c.status || "draft").slice(1) as "Draft" | "Scheduled" | "Active" | "Completed" | "Paused"} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem asChild>
                                <Link to="/campaigns/$id" params={{ id: String(c.id) }}>
                                  <Eye className="mr-2 h-3.5 w-3.5" /> View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem><Pencil className="mr-2 h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                              {(c.status === "draft" || c.status === "scheduled") && (
                                <DropdownMenuItem
                                  onClick={() => launch.mutate(c.id)}
                                  disabled={launch.isPending}
                                >
                                  <Rocket className="mr-2 h-3.5 w-3.5" /> Launch
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCampaignToDelete(c.id);
                                }}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {data && (
          <p className="text-right text-xs text-muted-foreground">
            {data.length} campaign{data.length !== 1 ? "s" : ""}
          </p>
        )}

        <AlertDialog open={campaignToDelete !== null} onOpenChange={(open) => !open && setCampaignToDelete(null)}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the campaign and all of its communication logs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCampaignToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => {
                  if (campaignToDelete !== null) {
                    deleteCampaign.mutate(campaignToDelete, {
                      onSuccess: () => setCampaignToDelete(null),
                    });
                  }
                }}
                disabled={deleteCampaign.isPending}
              >
                {deleteCampaign.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
