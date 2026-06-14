import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Users2, Filter, Wand2, Loader2, AlertCircle, ShieldAlert, Trophy, Cpu, Flower2, ShoppingBag, ArrowRight, Zap } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCustomers } from "@/hooks/use-api";
import { useAudienceBuilder } from "@/hooks/use-api";
import { ChannelBadge } from "@/components/status-badge";
import { formatNum, formatINR } from "@/lib/mock-data";
import type { AudienceBuilderResponse } from "@/lib/api/types";

const PREBUILT_SEGMENTS = [
  {
    name: "Churn Risk",
    description: "Customers inactive for 180+ days. Re-engage before they're gone for good.",
    icon: <ShieldAlert className="h-5 w-5" />,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    prompt: "Win back customers who haven't ordered in 6 months",
  },
  {
    name: "High Value",
    description: "Top-tier buyers with RFM score ≥ 4 or CLV in the 75th percentile.",
    icon: <Trophy className="h-5 w-5" />,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    prompt: "Target our highest-value VIP customers with an exclusive offer",
  },
  {
    name: "Electronics Buyers",
    description: "Customers who have purchased electronics. Ideal for tech product launches.",
    icon: <Cpu className="h-5 w-5" />,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    prompt: "Re-engage electronics buyers with a new product launch",
  },
  {
    name: "Beauty Buyers",
    description: "Skincare, cosmetics and fashion accessory buyers. Perfect for beauty launches.",
    icon: <Flower2 className="h-5 w-5" />,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    prompt: "Launch a beauty campaign for skincare and cosmetics buyers",
  },
  {
    name: "Frequent Shoppers",
    description: "Customers with 5+ orders. Ideal for loyalty rewards and VIP-tier programs.",
    icon: <ShoppingBag className="h-5 w-5" />,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    prompt: "Reward our most frequent shoppers with a loyalty bonus",
  },
];

export const Route = createFileRoute("/audiences")({
  head: () => ({
    meta: [
      { title: "Audience Builder — Campaign Copilot" },
      { name: "description", content: "Build audiences with natural language or advanced filters." },
    ],
  }),
  component: AudienceBuilder,
});

function AudienceBuilder() {
  const [nl, setNl] = useState("Customers who spent more than ₹5000 and haven't purchased in 90 days");
  const audienceBuilder = useAudienceBuilder();

  // Load a sample of real customers for the preview
  const { data: customersData, isLoading: loadingCustomers } = useCustomers({ page: 1 });
  const previewCustomers = customersData?.slice(0, 6) ?? [];

  const result: AudienceBuilderResponse | null = audienceBuilder.data ?? null;

  const handleGenerate = () => {
    if (!nl.trim()) return;
    audienceBuilder.mutate({ input: nl });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar title="Audience Builder" description="Define a segment in plain English or with precise filters." />
      <main className="flex-1 space-y-6 p-4 md:p-6">

        {/* Prebuilt Segments Panel */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Prebuilt Segments</h2>
            <Badge variant="secondary" className="text-[10px]">Olist Dataset</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PREBUILT_SEGMENTS.map((seg) => (
              <Card
                key={seg.name}
                className={`border ${seg.border} transition hover:shadow-md`}
              >
                <CardContent className="p-4">
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${seg.bg} ${seg.color}`}>
                    {seg.icon}
                  </div>
                  <p className="text-sm font-medium leading-tight">{seg.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">{seg.description}</p>
                  <Link
                    to="/copilot"
                    search={{ q: seg.prompt } as never}
                    className={`mt-3 flex w-full items-center justify-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${seg.bg} ${seg.color} hover:opacity-80`}
                  >
                    Launch Campaign <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Tabs defaultValue="nl" className="space-y-4">
          <TabsList>
            <TabsTrigger value="nl" className="gap-1.5"><Wand2 className="h-3.5 w-3.5" /> Natural Language</TabsTrigger>
            <TabsTrigger value="adv" className="gap-1.5"><Filter className="h-3.5 w-3.5" /> Advanced Filters</TabsTrigger>
          </TabsList>

          <TabsContent value="nl" className="space-y-4">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Describe your audience</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={nl}
                  onChange={(e) => setNl(e.target.value)}
                  className="min-h-[80px]"
                  placeholder="e.g. Customers who spent more than ₹5000 and haven't purchased in 90 days"
                />
                {audienceBuilder.isError && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {(audienceBuilder.error as Error)?.message}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    onClick={handleGenerate}
                    disabled={!nl.trim() || audienceBuilder.isPending}
                    className="gap-1.5"
                  >
                    {audienceBuilder.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {audienceBuilder.isPending ? "Building audience…" : "Generate audience"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adv" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Filters</CardTitle>
                <CardDescription>Combine criteria to define your segment precisely.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Total Spend (₹)</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Min" defaultValue="5000" />
                    <Input placeholder="Max" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Last Purchase Date</Label>
                  <Select defaultValue="90">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">More than 30 days ago</SelectItem>
                      <SelectItem value="60">More than 60 days ago</SelectItem>
                      <SelectItem value="90">More than 90 days ago</SelectItem>
                      <SelectItem value="180">More than 180 days ago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Order Count</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Min" defaultValue="2" />
                    <Input placeholder="Max" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Any city" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mumbai">Mumbai</SelectItem>
                      <SelectItem value="bangalore">Bangalore</SelectItem>
                      <SelectItem value="delhi">Delhi</SelectItem>
                      <SelectItem value="chennai">Chennai</SelectItem>
                      <SelectItem value="pune">Pune</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred Channel</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Any channel" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="push">Push</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end justify-end">
                  <Button>Apply filters</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Results */}
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Audience Preview</CardTitle>
                  <CardDescription>
                    {result
                      ? `${formatNum(result.audience_size)} customers match your criteria.`
                      : "Sample of your customer base."}
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" disabled={!result}>Save audience</Button>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Member Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCustomers ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : previewCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No customers found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    previewCustomers.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                        </TableCell>
                        <TableCell>{c.city || "—"}</TableCell>
                        <TableCell>
                          <ChannelBadge channel={(c.preferred_channel || "email").charAt(0).toUpperCase() + (c.preferred_channel || "email").slice(1) as "Email" | "WhatsApp" | "SMS" | "Push"} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short" })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Audience size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <Users2 className="h-5 w-5 text-primary" />
                  {audienceBuilder.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <p className="text-3xl font-semibold tabular-nums">
                      {result ? formatNum(result.audience_size) : customersData ? formatNum(customersData.length) : "—"}
                    </p>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {result ? "match your criteria" : "total customers"}
                </p>
              </CardContent>
            </Card>

            {result && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Audience insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Insight label="Avg. lifetime value" value={`₹${formatNum(result.avg_spend)}`} />
                  {result.top_city && <Insight label="Top city" value={result.top_city} />}
                  {result.filters.min_total_spend && (
                    <Insight label="Min spend filter" value={`₹${formatNum(result.filters.min_total_spend)}`} />
                  )}
                  {result.filters.inactive_days && (
                    <Insight label="Inactive" value={`${result.filters.inactive_days}+ days`} />
                  )}
                  {result.filters.preferred_channels?.length && (
                    <Insight
                      label="Channel"
                      value={<ChannelBadge channel={result.filters.preferred_channels[0].charAt(0).toUpperCase() + result.filters.preferred_channels[0].slice(1) as "Email" | "WhatsApp" | "SMS" | "Push"} />}
                    />
                  )}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                    <Badge variant="default" className="mb-1.5">AI insight</Badge>
                    <p className="text-muted-foreground">
                      This segment was built from your natural language query using the AI Audience Builder.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
