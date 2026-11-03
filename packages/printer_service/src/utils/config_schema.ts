import {
  coerceNumber,
  createFieldNormalizer,
} from '@eddo/core-shared/validation/field_normalization';
import {
  createSchemaParser,
  num,
  obj,
  opt,
  str,
  type SchemaIssue,
} from '@eddo/core-shared/validation/schema_parser';
import { isIP } from 'node:net';

const printerFields = {
  PRINTER_ENABLED: str(),
  PRINTER_IP_ADDRESS: opt(str()),
  PRINTER_PORT: num(),
  PRINTER_SCHEDULE_TIME: str({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }),
};
const printerParser = createSchemaParser(obj(printerFields), {
  normalize: createFieldNormalizer({
    fields: Object.keys(printerFields),
    defaults: { PRINTER_ENABLED: 'false', PRINTER_PORT: 9100, PRINTER_SCHEDULE_TIME: '07:00' },
    conversions: { PRINTER_PORT: coerceNumber },
  }),
  validate: validatePrinterAddress,
});
interface PrinterInput {
  PRINTER_ENABLED: string;
  PRINTER_IP_ADDRESS?: string;
  PRINTER_PORT: number;
  PRINTER_SCHEDULE_TIME: string;
}
export interface PrinterConfig extends Omit<PrinterInput, 'PRINTER_ENABLED'> {
  PRINTER_ENABLED: boolean;
}

/** Accepts IPv4 and IPv6 literals without accepting hostnames or scoped addresses. */
function validatePrinterAddress(value: PrinterInput): SchemaIssue[] {
  const address = value.PRINTER_IP_ADDRESS;
  return address === undefined || (!address.includes('%') && isIP(address) !== 0)
    ? []
    : [
        {
          path: '/PRINTER_IP_ADDRESS',
          code: 'format',
          message: 'expected an IPv4 or IPv6 address',
        },
      ];
}

/** Parses printer fields before converting the historical string boolean. */
export function parsePrinterConfig(input: unknown): PrinterConfig {
  const value = printerParser.parse(input);
  return { ...value, PRINTER_ENABLED: value.PRINTER_ENABLED.toLowerCase() === 'true' };
}
