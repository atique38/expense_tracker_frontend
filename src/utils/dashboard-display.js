const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'BDT',
  maximumFractionDigits: 0,
})

export function normalizeNumber(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

export function formatCurrency(value) {
  return currencyFormatter.format(normalizeNumber(value))
}

export function formatShortDate(value) {
  if (!value) {
    return 'Not available'
  }

  const [year, month, day] = String(value)
    .split('-')
    .map((segment) => Number(segment))

  if (!year || !month || !day) {
    return 'Not available'
  }

  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function accountTypeLabel(type) {
  const labels = {
    cash: 'Cash account',
    bank: 'Bank account',
    card: 'Card account',
    bkash: 'bKash wallet',
    nagad: 'Nagad wallet',
    rocket: 'Rocket wallet',
    other: 'Other account',
  }

  return labels[type] || 'Account'
}

export function budgetPeriodLabel(period) {
  const labels = {
    weekly: 'Weekly budget',
    monthly: 'Monthly budget',
    yearly: 'Yearly budget',
    custom: 'Custom budget',
  }

  return labels[period] || 'Budget'
}

export function transactionCategoryLabel(transaction) {
  return transaction?.category?.name || 'Uncategorized'
}

export function transactionAccountLabel(transaction) {
  return transaction?.account?.name || 'Unassigned account'
}

export function budgetCategoryLabel(budget) {
  return budget?.category?.name || 'All expenses'
}

export function accountInitial(name) {
  const value = (name || '').trim()
  return (value[0] || 'A').toUpperCase()
}

export function accountAccent(account, index) {
  const palette = {
    cash: '#5f8bff',
    bank: '#39d0b4',
    card: '#ffb84d',
    bkash: '#ff7bbf',
    nagad: '#6fe6a7',
    rocket: '#a88bff',
    other: '#9aa4b2',
  }

  return palette[account?.type] || ['#5f8bff', '#39d0b4', '#ffb84d', '#ff7bbf'][index % 4]
}

export function budgetAccent(index) {
  const palette = ['#5f8bff', '#39d0b4', '#ffb84d', '#ff7bbf', '#a88bff', '#6fe6a7']
  return palette[index % palette.length] || '#5f8bff'
}

export function budgetRemainingLabel(budget) {
  const remaining = normalizeNumber(budget?.remaining)

  if (remaining < 0) {
    return `${formatCurrency(Math.abs(remaining))} over budget`
  }

  return `${formatCurrency(remaining)} remaining`
}
