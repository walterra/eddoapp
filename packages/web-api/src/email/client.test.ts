import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmailClient, generateExternalId, mapEmailToTodo } from './client.js';
import type { EmailItem } from './types.js';

/** Create a valid EmailItem for testing */
function createTestEmail(overrides: Partial<EmailItem> = {}): EmailItem {
  return {
    messageId: '<unique-id-123@mail.gmail.com>',
    subject: 'Test Subject',
    from: 'sender@example.com',
    fromName: 'Test Sender',
    receivedDate: '2026-01-01T10:00:00Z',
    body: 'Test body',
    folder: 'eddo',
    uid: 1,
    ...overrides,
  };
}

describe('email client', () => {
  describe('generateExternalId', () => {
    it('generates consistent external ID from folder and message ID', () => {
      const email = createTestEmail();
      const externalId = generateExternalId(email);

      expect(externalId).toMatch(/^email:[a-f0-9]{8}\/[a-f0-9]{8}$/);
    });

    it('generates different IDs for different messages', () => {
      const email1 = createTestEmail({ messageId: '<id-1@mail.gmail.com>' });
      const email2 = createTestEmail({ messageId: '<id-2@mail.gmail.com>' });

      expect(generateExternalId(email1)).not.toBe(generateExternalId(email2));
    });

    it('generates different IDs for same message ID from different folders', () => {
      const email1 = createTestEmail({ folder: 'eddo' });
      const email2 = createTestEmail({ folder: 'OtherFolder' });

      expect(generateExternalId(email1)).not.toBe(generateExternalId(email2));
    });

    it('generates same ID for same email', () => {
      const email = createTestEmail();

      expect(generateExternalId(email)).toBe(generateExternalId(email));
    });
  });

  describe('mapEmailToTodo', () => {
    it('maps email to todo with correct structure', () => {
      const email = createTestEmail({
        subject: 'Important Task',
        from: 'boss@company.com',
        body: 'Please complete this task by Friday.\n\nThanks!',
      });

      const todo = mapEmailToTodo(email, ['source:email', 'gtd:next']);

      expect(todo.title).toBe('Important Task');
      expect(todo.description).toContain('Please complete this task by Friday.');
      expect(todo.context).toBe('email');
      expect(todo.tags).toEqual(['source:email', 'gtd:next']);
      expect(todo.externalId).toMatch(/^email:[a-f0-9]{8}\/[a-f0-9]{8}$/);
      expect(todo.completed).toBeNull();
      expect(todo.version).toBe('alpha3');
    });

    it('uses "No Subject" for empty subject', () => {
      const email = createTestEmail({ subject: '' });
      const todo = mapEmailToTodo(email, []);

      expect(todo.title).toBe('No Subject');
    });

    it('truncates long body in description', () => {
      const longBody = 'A'.repeat(60000);
      const email = createTestEmail({ body: longBody });
      const todo = mapEmailToTodo(email, []);

      // Description should be truncated to ~50000 chars (for newsletter content)
      expect(todo.description.length).toBeLessThanOrEqual(50003); // 50000 + "..."
    });

    it('uses receivedDate for todo due date', () => {
      const email = createTestEmail({ receivedDate: '2026-01-15T14:30:00Z' });
      const todo = mapEmailToTodo(email, []);

      expect(todo.due).toBe('2026-01-15T14:30:00Z');
    });

    it('sets context to email', () => {
      const email = createTestEmail();
      const todo = mapEmailToTodo(email, []);

      expect(todo.context).toBe('email');
    });

    it('sets link to null', () => {
      const email = createTestEmail();
      const todo = mapEmailToTodo(email, []);

      expect(todo.link).toBeNull();
    });
  });

  describe('createEmailClient', () => {
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates client with expected interface', () => {
      const client = createEmailClient({}, mockLogger);

      expect(client).toBeDefined();
      expect(typeof client.fetchEmails).toBe('function');
      expect(typeof client.markAsRead).toBe('function');
      expect(typeof client.mapEmailToTodo).toBe('function');
      expect(typeof client.generateExternalId).toBe('function');
    });

    it('client mapEmailToTodo matches standalone function', () => {
      const client = createEmailClient({}, mockLogger);
      const email = createTestEmail();

      const todoFromClient = client.mapEmailToTodo(email, ['tag1']);
      const todoFromFunction = mapEmailToTodo(email, ['tag1']);

      expect(todoFromClient.title).toBe(todoFromFunction.title);
      expect(todoFromClient.externalId).toBe(todoFromFunction.externalId);
    });

    it('client generateExternalId matches standalone function', () => {
      const client = createEmailClient({}, mockLogger);
      const email = createTestEmail();

      expect(client.generateExternalId(email)).toBe(generateExternalId(email));
    });
  });
});
