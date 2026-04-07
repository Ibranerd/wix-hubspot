type MappingDirection = 'wix_to_hubspot' | 'hubspot_to_wix' | 'bidirectional';

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
