import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Rocket, Pencil, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";

import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChannelBadge, StatusBadge } from "@/components/status-badge";
import { formatINR, formatNum } from "@/lib/mock-data";

import { useCampaign, useCampaignStats, useLaunchCampaign, useDeleteCampaign } from "@/hooks/use-api";
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

export const Route = createFileRoute("/campaigns/$id")({
  component: CampaignDetail,
});

function CampaignDetail() {
  const params = Route.useParams();
  const campaignId = Number(params.id);
  const launch = useLaunchCampaign();
  const deleteCampaign = useDeleteCampaign();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const { data: c, isLoading, isError, error } = useCampaign(campaignId);
  const { data: stats } = useCampaignStats(campaignId);
  
  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading...</div>;
  if (isError || !c) return (
    <div className="p-10 text-center">
      <p className="text-sm text-muted-foreground">{(error as Error)?.message || "Campaign not found."}</p>
      <Button asChild variant="link"><Link to="/campaigns">Back to campaigns</Link></Button>
    </div>
  );

  const details = {
    name: c.name || "Unnamed Campaign",
    goal: c.goal || "—",
    status: c.status || "draft",
    channel: c.channel || "email",
    audience_size: c.audience_size || 0,
    segment_name: c.segment_name || "Custom Segment",
    created_at: c.created_at || new Date().toISOString(),
    message: c.message || "No message defined for this campaign.",
    expected_outcome: c.expected_outcome || null,
  };

  const isPreLaunch = details.status === "draft" || details.status === "scheduled";
  const sentCount = isPreLaunch ? 0 : (stats?.total_communications ?? 0);
  const by_status = stats?.by_status || {};
  
  const funnel = [
    { stage: "Sent", value: sentCount },
    { stage: "Delivered", value: isPreLaunch ? 0 : (by_status["delivered"] || 0) },
    { stage: "Opened", value: isPreLaunch ? 0 : (by_status["opened"] || 0) },
    { stage: "Clicked", value: isPreLaunch ? 0 : (by_status["clicked"] || 0) },
    { stage: "Converted", value: isPreLaunch ? 0 : (by_status["converted"] || 0) },
  ];
  
  const conversionRate = sentCount > 0 ? (((by_status["clicked"] || 0) / sentCount) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        title={details.name}
        description={`${(details.channel || "email").charAt(0).toUpperCase() + (details.channel || "email").slice(1)} campaign · created ${new Date(details.created_at).toLocaleDateString()}`}
        actions={
          <>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/campaigns"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5"><Pencil className="h-4 w-4" /> Edit</Button>
            {isPreLaunch && (
                <Button size="sm" className="gap-1.5" onClick={() => launch.mutate(c.id)} disabled={launch.isPending}>
                  <Rocket className="h-4 w-4" /> {launch.isPending ? "Launching..." : "Launch"}
                </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={(details.status || "draft").charAt(0).toUpperCase() + (details.status || "draft").slice(1) as any} />
          <ChannelBadge channel={(details.channel || "email").charAt(0).toUpperCase() + (details.channel || "email").slice(1) as any} />
          <span className="text-xs text-muted-foreground">Audience: {formatNum(details.audience_size)} customers</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Message preview</CardTitle>
              <CardDescription>How customers will see this on {details.channel}.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-md rounded-2xl border bg-muted/30 p-4">
                <div className="rounded-xl bg-background p-4 shadow-sm">
                  <p className="text-sm font-medium">Acme Coffee</p>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                    {details.message}
                  </p>
                  <Button size="sm" className="mt-3 w-full">Reorder now</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audience summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Total recipients" value={formatNum(details.audience_size)} />
              <Row label="Channel" value={<ChannelBadge channel={(details.channel || "email").charAt(0).toUpperCase() + (details.channel || "email").slice(1) as any} />} />
              <Row label="Segment" value={details.segment_name} />
              <Row label="Goal" value={details.goal} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Delivery statistics</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Stat label="Sent" value={formatNum(funnel[0].value)} />
              <Stat label="Delivered" value={formatNum(funnel[1].value)} />
              <Stat label="Opened" value={formatNum(funnel[2].value)} />
              <Stat label="Clicked" value={formatNum(funnel[3].value)} />
              <Stat label="Converted" value={formatNum(funnel[4].value)} accent />
              <Stat label="Conversion %" value={`${conversionRate}%`} accent />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Conversion funnel</CardTitle>
              <CardDescription>Drop-off across each stage of the journey.</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="stage" type="category" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(217 91% 60%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {details.expected_outcome && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>AI Predicted Outcome</CardTitle>
                <CardDescription>Generated before campaign launch.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Stat label="Est. Reach" value={formatNum(details.expected_outcome?.estimated_reach ?? 0)} />
                <Stat label="Expected Engagement" value={`${details.expected_outcome?.expected_engagement_rate ?? 0}%`} />
                <Stat label="Expected Conversion" value={`${details.expected_outcome?.expected_conversion_rate ?? 0}%`} />
                <Stat label="Expected Revenue" value={formatINR(details.expected_outcome?.expected_revenue ?? 0)} accent />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Actual Performance</CardTitle>
                <CardDescription>Live revenue attribution.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col justify-center h-full pb-8">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Live Revenue Influenced</p>
                  <p className="text-3xl font-bold tabular-nums text-primary">{formatINR((funnel[4]?.value ?? 0) * 4500)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Estimated based on conversions * average order value.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the campaign "{details.name}" and all of its communications data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => {
                  deleteCampaign.mutate(campaignId, {
                    onSuccess: () => {
                      setShowDeleteDialog(false);
                      navigate({ to: "/campaigns" });
                    },
                  });
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-primary/30 bg-primary/5" : ""}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
