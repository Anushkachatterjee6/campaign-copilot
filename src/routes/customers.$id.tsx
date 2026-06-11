import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Mail, MapPin, Sparkles } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { customers, formatINR } from "@/lib/mock-data";

export const Route = createFileRoute("/customers/$id")({
  loader: ({ params }) => {
    const c = customers.find((x) => x.id === params.id);
    if (!c) throw notFound();
    return c;
  },
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p className="text-sm text-muted-foreground">Customer not found.</p>
      <Button asChild variant="link"><Link to="/customers">Back to customers</Link></Button>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="p-10 text-center">
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset} variant="outline" className="mt-2">Try again</Button>
    </div>
  ),
  component: CustomerDetail,
});

const purchases = [
  { date: "2025-06-07", item: "Ethiopian Yirgacheffe 500g", amount: 1240 },
  { date: "2025-05-12", item: "Cold Brew Bundle", amount: 1890 },
  { date: "2025-04-21", item: "Espresso Subscription · April", amount: 999 },
  { date: "2025-03-18", item: "Premium Grinder", amount: 8499 },
];

const campaignsSent = [
  { name: "Diwali Premium Coffee Push", channel: "WhatsApp", status: "Opened" },
  { name: "Subscription renewal nudge", channel: "Push", status: "Clicked" },
  { name: "Monsoon Brew Bundle", channel: "Email", status: "Converted" },
];

function CustomerDetail() {
  const c = Route.useLoaderData();
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        title={c.name}
        description="Customer profile and engagement history."
        actions={
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/customers"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
        }
      />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-lg font-semibold text-primary-foreground">
                  {c.name.split(" ").map((n: string) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.city}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Total Spend" value={formatINR(c.spend)} />
                <Stat label="Last Purchase" value={c.lastPurchase} />
                <Stat label="Channel" value={<ChannelBadge channel={c.channel} />} />
                <Stat label="Engagement" value={`${c.score}/100`} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Engagement score</span>
                  <span className="font-medium">{c.score}/100</span>
                </div>
                <Progress value={c.score} />
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                <Badge tone="ai">AI</Badge>
                <p className="mt-1.5 text-muted-foreground">
                  This customer is <span className="font-medium text-foreground">3.4× more likely</span> to respond on {c.channel}.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Purchase history</CardTitle>
                <CardDescription>Recent orders from this customer.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {purchases.map((p) => (
                    <div key={p.date} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium">{p.item}</p>
                        <p className="text-xs text-muted-foreground">{p.date}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">{formatINR(p.amount)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campaign history</CardTitle>
                <CardDescription>Campaigns this customer has received.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {campaignsSent.map((cmp) => (
                    <div key={cmp.name} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium">{cmp.name}</p>
                        <ChannelBadge channel={cmp.channel} />
                      </div>
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{cmp.status}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function Badge({ tone, children }: { tone: "ai"; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      <Sparkles className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}
