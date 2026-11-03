import { validateAbsoluteUrl } from '@eddo/core-shared/validation/compatibility';
import { createFieldNormalizer } from '@eddo/core-shared/validation/field_normalization';
import { createProjectedParser } from '@eddo/core-shared/validation/projected_parser';
import { obj, opt, projectProperties, str } from '@eddo/core-shared/validation/schema_parser';

const normalizeRepository = createFieldNormalizer({
  fields: ['slug', 'gitUrl', 'defaultBranch', 'ref'],
  defaults: { defaultBranch: 'main' },
});

/** Projects session payloads before supplying defaults only inside a supplied repository. */
function normalizeSession(value: unknown): unknown {
  const projected = projectProperties(value, ['name', 'repository']);
  if (typeof projected !== 'object' || projected === null || Array.isArray(projected))
    return projected;
  if (!Object.hasOwn(projected, 'repository')) return projected;
  return { ...projected, repository: normalizeRepository(Reflect.get(projected, 'repository')) };
}

export const createSessionSchema = createProjectedParser(
  obj({
    name: opt(str()),
    repository: opt(obj({ slug: str(), gitUrl: str(), defaultBranch: str(), ref: opt(str()) })),
  }),
  {
    normalize: normalizeSession,
    validate: (value) =>
      value.repository === undefined
        ? []
        : validateAbsoluteUrl(value.repository.gitUrl, '/repository/gitUrl'),
  },
);
export const promptSchema = createProjectedParser(obj({ message: str({ minLength: 1 }) }));
export const usernameClaimsSchema = createProjectedParser(obj({ username: str() }));
