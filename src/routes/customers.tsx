import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Download, Loader2, AlertCircle } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChannelBadge } from "@/components/status-badge";
import { formatINR } from "@/lib/mock-data";
import { useCustomers } from "@/hooks/use-api";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Campaign Copilot" },
      { name: "description", content: "Browse your customer base, spend, and engagement." },
    ],
  }),
  component: Customers,
});

function Customers() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error } = useCustomers({ search: search || undefined });

  const customers = data?.results ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        title="Customers"
        description="Every customer, their spend and engagement."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-4 w-4" /> Export</Button>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add customer</Button>
          </>
        }
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex justify-end">
          <Input
            placeholder="Search by name, email or city…"
            className="max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {(error as Error)?.message ?? "Failed to load customers."}
          </div>
        )}

        <Card>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead className="text-right">Total Spend</TableHead>
                    <TableHead>Preferred Channel</TableHead>
                    <TableHead>Member Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        {search ? "No customers match your search." : "No customers yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    customers.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link to="/customers/$id" params={{ id: String(c.id) }} className="font-medium hover:underline">
                            {c.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.email}</TableCell>
                        <TableCell>{c.city || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {/* Spend not directly on customer; show "—" until order aggregate is added */}
                          —
                        </TableCell>
                        <TableCell><ChannelBadge channel={c.preferred_channel as "Email" | "WhatsApp" | "SMS" | "Push"} /></TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
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
            {data.count} customer{data.count !== 1 ? "s" : ""}
            {data.next && " — scroll to load more"}
          </p>
        )}
      </main>
    </div>
  );
}
