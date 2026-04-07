import type { RuntimeStore } from './store-contract.js';

export class PostgresStore implements RuntimeStore {
  constructor(private readonly connectionString: string) {
    if (!connectionString) {
      throw new Error('POSTGRES_URL is required for PostgresStore');
    }
  }

  private unsupported(): never {
    throw new Error('PostgresStore is scaffolded but not yet wired in this branch');
  }

  getConnection() {
    return this.unsupported();
  }
  upsertConnection() {
    return this.unsupported();
  }
  saveTokens() {
    return this.unsupported();
  }
  getTokens() {
    return this.unsupported();
  }
  deleteTokens() {
    return this.unsupported();
  }
  getActiveMappingSet() {
    return this.unsupported();
  }
  saveMappingSet() {
    return this.unsupported();
  }
  saveContact() {
    return this.unsupported();
  }
  getContact() {
    return this.unsupported();
  }
  listContacts() {
    return this.unsupported();
  }
  findContactByEmail() {
    return this.unsupported();
  }
  putContactLink() {
    return this.unsupported();
  }
  getContactLinkBySource() {
    return this.unsupported();
  }
  addDedupeEvent() {
    return this.unsupported();
  }
  hasDedupeEvent() {
    return this.unsupported();
  }
  addAuditLog() {
    return this.unsupported();
  }
  getAuditLogs() {
    return this.unsupported();
  }
  getSyncStatus() {
    return this.unsupported();
  }
  addFormEvent() {
    return this.unsupported();
  }
  getFormEvents() {
    return this.unsupported();
  }
  addDeadLetterJob() {
    return this.unsupported();
  }
  addRetry() {
    return this.unsupported();
  }
  getDeadLetterJobs() {
    return this.unsupported();
  }
  removeDeadLetterJob() {
    return this.unsupported();
  }
  getMetrics() {
    return this.unsupported();
  }
  cleanupRetention() {
    return this.unsupported();
  }
}
