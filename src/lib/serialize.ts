/**
 * Recursively serializes Prisma result objects into plain JS-compatible values.
 * Converts Prisma Decimal instances to numbers, preserves Dates, and recurses
 * into plain objects and arrays.
 */

function isDecimalLike(value: unknown): value is { toNumber(): number } {
  if (typeof value !== 'object' || value === null) return false;
  if (!('toNumber' in value)) return false;
  return typeof (value as { toNumber: unknown }).toNumber === 'function';
}

export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (isDecimalLike(value)) {
    return value.toNumber() as T;
  }

  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value.map((item) => serialize(item)) as T;
  }

  if (typeof value === 'object' && value.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serialize(val);
    }
    return result as T;
  }

  return value;
}
