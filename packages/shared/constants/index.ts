export const CALL_STATUSES = ['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'voicemail'] as const;

export const CALL_OUTCOMES = ['interested', 'not_interested', 'callback', 'converted', 'voicemail', 'wrong_number', 'no_answer'] as const;

export const PROSPECT_STATUSES = ['new', 'contacted', 'interested', 'qualified', 'converted', 'lost'] as const;

export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed'] as const;

export const DEFAULT_LANGUAGE = 'es-MX';
export const DEFAULT_CURRENCY = 'MXN';
export const DEFAULT_MAX_CALL_DURATION = 300; // seconds

export const SUPPORTED_LANGUAGES = [
  { code: 'es-MX', label: 'Español (México)' },
  { code: 'es-ES', label: 'Español (España)' },
  { code: 'en-US', label: 'English (US)' },
] as const;

export const SENTIMENT_LABELS = {
  positive: { min: 0.3, max: 1 },
  neutral: { min: -0.3, max: 0.3 },
  negative: { min: -1, max: -0.3 },
} as const;
