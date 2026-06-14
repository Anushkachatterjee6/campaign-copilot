import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Send, Users2, MessageSquare, Rocket, ArrowUp, TrendingUp, AlertCircle, Loader2, ShieldAlert, Trophy, Cpu, Flower2, ShoppingBag, Zap } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChannelBadge } from "@/components/status-badge";
import { samplePrompts, formatNum, formatINR } from "@/lib/mock-data";
import { useCampaignCopilot, useLaunchCampaign } from "@/hooks/use-api";
import type { CampaignCopilotResponse } from "@/lib/api/types";

export const Route = createFileRoute("/copilot")({
  head: () => ({
    meta: [
      { title: "AI Copilot — Campaign Copilot" },
      { name: "description", content: "Chat with the AI Copilot to generate campaigns end-to-end." },
    ],
  }),
  component: Copilot,
});

const SEGMENT_PROMPTS: { icon: React.ReactNode; label: string; prompt: string }[] = [
  {
    icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />,
    label: "Churn Risk",
    prompt: "Win back customers who haven't ordered in 6 months",
  },
  {
    icon: <Trophy className="h-3.5 w-3.5 text-amber-500" />,
    label: "High Value",
    prompt: "Target our highest-value VIP customers with an exclusive offer",
  },
  {
    icon: <Cpu className="h-3.5 w-3.5 text-blue-500" />,
    label: "Electronics Buyers",
    prompt: "Re-engage electronics buyers with a new product launch",
  },
  {
    icon: <Flower2 className="h-3.5 w-3.5 text-pink-500" />,
    label: "Beauty Buyers",
    prompt: "Launch a beauty campaign for skincare and cosmetics buyers",
  },
  {
    icon: <ShoppingBag className="h-3.5 w-3.5 text-violet-500" />,
    label: "Frequent Shoppers",
    prompt: "Reward our most frequent shoppers with a loyalty bonus",
  },
];

