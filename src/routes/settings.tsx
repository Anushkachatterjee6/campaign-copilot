import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Key, MessageSquare, Palette } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Campaign Copilot" },
      { name: "description", content: "API keys, channel and brand configuration." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const [show, setShow] = useState(false);
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar title="Settings" description="Configure integrations, channels and brand." />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary"><Key className="h-4 w-4" /></div>
              <CardTitle>OpenAI API Key</CardTitle>
            </div>
            <CardDescription>Used by the AI Copilot to generate campaigns and segment audiences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="apikey">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="apikey"
                  type={show ? "text" : "password"}
                  defaultValue="sk-proj-************************************"
                  className="pr-10 font-mono text-sm"
                />
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2" onClick={() => setShow((s) => !s)}>
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <Button onClick={() => toast.success("API key saved")}>Save</Button>
            </div>
            <p className="text-xs text-muted-foreground">Your key is stored encrypted and never exposed to the client.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary"><MessageSquare className="h-4 w-4" /></div>
              <CardTitle>Channel Configuration</CardTitle>
            </div>
            <CardDescription>Enable the channels Copilot can use to deliver campaigns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChannelRow name="Email" desc="SMTP / SendGrid" defaultEnabled />
            <ChannelRow name="WhatsApp" desc="Meta Cloud API" defaultEnabled />
            <ChannelRow name="SMS" desc="Twilio / Gupshup" defaultEnabled />
            <ChannelRow name="Push" desc="Firebase Cloud Messaging" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary"><Palette className="h-4 w-4" /></div>
              <CardTitle>Brand Configuration</CardTitle>
            </div>
            <CardDescription>Copilot uses these to keep generated messages on-brand.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Brand Name</Label>
              <Input defaultValue="Acme Coffee Co." />
            </div>
            <div className="space-y-1.5">
              <Label>Sender Name</Label>
              <Input defaultValue="Priya at Acme" />
            </div>
            <div className="space-y-1.5">
              <Label>Brand voice</Label>
              <Input defaultValue="Warm, witty, expert" />
            </div>
            <div className="space-y-1.5">
              <Label>Primary color</Label>
              <div className="flex gap-2">
                <Input type="color" defaultValue="#3b82f6" className="h-9 w-14 p-1" />
                <Input defaultValue="#3b82f6" className="font-mono text-sm" />
              </div>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Default disclaimer</Label>
              <Textarea defaultValue="To stop receiving these messages, reply STOP." className="min-h-[70px]" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={() => toast.success("Brand settings saved")}>Save changes</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ChannelRow({ name, desc, defaultEnabled }: { name: string; desc: string; defaultEnabled?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm">Configure</Button>
        <Switch defaultChecked={defaultEnabled} />
      </div>
    </div>
  );
}
