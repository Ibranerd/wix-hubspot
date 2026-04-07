import type { WixFormEvent } from '../types/forms.js';
import type { ContactEvent } from '../types/sync.js';

export function parseContactWebhookBody(raw: string): Omit<ContactEvent, 'source'> {
  const parsed = JSON.parse(raw) as Partial<Omit<ContactEvent, 'source'>>;
  if (!parsed.tenantId || typeof parsed.tenantId !== 'string') {
    throw new Error('invalid_contact_event_tenant_id');
  }

  if (!parsed.contactId || typeof parsed.contactId !== 'string') {
    throw new Error('invalid_contact_event_contact_id');
  }

  if (!parsed.occurredAt || typeof parsed.occurredAt !== 'string') {
    throw new Error('invalid_contact_event_occurred_at');
  }

  if (!parsed.payload || typeof parsed.payload !== 'object') {
    throw new Error('invalid_contact_event_payload');
  }

  return {
    tenantId: parsed.tenantId,
    contactId: parsed.contactId,
    eventId: typeof parsed.eventId === 'string' ? parsed.eventId : undefined,
    correlationId: typeof parsed.correlationId === 'string' ? parsed.correlationId : undefined,
    occurredAt: parsed.occurredAt,
    payload: parsed.payload
  };
}

export function parseFormWebhookBody(raw: string): WixFormEvent {
  const parsed = JSON.parse(raw) as Partial<WixFormEvent>;
  if (!parsed.tenantId || typeof parsed.tenantId !== 'string') {
    throw new Error('invalid_form_event_tenant_id');
  }

  if (!parsed.submissionId || typeof parsed.submissionId !== 'string') {
    throw new Error('invalid_form_event_submission_id');
  }

  if (!parsed.wixFormId || typeof parsed.wixFormId !== 'string') {
    throw new Error('invalid_form_event_wix_form_id');
  }

  if (!parsed.email || typeof parsed.email !== 'string') {
    throw new Error('invalid_form_event_email');
  }

  if (!parsed.occurredAt || typeof parsed.occurredAt !== 'string') {
    throw new Error('invalid_form_event_occurred_at');
  }

  return {
    tenantId: parsed.tenantId,
    submissionId: parsed.submissionId,
    wixFormId: parsed.wixFormId,
    email: parsed.email,
    occurredAt: parsed.occurredAt,
    firstName: stringOrUndefined(parsed.firstName),
    lastName: stringOrUndefined(parsed.lastName),
    pageUrl: stringOrUndefined(parsed.pageUrl),
    referrer: stringOrUndefined(parsed.referrer),
    utmSource: stringOrUndefined(parsed.utmSource),
    utmMedium: stringOrUndefined(parsed.utmMedium),
    utmCampaign: stringOrUndefined(parsed.utmCampaign),
    utmTerm: stringOrUndefined(parsed.utmTerm),
    utmContent: stringOrUndefined(parsed.utmContent)
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
