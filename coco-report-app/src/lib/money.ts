/** PLN with visible thousands commas: 1,081,769.27 zł */
export function formatPln(amount: number): string {
  const value = Number(amount) || 0
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return `${formatted} zł`
}
