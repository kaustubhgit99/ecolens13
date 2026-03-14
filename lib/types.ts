// Exact mirror of the Supabase schema

export type Role = "citizen" | "authority" | "admin";
export type Priority = "High" | "Medium" | "Low";
export type Severity = "high" | "medium" | "low";
export type ComplaintStatus =
  | "pending"
  | "ai_processing"
  | "rejected_spam"
  | "merged"
  | "routed"
  | "in_progress"
  | "resolved";
export type NotificationType = "status_update" | "coin_earned" | "duplicate_merged";

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: Role;
  ward: string | null;
  department: string | null;
  coins_total: number;
  coins_month: number;
  spam_strikes: number;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  head_user_id: string | null;
  active: boolean;
  created_at: string;
}

export interface Complaint {
  id: string;
  citizen_id: string | null;
  title: string | null;
  description: string | null;
  voice_transcript: string | null;
  image_url: string | null;
  audio_url: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  ward: string | null;
  ai_category: string | null;
  ai_subcategory: string | null;
  ai_priority: Priority | null;
  ai_priority_score: number | null;
  ai_department: string | null;
  ai_is_spam: boolean;
  ai_is_duplicate: boolean;
  ai_duplicate_of: string | null;
  ai_severity: Severity | null;
  ai_confidence: number | null;
  ai_objects: unknown[];
  ai_raw_response: unknown | null;
  status: ComplaintStatus;
  assigned_to: string | null;
  department: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  coins_awarded: boolean;
  created_at: string;
  updated_at: string;
  citizen?: User;
  assignee?: User;
}

export interface CoinTransaction {
  id: string;
  user_id: string;
  complaint_id: string | null;
  coins: number;
  reason: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  complaint_id: string | null;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
}

export const CATEGORY_EMOJI: Record<string, string> = {
  "Road Damage": "🚗",
  "Garbage": "🗑️",
  "Sewage": "🚰",
  "Lighting": "💡",
  "Water Supply": "💧",
  "Air Quality": "💨",
  "Noise": "🔊",
  "Other": "❓",
};

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  pending: "Pending",
  ai_processing: "AI Processing",
  rejected_spam: "Rejected",
  merged: "Merged",
  routed: "Routed",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export const STATUS_CLASS: Record<ComplaintStatus, string> = {
  pending: "badge-amber",
  ai_processing: "badge-purple",
  rejected_spam: "badge-red",
  merged: "badge-gray",
  routed: "badge-blue",
  in_progress: "badge-blue",
  resolved: "badge-green",
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  High: "badge-red",
  Medium: "badge-amber",
  Low: "badge-blue",
};

export const CATEGORIES = [
  { emoji: "🚗", label: "Road Damage" },
  { emoji: "🗑️", label: "Garbage" },
  { emoji: "🚰", label: "Sewage" },
  { emoji: "💡", label: "Lighting" },
  { emoji: "💧", label: "Water Supply" },
  { emoji: "💨", label: "Air Quality" },
  { emoji: "🔊", label: "Noise" },
  { emoji: "❓", label: "Other" },
];
