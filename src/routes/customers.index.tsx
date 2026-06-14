import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Plus, Download, Loader2, AlertCircle, Upload, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChannelBadge } from "@/components/status-badge";
import { formatINR } from "@/lib/mock-data";
import { useCustomers, useCreateCustomer } from "@/hooks/use-api";
import type { Channel, Customer } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------
export const Route = createFileRoute("/customers/")({
  head: () => ({
    meta: [
      { title: "Customers — Campaign Copilot" },
      { name: "description", content: "Browse your customer base, spend, and engagement." },
    ],
  }),
  component: Customers,
});

// ---------------------------------------------------------------------------
// Health filter definitions
// ---------------------------------------------------------------------------
type HealthFilter = "all" | "Healthy" | "At Risk" | "High Churn Risk";

function healthLabel(score: number): "Healthy" | "At Risk" | "High Churn Risk" {
  if (score >= 80) return "Healthy";
  if (score >= 50) return "At Risk";
  return "High Churn Risk";
}

function channelLabel(channel: string | null | undefined) {
  const raw = channel || "email";
  return (raw.charAt(0).toUpperCase() + raw.slice(1)) as "Email" | "WhatsApp" | "SMS" | "Push";
}

function toChannel(channel: string): Channel {
  return ["email", "whatsapp", "sms", "push"].includes(channel) ? (channel as Channel) : "email";
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------
function toCSV(rows: Customer[]): string {
  const header = [
    "name",
    "email",
    "phone",
    "city",
    "state",
    "preferred_channel",
    "clv",
    "health_score",
    "health_label",
    "created_at",
  ];
  const lines = rows.map((c) =>
    [
      c.name,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.preferred_channel,
      c.clv,
      c.health_score ?? "",
      c.health_score_label ?? "",
      c.created_at,
    ]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

// ---------------------------------------------------------------------------
// CSV import parser
// ---------------------------------------------------------------------------
interface CsvRow {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  preferred_channel: string;
}
interface ParsedRow {
  row: CsvRow;
  errors: string[];
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    const parsed: CsvRow = {
      name: row["name"] || "",
      email: row["email"] || "",
      phone: row["phone"] || "",
      city: row["city"] || "",
      state: row["state"] || "",
      preferred_channel: row["preferred_channel"] || "email",
    };
    const errors: string[] = [];
    if (!parsed.name) errors.push("Name is required");
    if (!parsed.email) errors.push("Email is required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.email)) errors.push("Invalid email");
    return { row: parsed, errors };
  });
}

// ---------------------------------------------------------------------------
// Add Customer Modal
// ---------------------------------------------------------------------------
interface AddCustomerModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function AddCustomerModal({ open, onOpenChange }: AddCustomerModalProps) {
  const [tab, setTab] = useState<"single" | "csv">("single");
  const createCustomer = useCreateCustomer();
  const fileRef = useRef<HTMLInputElement>(null);

  // Single form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    preferred_channel: "email",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // CSV import state
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<{ ok: number; skipped: number } | null>(null);

  function resetAll() {
    setForm({ name: "", email: "", phone: "", city: "", state: "", preferred_channel: "email" });
    setFormErrors({});
    setCsvRows([]);
    setImportDone(null);
    setTab("single");
  }

  function handleClose(v: boolean) {
    if (!v) resetAll();
    onOpenChange(v);
  }

  // Single submit
  async function handleSubmit() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email";
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      return;
    }

    try {
      await createCustomer.mutateAsync({
        name: form.name,
        email: form.email,
        phone: form.phone,
        city: form.city,
        state: form.state,
        preferred_channel: toChannel(form.preferred_channel),
        clv: "0",
        rfm_score: 0,
        rfm_recency: 0,
        rfm_frequency: 0,
        rfm_monetary: "0",
        churn_risk: "low",
        health_score: 0,
        health_score_label: "Healthy",
      });
      toast.success("Customer created successfully.");
      handleClose(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create customer.");
    }
  }

  // CSV file select
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvRows(parseCSV(text));
      setImportDone(null);
    };
    reader.readAsText(file);
  }

  // CSV bulk import
  async function handleBulkImport() {
    const valid = csvRows.filter((r) => r.errors.length === 0);
    const skipped = csvRows.filter((r) => r.errors.length > 0).length;
    setImporting(true);
    let ok = 0;
    for (const { row } of valid) {
      try {
        await createCustomer.mutateAsync({
          name: row.name,
          email: row.email,
          phone: row.phone,
          city: row.city,
          state: row.state,
          preferred_channel: toChannel(row.preferred_channel),
          clv: "0",
          rfm_score: 0,
          rfm_recency: 0,
          rfm_frequency: 0,
          rfm_monetary: "0",
          churn_risk: "low",
          health_score: 0,
          health_score_label: "Healthy",
        });
        ok++;
      } catch {
        /* skip duplicates or server errors */
      }
    }
    setImporting(false);
    setImportDone({ ok, skipped: skipped + (valid.length - ok) });
    toast.success(`Imported ${ok} customers${skipped > 0 ? `, skipped ${skipped}` : ""}.`);
  }

  const validCount = csvRows.filter((r) => r.errors.length === 0).length;
  const invalidCount = csvRows.filter((r) => r.errors.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "single" | "csv")}>
          <TabsList className="mb-4">
            <TabsTrigger value="single">Add Single Customer</TabsTrigger>
            <TabsTrigger value="csv">Upload CSV</TabsTrigger>
          </TabsList>

          {/* ── Single Customer Form ── */}
          {tab === "single" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="c-name"
                    placeholder="Aarav Shah"
                    value={form.name}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, name: e.target.value }));
                      setFormErrors((x) => ({ ...x, name: "" }));
                    }}
                  />
                  {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="c-email"
                    placeholder="aarav@example.com"
                    type="email"
                    value={form.email}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, email: e.target.value }));
                      setFormErrors((x) => ({ ...x, email: "" }));
                    }}
                  />
                  {formErrors.email && (
                    <p className="text-xs text-destructive">{formErrors.email}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-phone">Phone</Label>
                  <Input
                    id="c-phone"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-city">City</Label>
                  <Input
                    id="c-city"
                    placeholder="Mumbai"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-state">State</Label>
                  <Input
                    id="c-state"
                    placeholder="Maharashtra"
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred Channel</Label>
                  <Select
                    value={form.preferred_channel}
                    onValueChange={(v) => setForm((f) => ({ ...f, preferred_channel: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="push">Push</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={createCustomer.isPending}>
                  {createCustomer.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Create Customer
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ── CSV Upload ── */}
          {tab === "csv" && (
            <div className="space-y-4">
              {importDone ? (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                  <p className="font-semibold">Import complete</p>
                  <p className="text-sm text-muted-foreground">
                    Imported: <strong>{importDone.ok}</strong> &nbsp;·&nbsp; Skipped:{" "}
                    <strong>{importDone.skipped}</strong>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCsvRows([]);
                      setImportDone(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    Import another file
                  </Button>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border-2 border-dashed border-border p-6 text-center space-y-2">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Expected columns:{" "}
                      <code className="text-xs bg-muted px-1 rounded">
                        name, email, phone, city, state, preferred_channel
                      </code>
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      Choose CSV file
                    </Button>
                  </div>

                  {csvRows.length > 0 && (
                    <>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" /> {validCount} valid
                        </span>
                        {invalidCount > 0 && (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-4 w-4" /> {invalidCount} invalid
                          </span>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto rounded-lg border text-xs">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Status</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>City</TableHead>
                              <TableHead>Channel</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {csvRows.map((r, i) => (
                              <TableRow
                                key={i}
                                className={r.errors.length ? "bg-destructive/5" : ""}
                              >
                                <TableCell>
                                  {r.errors.length === 0 ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                  ) : (
                                    <span title={r.errors.join("; ")}>
                                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className={!r.row.name ? "text-destructive" : ""}>
                                  {r.row.name || "—"}
                                </TableCell>
                                <TableCell
                                  className={
                                    r.errors.some((e) => e.includes("mail"))
                                      ? "text-destructive"
                                      : ""
                                  }
                                >
                                  {r.row.email || "—"}
                                </TableCell>
                                <TableCell>{r.row.city || "—"}</TableCell>
                                <TableCell>{r.row.preferred_channel}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => handleClose(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleBulkImport} disabled={importing || validCount === 0}>
                          {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Import {validCount} customer{validCount !== 1 ? "s" : ""}
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Customers page
// ---------------------------------------------------------------------------
function Customers() {
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, isError, error } = useCustomers({ search: search || undefined });
  const allCustomers = data ?? [];

  // Client-side health filtering
  const filtered =
    healthFilter === "all"
      ? allCustomers
      : allCustomers.filter(
          (c) => (c.health_score_label || healthLabel(c.health_score ?? 0)) === healthFilter,
        );

  // Health counts
  const counts = {
    all: allCustomers.length,
    Healthy: allCustomers.filter(
      (c) => (c.health_score_label || healthLabel(c.health_score ?? 0)) === "Healthy",
    ).length,
    "At Risk": allCustomers.filter(
      (c) => (c.health_score_label || healthLabel(c.health_score ?? 0)) === "At Risk",
    ).length,
    "High Churn Risk": allCustomers.filter(
      (c) => (c.health_score_label || healthLabel(c.health_score ?? 0)) === "High Churn Risk",
    ).length,
  };

  function handleExport() {
    const csv = toCSV(filtered);
    downloadCSV(csv, `customers_${todayStr()}.csv`);
    toast.success(`Exported ${filtered.length} customers.`);
  }

  const HEALTH_FILTERS: { label: string; value: HealthFilter; color: string }[] = [
    { label: "All", value: "all", color: "" },
    { label: "Healthy", value: "Healthy", color: "text-green-700" },
    { label: "At Risk", value: "At Risk", color: "text-yellow-700" },
    { label: "High Churn Risk", value: "High Churn Risk", color: "text-red-700" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        title="Customers"
        description="Every customer, their spend and engagement."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Add customer
            </Button>
          </>
        }
      />

      <main className="flex-1 space-y-4 p-4 md:p-6">
        {/* ── Health stat cards ── */}
        {!isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-border/60">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold tabular-nums">{counts.all.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/20 bg-green-500/5">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-green-700">
                  Healthy
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold tabular-nums text-green-700">
                  {counts.Healthy.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="border-yellow-500/20 bg-yellow-500/5">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-yellow-700">
                  At Risk
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold tabular-nums text-yellow-700">
                  {counts["At Risk"].toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="border-red-500/20 bg-red-500/5">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-red-700">
                  High Churn Risk
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold tabular-nums text-red-700">
                  {counts["High Churn Risk"].toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Toolbar: health filters + search ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {HEALTH_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setHealthFilter(f.value)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  healthFilter === f.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                } ${f.color}`}
              >
                {f.label} ({f.value === "all" ? counts.all : counts[f.value as keyof typeof counts]}
                )
              </button>
            ))}
          </div>
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

        {/* ── Customer table ── */}
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
                    <TableHead>Health</TableHead>
                    <TableHead>Member Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        {search || healthFilter !== "all"
                          ? "No customers match your filters."
                          : "No customers yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
                        <TableCell>
                          <Link
                            to="/customers/$id"
                            params={{ id: String(c.id) }}
                            className="font-medium hover:underline"
                          >
                            {c.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.email}</TableCell>
                        <TableCell>{c.city || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {c.clv !== undefined && c.clv !== null ? formatINR(Number(c.clv)) : "—"}
                        </TableCell>
                        <TableCell>
                          <ChannelBadge channel={channelLabel(c.preferred_channel)} />
                        </TableCell>
                        <TableCell>
                          {c.health_score_label && (
                            <Badge
                              variant={
                                c.health_score_label === "Healthy"
                                  ? "default"
                                  : c.health_score_label === "At Risk"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {c.health_score_label} ({c.health_score})
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("en-IN", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
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
            Showing {filtered.length} of {data.length} customer{data.length !== 1 ? "s" : ""}
          </p>
        )}
      </main>

      <AddCustomerModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
