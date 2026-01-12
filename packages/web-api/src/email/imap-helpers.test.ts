import { describe, expect, it } from 'vitest';

import { createImapOptions, messageToEmailItem, type ImapMessage } from './imap-helpers.js';
import type { ImapConnectionConfig } from './types.js';

describe('imap-helpers', () => {
  describe('createImapOptions', () => {
    it('creates Gmail options with OAuth', () => {
      const config: ImapConnectionConfig = {
        provider: 'gmail',
        oauthEmail: 'user@gmail.com',
        folder: 'eddo',
      };

      const options = createImapOptions(config, 'test-access-token');

      expect(options.host).toBe('imap.gmail.com');
      expect(options.port).toBe(993);
      expect(options.secure).toBe(true);
      expect(options.auth).toEqual({
        user: 'user@gmail.com',
        accessToken: 'test-access-token',
      });
    });

    it('creates plain IMAP options without OAuth', () => {
      const config: ImapConnectionConfig = {
        provider: 'imap',
        imapHost: 'mail.example.com',
        imapPort: 993,
        imapUser: 'user@example.com',
        imapPassword: 'password123',
        folder: 'eddo',
      };

      const options = createImapOptions(config);

      expect(options.host).toBe('mail.example.com');
      expect(options.port).toBe(993);
      expect(options.secure).toBe(true);
      expect(options.auth).toEqual({
        user: 'user@example.com',
        pass: 'password123',
      });
    });

    it('falls back to plain IMAP for Gmail without access token', () => {
      const config: ImapConnectionConfig = {
        provider: 'gmail',
        oauthEmail: 'user@gmail.com',
        imapHost: 'imap.gmail.com',
        imapUser: 'user@gmail.com',
        folder: 'eddo',
      };

      const options = createImapOptions(config);

      // Without accessToken, falls back to plain IMAP options
      expect(options.host).toBe('imap.gmail.com');
      expect(options.auth).toEqual({
        user: 'user@gmail.com',
        pass: '',
      });
    });
  });

  describe('messageToEmailItem', () => {
    it('converts IMAP message to EmailItem', () => {
      const message: ImapMessage = {
        uid: 123,
        envelope: {
          subject: 'Test Subject',
          date: new Date('2026-01-15T10:30:00Z'),
          messageId: '<msg-123@mail.example.com>',
          from: [{ address: 'sender@example.com', name: 'Test Sender' }],
        },
        source: Buffer.from('Test body content'),
      };

      const result = messageToEmailItem(message, 'eddo');

      expect(result).not.toBeNull();
      expect(result!.subject).toBe('Test Subject');
      expect(result!.uid).toBe(123);
      expect(result!.messageId).toBe('<msg-123@mail.example.com>');
      expect(result!.folder).toBe('eddo');
      expect(result!.from).toBe('sender@example.com');
      expect(result!.fromName).toBe('Test Sender');
    });

    it('returns null for message without envelope', () => {
      const message: ImapMessage = {
        uid: 123,
      };

      const result = messageToEmailItem(message, 'eddo');

      expect(result).toBeNull();
    });

    it('uses default subject for missing subject', () => {
      const message: ImapMessage = {
        uid: 123,
        envelope: {
          date: new Date('2026-01-15T10:30:00Z'),
          messageId: '<msg-123@mail.example.com>',
          from: [{ address: 'sender@example.com' }],
        },
      };

      const result = messageToEmailItem(message, 'eddo');

      expect(result!.subject).toBe('No Subject');
    });

    it('generates fallback messageId from UID when missing', () => {
      const message: ImapMessage = {
        uid: 456,
        envelope: {
          subject: 'Test',
          date: new Date('2026-01-15T10:30:00Z'),
          from: [{ address: 'sender@example.com' }],
        },
      };

      const result = messageToEmailItem(message, 'eddo');

      expect(result!.messageId).toBe('456@unknown');
    });

    it('uses current date when envelope date is missing', () => {
      const message: ImapMessage = {
        uid: 123,
        envelope: {
          subject: 'Test',
          messageId: '<msg-123@mail.example.com>',
          from: [{ address: 'sender@example.com' }],
        },
      };

      const before = new Date().toISOString();
      const result = messageToEmailItem(message, 'eddo');
      const after = new Date().toISOString();

      expect(result!.receivedDate >= before).toBe(true);
      expect(result!.receivedDate <= after).toBe(true);
    });

    it('includes gmailMessageId when present', () => {
      const message: ImapMessage = {
        uid: 123,
        emailId: '1234567890',
        envelope: {
          subject: 'Test',
          date: new Date('2026-01-15T10:30:00Z'),
          messageId: '<msg-123@mail.example.com>',
          from: [{ address: 'sender@example.com' }],
        },
      };

      const result = messageToEmailItem(message, 'eddo');

      expect(result!.gmailMessageId).toBe('1234567890');
    });
  });
});
