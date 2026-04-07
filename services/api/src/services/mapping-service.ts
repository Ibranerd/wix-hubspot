import { randomUUID } from 'node:crypto';
import type {
  FieldCatalogItem,
  FieldMappingSet,
  MappingRow,
  MappingRowInput
} from '../types/mappings.js';
import { InMemoryStore } from '../storage/in-memory-store.js';

const wixCatalog: FieldCatalogItem[] = [
  { key: 'email', label: 'Email', type: 'string', required: true },
  { key: 'firstName', label: 'First Name', type: 'string' },
  { key: 'lastName', label: 'Last Name', type: 'string' },
  { key: 'phone', label: 'Phone', type: 'string' },
  { key: 'createdAt', label: 'Created At', type: 'date' },
  { key: 'marketingOptIn', label: 'Marketing Opt In', type: 'boolean' }
];

const hubspotCatalog: FieldCatalogItem[] = [
  { key: 'email', label: 'Email', type: 'string', required: true },
  { key: 'firstname', label: 'First Name', type: 'string' },
  { key: 'lastname', label: 'Last Name', type: 'string' },
  { key: 'phone', label: 'Phone', type: 'string' },
  { key: 'createdate', label: 'Create Date', type: 'date' },
  { key: 'hs_email_optout', label: 'Email Opt Out', type: 'boolean' }
];

export class MappingService {
  constructor(private readonly store: InMemoryStore) {}

  getCatalog(): { wixFields: FieldCatalogItem[]; hubspotProperties: FieldCatalogItem[] } {
    return {
      wixFields: wixCatalog,
      hubspotProperties: hubspotCatalog
    };
  }

  getActiveMappingSet(tenantId: string): FieldMappingSet | null {
    return this.store.getActiveMappingSet(tenantId) ?? null;
  }

  saveMappingSet(tenantId: string, rows: MappingRowInput[]): FieldMappingSet {
    this.validateRows(rows);

    const previous = this.store.getActiveMappingSet(tenantId);
    const version = previous ? previous.version + 1 : 1;
    const mappingSet: FieldMappingSet = {
      id: randomUUID(),
      tenantId,
      version,
      isActive: true,
      createdAt: new Date().toISOString(),
      rows: rows.map((row): MappingRow => ({ ...row, id: randomUUID() }))
    };

    this.store.saveMappingSet(mappingSet);
    return mappingSet;
  }

  private validateRows(rows: MappingRowInput[]): void {
    if (rows.length === 0) {
      throw new Error('At least one mapping row is required');
    }

    const enabledRows = rows.filter((row) => row.enabled);
    const emailMapped = enabledRows.some(
      (row) => row.wixFieldKey === 'email' && row.hubspotProperty === 'email'
    );
    if (!emailMapped) {
      throw new Error('Email mapping is required (email -> email)');
    }

    const seenHubspotProps = new Set<string>();
    for (const row of enabledRows) {
      if (seenHubspotProps.has(row.hubspotProperty)) {
        throw new Error(`Duplicate HubSpot mapping detected for property: ${row.hubspotProperty}`);
      }

      seenHubspotProps.add(row.hubspotProperty);

      const wix = wixCatalog.find((item) => item.key === row.wixFieldKey);
      const hubspot = hubspotCatalog.find((item) => item.key === row.hubspotProperty);
      if (!wix || !hubspot) {
        throw new Error(`Unknown mapping field pair: ${row.wixFieldKey} -> ${row.hubspotProperty}`);
      }

      if (wix.type !== hubspot.type) {
        throw new Error(
          `Incompatible mapping types for ${row.wixFieldKey} (${wix.type}) -> ${row.hubspotProperty} (${hubspot.type})`
        );
      }
    }
  }
}
