export type MappingDirection = 'wix_to_hubspot' | 'hubspot_to_wix' | 'bidirectional';
export type FieldType = 'string' | 'number' | 'date' | 'boolean';

export interface MappingRowInput {
  wixFieldKey: string;
  hubspotProperty: string;
  direction: MappingDirection;
  transform: 'none' | 'trim' | 'lowercase';
  enabled: boolean;
}

export interface MappingRow extends MappingRowInput {
  id: string;
}

export interface FieldMappingSet {
  id: string;
  tenantId: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  rows: MappingRow[];
}

export interface FieldCatalogItem {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
}
