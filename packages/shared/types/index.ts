// Organizations
export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

// Users/Profiles
export interface Profile {
  id: string;
  organization_id: string;
  full_name: string | null;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

// Agents
export interface Agent {
  id: string;
  organization_id: string;
  name: string;
  persona: string;
  system_prompt: string;
  greeting: string;
  objection_handling: Record<string, string>;
  voice_id: string | null;
  language: string;
  max_call_duration_seconds: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentCreateInput = Omit<Agent, 'id' | 'organization_id' | 'created_at' | 'updated_at'>;
export type AgentUpdateInput = Partial<AgentCreateInput>;

// Products
export interface Product {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export type ProductCreateInput = Omit<Product, 'id' | 'organization_id' | 'created_at'>;
export type ProductUpdateInput = Partial<ProductCreateInput>;

// Prospects
export type ProspectStatus = 'new' | 'contacted' | 'interested' | 'qualified' | 'converted' | 'lost';

export interface Prospect {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
  tags: string[];
  status: ProspectStatus;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ProspectCreateInput = Omit<Prospect, 'id' | 'organization_id' | 'created_at' | 'updated_at'>;
export type ProspectUpdateInput = Partial<ProspectCreateInput>;

// Campaigns
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface CampaignSchedule {
  timezone: string;
  days: number[]; // 0=Sun, 1=Mon, ...
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
}

export interface Campaign {
  id: string;
  organization_id: string;
  agent_id: string | null;
  name: string;
  description: string | null;
  status: CampaignStatus;
  schedule: CampaignSchedule | null;
  created_at: string;
  updated_at: string;
}

export type CampaignCreateInput = Omit<Campaign, 'id' | 'organization_id' | 'created_at' | 'updated_at'>;
export type CampaignUpdateInput = Partial<CampaignCreateInput>;

// Campaign Prospects
export type CallStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'no_answer' | 'scheduled';

export interface CampaignProspect {
  id: string;
  campaign_id: string;
  prospect_id: string;
  call_status: CallStatus;
  priority: number;
  scheduled_at: string | null;
}

// Calls
export type CallOutcome =
  | 'interested'
  | 'not_interested'
  | 'callback'
  | 'converted'
  | 'voicemail'
  | 'wrong_number'
  | 'no_answer';

export type CallStatusType =
  | 'initiated'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'busy'
  | 'voicemail';

export interface TranscriptEntry {
  role: 'agent' | 'prospect';
  content: string;
  timestamp: string;
}

export interface Call {
  id: string;
  organization_id: string;
  agent_id: string | null;
  prospect_id: string | null;
  campaign_id: string | null;
  twilio_call_sid: string | null;
  status: CallStatusType;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: TranscriptEntry[];
  summary: string | null;
  outcome: CallOutcome | null;
  sentiment_score: number | null;
  extracted_data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

// API Response types
export interface ApiSuccess<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
