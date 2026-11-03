import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(exec);

/** Resolves trusted Pi credential expressions during credential validation or live requests. */
export async function resolveCustomApiKey(expression: string | undefined): Promise<string> {
  if (!expression) throw new Error('Custom provider requires apiKey');
  if (expression.startsWith('!')) {
    try {
      const result = await execute(expression.slice(1), { timeout: 10000, maxBuffer: 65536 });
      const key = result.stdout.trim();
      if (!key) throw new Error('Empty credential');
      return key;
    } catch {
      throw new Error('Custom provider credential command failed');
    }
  }
  const key = expression.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (_match, braced: string | undefined, plain: string | undefined) => {
      const value = process.env[braced ?? plain ?? ''];
      if (!value) throw new Error('Custom provider credential environment variable is missing');
      return value;
    },
  );
  if (!key.trim()) throw new Error('Custom provider credential is empty');
  return key;
}
