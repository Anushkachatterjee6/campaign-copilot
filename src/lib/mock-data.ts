// Mock CRM data for Campaign Copilot

export type Channel = "Email" | "WhatsApp" | "SMS" | "Push";
export type CampaignStatus = "Draft" | "Scheduled" | "Active" | "Completed" | "Paused";

export const stats = {
  totalCustomers: 24819,
  totalOrders: 58342,
  activeCampaigns: 12,
  revenueInfluenced: 8420000, // ₹84.2L
};

export const campaignTrend = [
  { date: "Mon", sent: 4200, opened: 2400, converted: 480 },
  { date: "Tue", sent: 5100, opened: 3100, converted: 612 },
  { date: "Wed", sent: 4800, opened: 2950, converted: 520 },
  { date: "Thu", sent: 6300, opened: 4100, converted: 780 },
  { date: "Fri", sent: 7200, opened: 4900, converted: 940 },
  { date: "Sat", sent: 5800, opened: 3800, converted: 720 },
  { date: "Sun", sent: 4900, opened: 3200, converted: 610 },
];

export const channelPerformance = [
  { channel: "Email", engagement: 42, conversion: 8.4 },
  { channel: "WhatsApp", engagement: 71, conversion: 14.2 },
  { channel: "SMS", engagement: 38, conversion: 6.1 },
  { channel: "Push", engagement: 29, conversion: 4.8 },
];

export const customerActivity = [
  { month: "Jan", active: 12400, new: 1800 },
  { month: "Feb", active: 13100, new: 2100 },
  { month: "Mar", active: 14250, new: 2400 },
  { month: "Apr", active: 15600, new: 2800 },
  { month: "May", active: 17200, new: 3100 },
  { month: "Jun", active: 18900, new: 3400 },
  { month: "Jul", active: 20100, new: 3700 },
];

export const aiRecommendations = [
  {
    id: "r1",
    title: "Win back dormant premium buyers",
    detail: "1,284 customers haven't purchased in 60+ days. Estimated lift: +₹4.2L.",
    impact: "High",
  },
  {
    id: "r2",
    title: "Upsell to repeat coffee buyers",
    detail: "Bundle premium beans with grinder accessories for 3,420 customers.",
    impact: "Medium",
  },
  {
    id: "r3",
    title: "Churn risk in Bangalore",
    detail: "452 high-value customers show declining engagement this month.",
    impact: "High",
  },
];

export const recentCampaigns = [
  { id: "c1", name: "Diwali Premium Coffee Push", channel: "WhatsApp" as Channel, status: "Active" as CampaignStatus, perf: 0.184 },
  { id: "c2", name: "Win-back: 60-day inactive", channel: "Email" as Channel, status: "Active" as CampaignStatus, perf: 0.092 },
  { id: "c3", name: "Bangalore VIP Tasting", channel: "SMS" as Channel, status: "Scheduled" as CampaignStatus, perf: 0 },
  { id: "c4", name: "Subscription renewal nudge", channel: "Push" as Channel, status: "Completed" as CampaignStatus, perf: 0.121 },
  { id: "c5", name: "First-order discount", channel: "Email" as Channel, status: "Paused" as CampaignStatus, perf: 0.067 },
];

export const topSegments = [
  { name: "Premium Coffee Loyalists", size: 4280, growth: 12.4 },
  { name: "High-Value Dormant", size: 1284, growth: -8.2 },
  { name: "New Subscribers (30d)", size: 2940, growth: 24.1 },
  { name: "Bangalore Power Users", size: 1820, growth: 6.7 },
];

