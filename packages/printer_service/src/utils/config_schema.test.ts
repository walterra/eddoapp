import { describe, expect, it } from 'vitest';
import { parsePrinterConfig } from './config_schema';

describe('printer configuration compatibility', () => {
  it('supplies defaults and strips unrelated environment variables', () => {
    expect(parsePrinterConfig({ unrelated: true })).toEqual({
      PRINTER_ENABLED: false,
      PRINTER_PORT: 9100,
      PRINTER_SCHEDULE_TIME: '07:00',
    });
  });

  it.each(['127.0.0.1', '::1', '2001:db8::1', '::ffff:192.0.2.1'])(
    'accepts IP literals: %s',
    (address) => {
      expect(parsePrinterConfig({ PRINTER_IP_ADDRESS: address }).PRINTER_IP_ADDRESS).toBe(address);
    },
  );

  it.each(['localhost', '[::1]', '01.2.3.4', 'fe80::1%eth0', '999.0.0.1'])(
    'rejects invalid IP literals: %s',
    (address) => {
      expect(() => parsePrinterConfig({ PRINTER_IP_ADDRESS: address })).toThrow();
    },
  );

  it('preserves numeric coercion and case-insensitive string booleans', () => {
    expect(parsePrinterConfig({ PRINTER_PORT: '9101', PRINTER_ENABLED: 'TRUE' })).toMatchObject({
      PRINTER_PORT: 9101,
      PRINTER_ENABLED: true,
    });
    expect(parsePrinterConfig({ PRINTER_PORT: '', PRINTER_ENABLED: ' true ' })).toMatchObject({
      PRINTER_PORT: 0,
      PRINTER_ENABLED: false,
    });
    expect(parsePrinterConfig({ PRINTER_PORT: null }).PRINTER_PORT).toBe(0);
  });

  it.each([
    { PRINTER_ENABLED: true },
    { PRINTER_PORT: Infinity },
    { PRINTER_PORT: 'invalid' },
    { PRINTER_SCHEDULE_TIME: '7:00' },
    { PRINTER_SCHEDULE_TIME: '24:00' },
    { PRINTER_SCHEDULE_TIME: '07:60' },
  ])('rejects previously invalid settings', (input) => {
    expect(() => parsePrinterConfig(input)).toThrow();
  });
});
