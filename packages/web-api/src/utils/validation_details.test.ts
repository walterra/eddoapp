import { SchemaValidationError } from '@eddo/core-shared/validation/schema_parser';
import { describe, expect, it } from 'vitest';
import { validationDetails } from './validation_details';

describe('API validation details', () => {
  it('retains category, array path, and safe message fields', () => {
    const error = new SchemaValidationError([
      { path: '/items/0/a~1b~0c', code: 'minLength', message: 'too short' },
      { path: '/count', code: 'type', message: 'expected number' },
      { path: '', code: 'domain', message: 'invalid request' },
    ]);
    expect(validationDetails(error)).toEqual([
      { path: ['items', 0, 'a/b~c'], code: 'too_small', message: 'too short' },
      { path: ['count'], code: 'invalid_type', message: 'expected number' },
      { path: [], code: 'custom', message: 'invalid request' },
    ]);
  });
});
