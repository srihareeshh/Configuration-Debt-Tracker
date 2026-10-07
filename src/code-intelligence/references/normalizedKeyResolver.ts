/**
 * Configuration Debt Tracker - Configuration Key Canonicalization & Resolution
 * Computes canonical key identities, generates logical variants, and compares logical relationships
 * with explicit evidence.
 */

export interface KeyComparisonResult {
  related: boolean;
  confidence: number; // 0 - 100%
  relationshipType: 'exact' | 'case_variant' | 'delimiter_variant' | 'naming_convention' | 'unrelated';
  canonicalIdentity: string;
  reason: string;
}

/**
 * Splits a configuration key into semantic constituent words/tokens.
 * Handles:
 * - SNAKE_CASE: DATABASE_URL -> ['database', 'url']
 * - Dot notation: database.url -> ['database', 'url']
 * - Kebab case: database-url -> ['database', 'url']
 * - camelCase / PascalCase: databaseUrl -> ['database', 'url']
 * - Hybrid: app.database_url -> ['app', 'database', 'url']
 */
export function tokenizeKey(key: string): string[] {
  if (!key) return [];

  // Replace delimiters with dot
  const normalizedDelims = key.replace(/[_\-:/]/g, '.');

  // Split on dots
  const rawParts = normalizedDelims.split('.');
  const tokens: string[] = [];

  for (const part of rawParts) {
    if (!part) continue;

    // Split camelCase boundaries within part (e.g. databaseUrl -> database, Url)
    const subParts = part
      .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
      .replace(/([A-Z]+)([A-Z][a-z0-9])/g, '$1.$2')
      .toLowerCase()
      .split('.');

    for (const sub of subParts) {
      const clean = sub.trim();
      if (clean) tokens.push(clean);
    }
  }

  return tokens;
}

/**
 * Canonicalizes a key into standard dot.notation.identity.
 * Example:
 * DATABASE_URL -> database.url
 * database_url -> database.url
 * databaseUrl  -> database.url
 * database-url -> database.url
 */
export function canonicalizeKey(key: string): string {
  const tokens = tokenizeKey(key);
  if (tokens.length === 0) return key.toLowerCase().trim();
  return tokens.join('.');
}

/**
 * Generates all valid logical variants for a given configuration key.
 */
export function generatePossibleVariants(key: string): string[] {
  const tokens = tokenizeKey(key);
  if (tokens.length === 0) return [key];

  const variants = new Set<string>();

  // 1. Original
  variants.add(key);

  // 2. Dot notation (lowercase): database.url
  const dotLower = tokens.join('.');
  variants.add(dotLower);

  // 3. Dot notation (uppercase): DATABASE.URL
  variants.add(tokens.map((t) => t.toUpperCase()).join('.'));

  // 4. UPPER_SNAKE_CASE: DATABASE_URL
  const upperSnake = tokens.map((t) => t.toUpperCase()).join('_');
  variants.add(upperSnake);

  // 5. lower_snake_case: database_url
  const lowerSnake = tokens.join('_');
  variants.add(lowerSnake);

  // 6. kebab-case: database-url
  const kebab = tokens.join('-');
  variants.add(kebab);

  // 7. camelCase: databaseUrl
  if (tokens.length > 1) {
    const camel = tokens[0] + tokens.slice(1).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join('');
    variants.add(camel);

    // 8. PascalCase: DatabaseUrl
    const pascal = tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join('');
    variants.add(pascal);
  }

  return Array.from(variants);
}

/**
 * Compares two logical keys with evidence-based reasoning.
 * Ensures unrelated keys (e.g. DB_URL vs DATABASE_URL without explicit synonymy) are not blindly merged.
 */
export function compareLogicalKeys(keyA: string, keyB: string): KeyComparisonResult {
  if (keyA === keyB) {
    return {
      related: true,
      confidence: 100,
      relationshipType: 'exact',
      canonicalIdentity: canonicalizeKey(keyA),
      reason: `Exact string match: '${keyA}' === '${keyB}'`
    };
  }

  if (keyA.toLowerCase() === keyB.toLowerCase()) {
    return {
      related: true,
      confidence: 98,
      relationshipType: 'case_variant',
      canonicalIdentity: canonicalizeKey(keyA),
      reason: `Case variation: '${keyA}' vs '${keyB}'`
    };
  }

  const canonA = canonicalizeKey(keyA);
  const canonB = canonicalizeKey(keyB);

  if (canonA === canonB) {
    return {
      related: true,
      confidence: 92,
      relationshipType: 'delimiter_variant',
      canonicalIdentity: canonA,
      reason: `Identical canonical token identity '${canonA}' across naming conventions ('${keyA}' vs '${keyB}')`
    };
  }

  // Check if one is a recognized prefix/suffix segment of the other with high overlap
  const tokensA = tokenizeKey(keyA);
  const tokensB = tokenizeKey(keyB);

  // Avoid merging short keys or single-token discrepancies (e.g. PORT vs SERVER_PORT requires caution)
  if (tokensA.length >= 2 && tokensB.length >= 2) {
    const setB = new Set(tokensB);
    const intersection = tokensA.filter((t) => setB.has(t));

    if (intersection.length === tokensA.length && tokensA.length === tokensB.length) {
      return {
        related: true,
        confidence: 85,
        relationshipType: 'naming_convention',
        canonicalIdentity: canonA,
        reason: `Tokens match with permutation: [${tokensA.join(', ')}] and [${tokensB.join(', ')}]`
      };
    }
  }

  return {
    related: false,
    confidence: 0,
    relationshipType: 'unrelated',
    canonicalIdentity: canonA,
    reason: `Different canonical identities: '${canonA}' !== '${canonB}'`
  };
}

/**
 * Formats a clear, human-understandable explanation for why two keys relate.
 */
export function explainKeyRelationship(keyA: string, keyB: string): string {
  const result = compareLogicalKeys(keyA, keyB);
  if (!result.related) {
    return `'${keyA}' and '${keyB}' are distinct, unrelated configuration keys.`;
  }
  return `Key relationship verified: '${keyA}' and '${keyB}' resolve to canonical identity '${result.canonicalIdentity}' (${result.reason}, confidence: ${result.confidence}%).`;
}
