# Field Mapping Rules (Phase 2)

Validation rules enforced at save time:
- At least one row must exist.
- `email -> email` mapping is required and must be enabled.
- Duplicate HubSpot property targets are blocked.
- Wix and HubSpot field types must match.

Behavior:
- Saving mappings creates a new versioned set.
- New set is activated atomically; previous set is deactivated.
