import { createClient } from "./supabase-browser";
import type { ComplaintStatus, Priority } from "./types";

// ─── Auth ─────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const sb = createClient();
  return sb.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const sb = createClient();
  return sb.auth.signOut();
}

export async function getSession() {
  const sb = createClient();
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function getCurrentUser() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("users").select("*").eq("id", user.id).single();
  return data;
}

// ─── Users ────────────────────────────────────────────────────────

export async function getLeaderboard(limit = 20) {
  const sb = createClient();
  const { data } = await sb
    .from("users")
    .select("id, full_name, coins_total, coins_month, ward")
    .eq("role", "citizen")
    .eq("is_blocked", false)
    .order("coins_total", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getCitizenStats(userId: string) {
  const sb = createClient();
  const { data } = await sb
    .from("complaints")
    .select("status")
    .eq("citizen_id", userId);
  const all = data ?? [];
  return {
    total: all.length,
    resolved: all.filter((c) => c.status === "resolved").length,
    in_progress: all.filter((c) => c.status === "in_progress" || c.status === "routed").length,
    pending: all.filter((c) => c.status === "pending" || c.status === "ai_processing").length,
  };
}

// ─── Complaints ───────────────────────────────────────────────────

export async function getMyComplaints(userId: string) {
  const sb = createClient();
  const { data } = await sb
    .from("complaints")
    .select("*")
    .eq("citizen_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getComplaintById(id: string) {
  const sb = createClient();
  const { data } = await sb
    .from("complaints")
    .select("*, citizen:citizen_id(full_name, email, ward), assignee:assigned_to(full_name, department)")
    .eq("id", id)
    .single();
  return data;
}

export async function getAllComplaints(filters?: {
  status?: ComplaintStatus;
  priority?: Priority;
  department?: string;
  search?: string;
}) {
  const sb = createClient();
  let q = sb
    .from("complaints")
    .select("*, citizen:citizen_id(full_name, ward)")
    .order("created_at", { ascending: false });

  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.priority) q = q.eq("ai_priority", filters.priority);
  if (filters?.department) q = q.eq("department", filters.department);
  if (filters?.search) q = q.or(`title.ilike.%${filters.search}%,id.ilike.%${filters.search}%`);

  const { data } = await q;
  return data ?? [];
}

export async function submitComplaint(payload: {
  citizen_id: string;
  title: string;
  description: string;
  address: string;
  ward: string;
  latitude: number;
  longitude: number;
  ai_category: string;
  ai_department: string;
  department: string;
}) {
  const sb = createClient();
  const { data, error } = await sb
    .from("complaints")
    .insert({ ...payload, status: "pending", ai_priority: "Medium", ai_confidence: 0.9 })
    .select()
    .single();
  return { data, error };
}

export async function updateComplaintStatus(
  id: string,
  status: ComplaintStatus,
  resolution_notes?: string
) {
  const sb = createClient();
  const update: Record<string, unknown> = { status };
  if (status === "resolved") update.resolved_at = new Date().toISOString();
  if (resolution_notes) update.resolution_notes = resolution_notes;
  return sb.from("complaints").update(update).eq("id", id);
}

// ─── Coins ────────────────────────────────────────────────────────

export async function getCoinTransactions(userId: string) {
  const sb = createClient();
  const { data } = await sb
    .from("coin_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

// ─── Departments ──────────────────────────────────────────────────

export async function getDepartments() {
  const sb = createClient();
  const { data } = await sb.from("departments").select("*").eq("active", true).order("name");
  return data ?? [];
}

// ─── Admin analytics ──────────────────────────────────────────────

export async function getAdminStats() {
  const sb = createClient();
  const { data } = await sb.from("complaints").select("status, ai_priority, department, created_at");
  const all = data ?? [];
  return {
    total: all.length,
    resolved: all.filter((c) => c.status === "resolved").length,
    in_progress: all.filter((c) => c.status === "in_progress" || c.status === "routed").length,
    pending: all.filter((c) => c.status === "pending").length,
  };
}

export async function getDeptStats() {
  const sb = createClient();
  const { data } = await sb
    .from("complaints")
    .select("department, status, ai_priority");
  const all = data ?? [];

  const depts: Record<string, { assigned: number; resolved: number }> = {};
  all.forEach((c) => {
    if (!c.department) return;
    if (!depts[c.department]) depts[c.department] = { assigned: 0, resolved: 0 };
    depts[c.department].assigned++;
    if (c.status === "resolved") depts[c.department].resolved++;
  });
  return depts;
}

export async function getCitizenEngagement() {
  const sb = createClient();
  const [usersRes, coinsRes] = await Promise.all([
    sb.from("users").select("id, coins_total, created_at").eq("role", "citizen"),
    sb.from("coin_transactions").select("coins"),
  ]);
  const users = usersRes.data ?? [];
  const coins = coinsRes.data ?? [];
  return {
    total_citizens: users.length,
    active: users.filter((u) => u.coins_total > 0).length,
    coins_issued: coins.filter((c) => c.coins > 0).reduce((a, b) => a + b.coins, 0),
    coins_redeemed: Math.abs(coins.filter((c) => c.coins < 0).reduce((a, b) => a + b.coins, 0)),
  };
}
