import { createHash, randomUUID } from 'node:crypto';
import type { RuntimeStore } from '../storage/store-contract.js';
import type { WixFormEvent } from '../types/forms.js';

export class FormCaptureService {
  constructor(private readonly store: RuntimeStore) {}

  process(event: WixFormEvent): { status: 'processed' | 'ignored'; correlationId: string } {
    const correlationId = randomUUID();

    const dedupeKey = `${event.tenantId}:form:${event.submissionId}`;
    if (this.store.hasDedupeEvent(dedupeKey)) {
      this.store.addFormEvent({
        tenantId: event.tenantId,
        wixFormId: event.wixFormId,
        submissionId: event.submissionId,
        emailHash: hashEmail(event.email),
        attributionJson: this.extractAttribution(event),
        processedAt: new Date().toISOString(),
        result: 'ignored'
      });
      return { status: 'ignored', correlationId };
    }

    const matches = this.store.findContactByEmail('hubspot', event.tenantId, event.email);
    if (matches.length > 1) {
      this.store.addFormEvent({
        tenantId: event.tenantId,
        wixFormId: event.wixFormId,
        submissionId: event.submissionId,
        emailHash: hashEmail(event.email),
        attributionJson: this.extractAttribution(event),
        processedAt: new Date().toISOString(),
        result: 'failed'
      });
      return { status: 'ignored', correlationId };
    }

    const targetContact = matches[0];
    const now = new Date().toISOString();

    const firstTouchDefaults = {
      wix_first_utm_source: event.utmSource,
      wix_first_utm_medium: event.utmMedium,
      wix_first_utm_campaign: event.utmCampaign,
      wix_first_utm_term: event.utmTerm,
      wix_first_utm_content: event.utmContent
    };

    const latestTouch = {
      wix_utm_source: event.utmSource,
      wix_utm_medium: event.utmMedium,
      wix_utm_campaign: event.utmCampaign,
      wix_utm_term: event.utmTerm,
      wix_utm_content: event.utmContent,
      wix_page_url: event.pageUrl,
      wix_referrer: event.referrer,
      wix_form_submitted_at: event.occurredAt
    };

    const nextFields = {
      ...(targetContact?.fields || {}),
      email: event.email,
      firstName: event.firstName || asString(targetContact?.fields.firstName),
      lastName: event.lastName || asString(targetContact?.fields.lastName),
      ...latestTouch
    } as Record<string, unknown>;

    for (const [key, value] of Object.entries(firstTouchDefaults)) {
      if (!nextFields[key] && value) {
        nextFields[key] = value;
      }
    }

    const hubspotContactId = targetContact?.id || `hubspot_${randomUUID()}`;
    this.store.saveContact('hubspot', {
      id: hubspotContactId,
      tenantId: event.tenantId,
      updatedAt: now,
      fields: nextFields
    });

    this.store.addFormEvent({
      tenantId: event.tenantId,
      wixFormId: event.wixFormId,
      submissionId: event.submissionId,
      emailHash: hashEmail(event.email),
      attributionJson: this.extractAttribution(event),
      processedAt: now,
      result: 'processed'
    });

    this.store.addDedupeEvent(dedupeKey, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    return { status: 'processed', correlationId };
  }

  private extractAttribution(event: WixFormEvent): Record<string, string | undefined> {
    return {
      utmSource: event.utmSource,
      utmMedium: event.utmMedium,
      utmCampaign: event.utmCampaign,
      utmTerm: event.utmTerm,
      utmContent: event.utmContent,
      pageUrl: event.pageUrl,
      referrer: event.referrer,
      occurredAt: event.occurredAt
    };
  }
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