export const campaigns = [
  { id: "c1", name: "Diwali Premium Coffee Push", audience: 4280, channel: "WhatsApp", status: "Active", created: "2025-06-02", perf: 18.4 },
  { id: "c2", name: "Win-back: 60-day inactive", audience: 1284, channel: "Email", status: "Active", created: "2025-06-01", perf: 9.2 },
  { id: "c3", name: "Bangalore VIP Tasting", audience: 1820, channel: "SMS", status: "Scheduled", created: "2025-06-05", perf: 0 },
  { id: "c4", name: "Subscription renewal nudge", audience: 3120, channel: "Push", status: "Completed", created: "2025-05-21", perf: 12.1 },
  { id: "c5", name: "First-order discount", audience: 8430, channel: "Email", status: "Paused", created: "2025-05-18", perf: 6.7 },
  { id: "c6", name: "Monsoon Brew Bundle", audience: 5210, channel: "WhatsApp", status: "Completed", created: "2025-05-10", perf: 22.8 },
  { id: "c7", name: "Premium Tasting Invite", audience: 940, channel: "Email", status: "Draft", created: "2025-06-08", perf: 0 },
];

export const customers = [
  { id: "u1", name: "Aarav Mehta", email: "aarav.m@gmail.com", city: "Mumbai", spend: 24820, lastPurchase: "2025-05-28", channel: "WhatsApp" as Channel, score: 92 },
  { id: "u2", name: "Diya Sharma", email: "diya.s@outlook.com", city: "Bangalore", spend: 18420, lastPurchase: "2025-06-04", channel: "Email" as Channel, score: 88 },
  { id: "u3", name: "Rohan Iyer", email: "rohan@iyer.in", city: "Chennai", spend: 9820, lastPurchase: "2025-04-12", channel: "SMS" as Channel, score: 64 },
  { id: "u4", name: "Priya Nair", email: "priya.n@gmail.com", city: "Kochi", spend: 31290, lastPurchase: "2025-06-07", channel: "WhatsApp" as Channel, score: 95 },
  { id: "u5", name: "Vikram Singh", email: "v.singh@yahoo.com", city: "Delhi", spend: 6210, lastPurchase: "2025-03-02", channel: "Email" as Channel, score: 41 },
  { id: "u6", name: "Ananya Reddy", email: "ananya.r@gmail.com", city: "Hyderabad", spend: 14820, lastPurchase: "2025-05-19", channel: "Push" as Channel, score: 78 },
  { id: "u7", name: "Karan Patel", email: "karan.p@gmail.com", city: "Ahmedabad", spend: 21940, lastPurchase: "2025-06-01", channel: "WhatsApp" as Channel, score: 86 },
  { id: "u8", name: "Meera Kapoor", email: "meera.k@gmail.com", city: "Pune", spend: 4820, lastPurchase: "2025-02-14", channel: "Email" as Channel, score: 38 },
];

export const funnel = [
  { stage: "Sent", value: 24800 },
  { stage: "Delivered", value: 23950 },
  { stage: "Opened", value: 14210 },
  { stage: "Clicked", value: 5820 },
  { stage: "Converted", value: 1840 },
];

export const engagementTrend = [
  { date: "W1", email: 38, whatsapp: 62, sms: 29, push: 21 },
  { date: "W2", email: 41, whatsapp: 68, sms: 32, push: 24 },
  { date: "W3", email: 39, whatsapp: 71, sms: 30, push: 26 },
  { date: "W4", email: 44, whatsapp: 74, sms: 34, push: 28 },
];

export const revenueAttribution = [
  { channel: "WhatsApp", revenue: 3820000 },
  { channel: "Email", revenue: 2410000 },
  { channel: "SMS", revenue: 1180000 },
  { channel: "Push", revenue: 1010000 },
];

export const analyticsCards = {
  sent: 248320,
  delivered: 239510,
  opened: 142100,
  clicked: 58210,
  converted: 18420,
};

export const samplePrompts = [
  "Win back customers who haven't purchased in 60 days",
  "Create a campaign for premium coffee buyers",
  "Find customers likely to churn this month",
  "Re-engage Bangalore VIPs with a tasting invite",
];

export function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

export function formatNum(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}
