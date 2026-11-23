const WHOLE_TONNES = new Intl.NumberFormat('en-GB')

/**
 * A fixed-3 decimal string as tonnes. The value never goes through a number: the whole part is
 * grouped as an integer and the three decimals are kept as sent.
 */
export function formatTonnes(value: string) {
  const [whole, decimals = '000'] = value.split('.')

  return `${WHOLE_TONNES.format(BigInt(whole))}.${decimals} t`
}
