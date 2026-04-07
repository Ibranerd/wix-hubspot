import type { MappingDirection } from '../../../../services/api/src/types/mappings.js';

export interface MappingTableRow {
  wixFieldKey: string;
  hubspotProperty: string;
  direction: MappingDirection;
  transform: 'none' | 'trim' | 'lowercase';
  enabled: boolean;
}

export const emptyMappingTable: MappingTableRow[] = [
  {
    wixFieldKey: 'email',
    hubspotProperty: 'email',
    direction: 'bidirectional',
    transform: 'trim',
    enabled: true
  }
];
