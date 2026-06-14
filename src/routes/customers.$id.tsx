import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, MapPin, Sparkles } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { formatINR } from "@/lib/mock-data";

import { useCustomer, useCustomerOrders, useCustomerCommunications } from "@/hooks/use-api";

export const Route = createFileRoute("/customers/$id")({
  component: CustomerDetail,
});

function CustomerDetail() {
  const params = Route.useParams();
  const customerId = Number(params.id);
  
  const { data: c, isLoading, isError, error } = useCustomer(customerId);
  const { data: orders } = useCustomerOrders(customerId);
  const { data: communications } = useCustomerCommunications(customerId);
  
  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading...</div>;
  if (isError || !c) return (
    <div className="p-10 text-center">
      <p className="text-sm text-muted-foreground">{(error as Error)?.message || "Customer not found."}</p>
      <Button asChild variant="link"><Link to="/customers">Back to customers</Link></Button>
    </div>
  );
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
                <Stat label="Total Spend" value={c.clv !== undefined && c.clv !== null ? formatINR(Number(c.clv)) : "—"} />
                <Stat label="Total Orders" value={c.rfm_frequency !== undefined ? c.rfm_frequency : "—"} />
                <Stat label="Channel" value={<ChannelBadge channel={(c.preferred_channel || "email").charAt(0).toUpperCase() + (c.preferred_channel || "email").slice(1) as any} />} />
                <Stat label="RFM Score" value={`${c.rfm_score || 0}/5`} />
                <Stat label="Health Score" value={c.health_score_label ? `${c.health_score_label} (${c.health_score})` : "N/A"} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">RFM Score</span>
                  <span className="font-medium">{c.rfm_score || 0}/5</span>
                </div>
                <Progress value={(c.rfm_score || 0) * 20} />
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                <Badge tone="ai">AI</Badge>
                <p className="mt-1.5 text-muted-foreground">
                  This customer has a <span className="font-medium text-foreground">{c.churn_risk || "medium"}</span> churn risk based on recent activity.
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
                  {orders?.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">No recent orders.</p>
                  ) : (
                    orders?.slice(0, 10).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-medium">{p.category || "Order"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.order_date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums">{formatINR(Number(p.amount))}</p>
                      </div>
                    ))
                  )}
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
                  {communications?.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">No campaigns received yet.</p>
                  ) : (
                    communications?.map((cmp: any) => (
                      <div key={cmp.id} className="flex items-center justify-between py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{cmp.campaign_name || "Campaign"}</p>
                          <ChannelBadge channel={"Email" as any} /> {/* We don't have campaign channel on communication in API yet, mock it visually or use communication.channel if added */}
                        </div>
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 capitalize">{cmp.status}</span>
                      </div>
                    ))
                  )}
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
