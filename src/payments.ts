import { shiftDay, type PaymentCurrency, type PaymentInfo, type OccurrenceItem, type TaskItem } from './demo'
import { scheduledForDate, type ScheduledTask } from './schedule'

export function parsePaymentAmount(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  return amount > 0 && amount <= 1_000_000_000 ? amount : null
}

export function paymentLabel(payment: PaymentInfo): string {
  const value = payment.amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
  const symbols: Record<PaymentCurrency, string> = { GEL: '₾', USD: '$', RUB: '₽' }
  return payment.currency === 'USD' ? `${symbols.USD}${value}` : `${value} ${symbols[payment.currency]}`
}

export function upcomingPayments(tasks: TaskItem[], occurrences: OccurrenceItem[], start: string, days = 61): ScheduledTask[] {
  const result: ScheduledTask[] = []
  const bills = tasks.filter(task => task.kind === 'payment' && !!task.payment)
  for (let offset = 0; offset < days; offset += 1) {
    const date = shiftDay(start, offset)
    const rows = scheduledForDate(bills, occurrences, date)
    result.push(...rows.filter(row => !row.done))
  }
  return result
}
