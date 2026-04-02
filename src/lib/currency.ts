/**
 * Format a number as Ethiopian Birr (ETB).
 * Examples: formatETB(1234.5) → "ETB 1,234.50"
 */
export function formatETB(amount: number): string {
  return `ETB ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Short Birr symbol version: ብር 1,234.50
 */
export function formatBirr(amount: number): string {
  return `ብር ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
