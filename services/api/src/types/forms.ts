export interface WixFormEvent {
  tenantId: string;
  submissionId: string;
  wixFormId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  occurredAt: string;
  pageUrl?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export interface StoredFormEvent {
  tenantId: string;
  wixFormId: string;
  submissionId: string;
  emailHash: string;
  attributionJson: Record<string, string | undefined>;
  processedAt: string;
  result: 'processed' | 'ignored' | 'failed';
}
