/**
 * Generates a content-based hash for a file using SHA-256.
 * Used to create unique, collision-resistant filenames for attachments.
 */

/**
 * Generates a short hash from file content.
 * @param file - File to hash
 * @returns 12-character hex hash
 */
export async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  // Return first 12 characters - enough for uniqueness, short enough for readability
  return hashHex.slice(0, 12);
}

/**
 * Generates a hashed filename preserving the original extension.
 * @param file - File to generate name for
 * @returns Hashed filename like "a1b2c3d4e5f6.png"
 */
export async function generateHashedFilename(file: File): Promise<string> {
  const hash = await generateFileHash(file);
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  return ext ? `${hash}.${ext}` : hash;
}