function Copilot() {
  const [input, setInput] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);
  const copilot = useCampaignCopilot();
  const launch = useLaunchCampaign();
  const navigate = useNavigate();

  const ask = (q: string) => {
    if (!q.trim()) return;
    setSubmittedPrompt(q);
    setInput("");
    copilot.mutate({ input: q });
  };

  const result: CampaignCopilotResponse | null = copilot.data ?? null;
  const thinking = copilot.isPending;
  const hasResult = !!result;

  const channelDisplay = result?.recommended_channel
    ? (result.recommended_channel.charAt(0).toUpperCase() + result.recommended_channel.slice(1)) as "Email" | "WhatsApp" | "SMS" | "Push"
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        title="AI Campaign Copilot"
        description="Describe the campaign you want. Copilot picks the audience, channel and message."
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_320px]">
          {/* Conversation */}
          <div className="flex flex-col gap-4">
            {!hasResult && !thinking && !copilot.isError && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold">What campaign should we launch today?</h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Ask in plain English. I'll find the audience, pick the right channel and draft the message.
                  </p>
                  <div className="mt-2 grid w-full max-w-xl gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {SEGMENT_PROMPTS.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => ask(s.prompt)}
                        className="rounded-lg border bg-card p-3 text-left text-sm text-foreground transition hover:border-primary/40 hover:bg-accent"
                      >
                        <div className="mb-1.5 flex items-center gap-1.5">
                          {s.icon}
                          <span className="text-[11px] font-medium text-muted-foreground">{s.label}</span>
                        </div>
                        {s.prompt}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {(thinking || hasResult || copilot.isError) && (
              <div className="space-y-4">
                {/* user bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {submittedPrompt}
                  </div>
                </div>

                {thinking && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Copilot is thinking…
                  </div>
                )}

                {copilot.isError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Copilot encountered an error</p>
                      <p className="text-xs mt-1 opacity-80">{(copilot.error as Error)?.message}</p>
                    </div>
                  </div>
                )}

                {result && (
                  <>
                    {/* Reasoning */}
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm">Reasoning</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed text-muted-foreground">{result.reasoning}</p>
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Audience */}
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Users2 className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm">Selected audience</CardTitle>
                            {result.audience_summary.prebuilt_segment && (
                              <Badge variant="secondary" className="ml-auto text-[10px]">
                                <Zap className="mr-1 h-2.5 w-2.5" />
                                {result.audience_summary.prebuilt_segment}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-baseline justify-between">
                            <p className="text-sm font-medium">{result.audience_summary.name}</p>
                            <p className="text-lg font-semibold tabular-nums">{formatNum(result.audience_summary.audience_size)}</p>
                          </div>
                          <ul className="space-y-1">
                            {result.audience_summary.top_city && (
                              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                Top city: {result.audience_summary.top_city}
                              </li>
                            )}
                            <li className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                              Avg spend: {formatINR(result.audience_summary.avg_spend)}
                            </li>
                            <li className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                              Avg orders: {result.audience_summary.avg_orders}
                            </li>
                            {result.audience_summary.avg_clv_inr != null && result.audience_summary.avg_clv_inr > 0 && (
                              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                                Avg CLV: {formatINR(result.audience_summary.avg_clv_inr)}
                              </li>
                            )}
                            {result.audience_summary.avg_rfm_score != null && result.audience_summary.avg_rfm_score > 0 && (
                              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-violet-500" />
                                RFM score: {result.audience_summary.avg_rfm_score}/5
                              </li>
                            )}
                            {result.audience_summary.churn_risk_pct != null && result.audience_summary.churn_risk_pct > 0 && (
                              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-rose-500" />
                                Churn risk: {result.audience_summary.churn_risk_pct}% high-risk
                              </li>
                            )}
                          </ul>
                        </CardContent>
                      </Card>

                      {/* Channel */}
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Send className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm">Recommended channel</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {channelDisplay && <ChannelBadge channel={channelDisplay} />}
                          <p className="text-xs text-muted-foreground">
                            {result.expected_outcome.summary}
                          </p>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="rounded-md bg-muted/50 p-2">
                              <p className="text-[10px] text-muted-foreground">Est. Engagement</p>
                              <p className="font-semibold text-sm">{(result.expected_outcome.expected_engagement_rate * 100).toFixed(1)}%</p>
                            </div>
                            <div className="rounded-md bg-muted/50 p-2">
                              <p className="text-[10px] text-muted-foreground">Est. Conversion</p>
                              <p className="font-semibold text-sm">{(result.expected_outcome.expected_conversion_rate * 100).toFixed(1)}%</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Expected outcome */}
                    <Card className="border-emerald-500/20 bg-emerald-50/5">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                          <CardTitle className="text-sm">Expected outcome</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Reach</p>
                          <p className="font-semibold tabular-nums">{formatNum(result.expected_outcome.estimated_reach)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Revenue</p>
                          <p className="font-semibold tabular-nums text-emerald-600">{formatINR(result.expected_outcome.expected_revenue)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Conversion</p>
                          <p className="font-semibold tabular-nums">{(result.expected_outcome.expected_conversion_rate * 100).toFixed(1)}%</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Generated message */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Generated message</CardTitle>
                        <CardDescription>Personalization tokens highlighted.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 font-sans text-sm leading-relaxed">
                          {result.generated_message}
                        </pre>
                        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/campaigns/$id" params={{ id: String(result.campaign_id) }}>
                              Edit message
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={launch.isPending}
                            onClick={() => {
                              launch.mutate(result.campaign_id, {
                                onSuccess: () => {
                                  toast.success("Campaign launched!", {
                                    description: `${formatNum(result.audience_summary.audience_size)} customers will receive this on ${channelDisplay}.`,
                                  });
                                  navigate({ to: "/campaigns" });
                                },
                              });
                            }}
                          >
                            {launch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} 
                            {launch.isPending ? "Launching..." : "Launch campaign"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* Composer */}
            <div className="sticky bottom-4 mt-4">
              <div className="relative rounded-2xl border bg-card p-2 shadow-lg">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask(input);
                    }
                  }}
                  placeholder="Ask Copilot to build a campaign…"
                  className="min-h-[60px] resize-none border-0 bg-transparent pr-12 shadow-none focus-visible:ring-0"
                />
                <Button
                  size="icon"
                  className="absolute bottom-3 right-3 h-8 w-8 rounded-lg"
                  onClick={() => ask(input)}
                  disabled={!input.trim() || thinking}
                >
                  {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Right rail */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Prebuilt segments</CardTitle>
                <CardDescription className="text-xs">Click to instantly launch a campaign</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {SEGMENT_PROMPTS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => ask(s.prompt)}
                    disabled={thinking}
                    className="flex w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                  >
                    {s.icon}
                    <span className="flex-1">{s.label}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Copilot can</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">1</Badge> Segment customers from natural language</li>
                  <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">2</Badge> Pick the highest-ROI channel</li>
                  <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">3</Badge> Draft a personalized message</li>
                  <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">4</Badge> Forecast reach, engagement & revenue</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
