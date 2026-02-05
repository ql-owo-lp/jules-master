
/**
 * Compares two strings using a timing-safe approach to prevent timing attacks.
 * It hashes both inputs using SHA-256 and compares the hashes in constant time.
 *
 * @param a The user provided string
 * @param b The expected string (secret)
 * @returns Promise<boolean> True if strings match
 */
export async function secureCompare(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);

  // Use SHA-256 to hash the inputs.
  // Comparing hashes prevents length leakage of the original secret
  // (beyond the constant time of the hash comparison).
  const aHash = await crypto.subtle.digest('SHA-256', aBuf);
  const bHash = await crypto.subtle.digest('SHA-256', bBuf);

  return timingSafeEqual(aHash, bHash);
}

/**
 * Compares two ArrayBuffers in constant time (dependent on length of buffers).
 * Since SHA-256 hashes are always 32 bytes, this is constant time for our use case.
 */
function timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  const viewA = new DataView(a);
  const viewB = new DataView(b);
  const length = viewA.byteLength;

  // Should not happen for same algorithm hashes, but good for correctness
  if (length !== viewB.byteLength) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < length; i++) {
    mismatch |= viewA.getUint8(i) ^ viewB.getUint8(i);
  }

  return mismatch === 0;
}
