import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Rocket, Pencil } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChannelBadge, StatusBadge } from "@/components/status-badge";
import { campaigns, formatNum } from "@/lib/mock-data";

export const Route = createFileRoute("/campaigns/$id")({
  loader: ({ params }) => {
    const c = campaigns.find((x) => x.id === params.id);
    if (!c) throw notFound();
    return c;
  },
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p className="text-sm text-muted-foreground">Campaign not found.</p>
      <Button asChild variant="link"><Link to="/campaigns">Back to campaigns</Link></Button>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="p-10 text-center">
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset} variant="outline" className="mt-2">Try again</Button>
    </div>
  ),
  component: CampaignDetail,
});

function CampaignDetail() {
  const c = Route.useLoaderData();

  const funnel = [
    { stage: "Sent", value: c.audience },
    { stage: "Delivered", value: Math.floor(c.audience * 0.96) },
    { stage: "Opened", value: Math.floor(c.audience * 0.58) },
    { stage: "Clicked", value: Math.floor(c.audience * 0.24) },
    { stage: "Converted", value: Math.floor(c.audience * (c.perf / 100 || 0.08)) },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        title={c.name}
        description={`${c.channel} campaign · created ${c.created}`}
        actions={
          <>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/campaigns"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5"><Pencil className="h-4 w-4" /> Edit</Button>
            <Button size="sm" className="gap-1.5"><Rocket className="h-4 w-4" /> Relaunch</Button>
          </>
        }
      />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={c.status} />
          <ChannelBadge channel={c.channel} />
          <span className="text-xs text-muted-foreground">Audience: {formatNum(c.audience)} customers</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Message preview</CardTitle>
              <CardDescription>How customers will see this on {c.channel}.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-md rounded-2xl border bg-muted/30 p-4">
                <div className="rounded-xl bg-background p-4 shadow-sm">
                  <p className="text-sm font-medium">Acme Coffee</p>
                  <p className="mt-2 text-sm leading-relaxed">
                    Hi Aarav, we miss you ☕ Here's 15% off your favourite Ethiopian Yirgacheffe — just for you,
                    valid until Sunday.
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
              <Row label="Total recipients" value={formatNum(c.audience)} />
              <Row label="Channel" value={<ChannelBadge channel={c.channel} />} />
              <Row label="Segment" value="Dormant Premium Buyers" />
              <Row label="Tags" value="loyalty, win-back" />
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
              <Stat label="Conversion %" value={`${c.perf || 8.2}%`} accent />
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
