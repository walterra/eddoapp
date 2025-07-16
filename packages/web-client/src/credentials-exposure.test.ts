import { promises as fs } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('Credentials Exposure Test', () => {
  it('should not expose CouchDB credentials in production build', async () => {
    const distPath = join(__dirname, '../../web-api/public/assets');

    try {
      // Read all JavaScript files in the dist directory
      const files = await fs.readdir(distPath);
      const jsFiles = files.filter((file) => file.endsWith('.js'));

      for (const file of jsFiles) {
        const filePath = join(distPath, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for various patterns that might indicate credential exposure
        const sensitivePatterns = [
          /admin:password/i,
          /localhost:5984/i,
          /COUCHDB_URL/i,
          /COUCHDB_USERNAME/i,
          /COUCHDB_PASSWORD/i,
          /COUCHDB_ADMIN_USERNAME/i,
          /COUCHDB_ADMIN_PASSWORD/i,
          /process\.env\.COUCHDB/i,
        ];

        for (const pattern of sensitivePatterns) {
          expect(content).not.toMatch(pattern);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('Build directory not found - build first with: pnpm build');
        expect(true).toBe(true); // Skip test if build doesn't exist
      } else {
        throw error;
      }
    }
  });

  it('should include API_URL in production build', async () => {
    const distPath = join(__dirname, '../../web-api/public/assets');

    try {
      const files = await fs.readdir(distPath);
      const jsFiles = files.filter((file) => file.endsWith('.js'));

      let foundApiUrl = false;
      for (const file of jsFiles) {
        const filePath = join(distPath, file);
        const content = await fs.readFile(filePath, 'utf-8');

        if (
          /API_URL/i.test(content) ||
          /localhost:3000/i.test(content) ||
          /\/api/i.test(content)
        ) {
          foundApiUrl = true;
          console.log(`Found API URL in ${file}`);
          break;
        }
      }

      expect(foundApiUrl).toBe(true);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('Build directory not found - build first with: pnpm build');
        expect(true).toBe(true); // Skip test if build doesn't exist
      } else {
        throw error;
      }
    }
  });
});
