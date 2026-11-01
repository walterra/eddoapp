// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPublicAddress, parsePublicUrl, validatePublicUrl } from './public_url.js';

vi.mock('node:dns/promises', () => ({
  resolve4: vi.fn(async () => ['8.8.8.8']),
  resolve6: vi.fn(async () => []),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('public URL policy', () => {
  it.each([
    'file:///etc/passwd',
    'ftp://example.com',
    'http://user:pass@example.com',
    'http://localhost',
    'http://host.local',
    'http://host.internal',
    'http://127.1',
    'http://0x7f000001',
    'http://10.0.0.1',
    'http://169.254.169.254',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'https://example.com:444/',
    'https://example.com/?access_token=secret',
    'https://example.com/?X-Amz-Signature=secret',
  ])('rejects unsafe input %s', (url) => {
    expect(() => parsePublicUrl(url)).toThrow();
  });

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])(
    'accepts public address %s',
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );

  it.each([
    '192.0.2.1',
    '198.51.100.1',
    '203.0.113.1',
    '240.0.0.1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '2002:7f00:1::',
    '::ffff:8.8.8.8',
  ])('rejects reserved address %s', (address) => expect(isPublicAddress(address)).toBe(false));

  it('strips fragments and validates public DNS', async () => {
    expect((await validatePublicUrl('https://example.com/article#part')).href).toBe(
      'https://example.com/article',
    );
  });

  it('bounds DNS waiting when resolution stalls', async () => {
    const { resolve4 } = await import('node:dns/promises');
    vi.mocked(resolve4).mockImplementationOnce(() => new Promise(() => {}));
    const started = Date.now();
    await expect(validatePublicUrl('https://example.com')).rejects.toThrow('timed out');
    expect(Date.now() - started).toBeLessThan(7000);
  }, 8000);

  it('rejects mixed public/private DNS results', async () => {
    const { resolve4 } = await import('node:dns/promises');
    vi.mocked(resolve4).mockResolvedValueOnce(['8.8.8.8', '10.0.0.1']);
    await expect(validatePublicUrl('https://example.com')).rejects.toThrow('public');
  });

  it('fails closed when DNS cannot resolve', async () => {
    const { resolve4 } = await import('node:dns/promises');
    vi.mocked(resolve4).mockRejectedValueOnce(new Error('DNS failure'));
    await expect(validatePublicUrl('https://example.com')).rejects.toThrow('public');
  });
});
