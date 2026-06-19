<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createTransaction, fetchCategories, fetchDashboard } from '@/services/api'
import { clearStoredUser, getStoredUser } from '@/utils/auth'

const router = useRouter()
const user = ref(getStoredUser())
const loading = ref(false)
const errorMessage = ref('')

const dashboard = reactive({
  summary: {
    income: 0,
    expense: 0,
    balance: 0,
    net_change: 0,
    savings_rate: 0,
  },
  counts: {
    accounts: 0,
    categories: 0,
    budgets: 0,
    transactions: 0,
  },
  weeklyFlow: [],
  accounts: [],
  transactions: [],
  budgets: [],
})

const transactionModalOpen = ref(false)
const transactionSubmitting = ref(false)
const categoriesLoading = ref(false)
const categoriesError = ref('')
const transactionError = ref('')
const availableCategories = ref([])

const transactionTypes = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
]

function createTransactionFormDefaults() {
  return {
    title: '',
    amount: '',
    transaction_type: 'expense',
    account_id: '',
    category_id: '',
    transaction_date: getLocalDateInputValue(),
    description: '',
    reference: '',
  }
}

function createTransactionFieldErrors() {
  return {
    title: '',
    amount: '',
    transaction_type: '',
    account_id: '',
    category_id: '',
    transaction_date: '',
    description: '',
    reference: '',
  }
}

const transactionForm = reactive(createTransactionFormDefaults())
const transactionFieldErrors = reactive(createTransactionFieldErrors())
const scrollLockSnapshot = {
  bodyOverflow: '',
  htmlOverflow: '',
  locked: false,
}

const displayName = computed(() => user.value?.name?.trim() || 'Account holder')
const phoneNumber = computed(() => user.value?.phone || 'Not available')
const avatarLabel = computed(() => {
  const name = displayName.value.trim()
  return (name[0] || phoneNumber.value[0] || 'U').toUpperCase()
})

const todayLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date()),
)

const workspaceCopy = computed(() => {
  if (errorMessage.value) {
    return 'The live dashboard data could not be loaded from Laravel.'
  }

  if (loading.value && dashboard.accounts.length === 0) {
    return 'Fetching live dashboard data from Laravel.'
  }

  return 'Your finances are organized by account, category, transaction, and budget.'
})

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'BDT',
  maximumFractionDigits: 0,
})

const accounts = computed(() => dashboard.accounts)
const transactions = computed(() => dashboard.transactions)
const budgets = computed(() => dashboard.budgets)
const weeklyFlow = computed(() => dashboard.weeklyFlow)
const filteredCategories = computed(() =>
  availableCategories.value.filter((category) => category.type === transactionForm.transaction_type),
)
const hasAccounts = computed(() => accounts.value.length > 0)
const defaultAccountId = computed(() => {
  const preferredAccount = accounts.value.find((account) => account.is_default) || accounts.value[0]
  return preferredAccount ? String(preferredAccount.id) : ''
})

const totalBalance = computed(() => normalizeNumber(dashboard.summary.balance))
const totalIncome = computed(() => normalizeNumber(dashboard.summary.income))
const totalExpense = computed(() => normalizeNumber(dashboard.summary.expense))
const savingsRate = computed(() => normalizeNumber(dashboard.summary.savings_rate))

const latestBalanceChange = computed(() => {
  const change = normalizeNumber(dashboard.summary.net_change)
  const prefix = change >= 0 ? '+' : '-'
  return `${prefix}${formatCurrency(Math.abs(change))}`
})

const chartPeak = computed(() => {
  const values = weeklyFlow.value.flatMap((entry) => [normalizeNumber(entry.income), normalizeNumber(entry.expense)])
  return Math.max(1, ...values)
})

const topBudget = computed(() =>
  budgets.value.reduce((best, budget) => {
    if (!best) {
      return budget
    }

    return normalizeNumber(budget.progress) > normalizeNumber(best.progress) ? budget : best
  }, null),
)

function normalizeNumber(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value) {
  return currency.format(normalizeNumber(value))
}

function formatShortDate(value) {
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

function accountTypeLabel(type) {
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

function budgetPeriodLabel(period) {
  const labels = {
    weekly: 'Weekly budget',
    monthly: 'Monthly budget',
    yearly: 'Yearly budget',
    custom: 'Custom budget',
  }

  return labels[period] || 'Budget'
}

function transactionCategoryLabel(transaction) {
  return transaction?.category?.name || 'Uncategorized'
}

function budgetCategoryLabel(budget) {
  return budget?.category?.name || 'All expenses'
}

function accountAccent(account, index) {
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

function budgetAccent(index) {
  const palette = ['#5f8bff', '#39d0b4', '#ffb84d', '#ff7bbf', '#a88bff', '#6fe6a7']
  return palette[index % palette.length] || '#5f8bff'
}

function lockPageScroll() {
  if (typeof document === 'undefined') {
    return
  }

  if (!scrollLockSnapshot.locked) {
    scrollLockSnapshot.bodyOverflow = document.body.style.overflow
    scrollLockSnapshot.htmlOverflow = document.documentElement.style.overflow
    scrollLockSnapshot.locked = true
  }

  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
}

function unlockPageScroll() {
  if (typeof document === 'undefined' || !scrollLockSnapshot.locked) {
    return
  }

  document.body.style.overflow = scrollLockSnapshot.bodyOverflow
  document.documentElement.style.overflow = scrollLockSnapshot.htmlOverflow
  scrollLockSnapshot.locked = false
}

function accountInitial(name) {
  const value = (name || '').trim()
  return (value[0] || 'A').toUpperCase()
}

function accountUsage(account) {
  const usage = normalizeNumber(account?.usage)
  if (usage > 0) {
    return usage
  }

  const balance = normalizeNumber(account?.balance)
  const base = normalizeNumber(totalBalance.value)
  if (base <= 0) {
    return 0
  }

  return Math.max(0, Math.round((balance / base) * 1000) / 10)
}

function budgetRemainingLabel(budget) {
  const remaining = normalizeNumber(budget?.remaining)
  if (remaining >= 0) {
    return `${formatCurrency(remaining)} left`
  }

  return `${formatCurrency(Math.abs(remaining))} over budget`
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function resetTransactionFieldErrors() {
  Object.assign(transactionFieldErrors, createTransactionFieldErrors())
}

function clearTransactionFieldError(field) {
  if (field in transactionFieldErrors) {
    transactionFieldErrors[field] = ''
  }

  transactionError.value = ''
}

function getDefaultCategoryId() {
  const defaultCategory = filteredCategories.value[0]
  return defaultCategory ? String(defaultCategory.id) : ''
}

function syncTransactionAccountSelection() {
  if (!hasAccounts.value) {
    transactionForm.account_id = ''
    return
  }

  const selectedAccountExists = accounts.value.some(
    (account) => String(account.id) === String(transactionForm.account_id),
  )

  if (!selectedAccountExists) {
    transactionForm.account_id = defaultAccountId.value
  }
}

function syncTransactionCategorySelection() {
  const selectedCategoryExists = filteredCategories.value.some(
    (category) => String(category.id) === String(transactionForm.category_id),
  )

  if (!selectedCategoryExists) {
    transactionForm.category_id = getDefaultCategoryId()
  }
}

function handleTransactionTypeChange() {
  transactionFieldErrors.transaction_type = ''
  transactionFieldErrors.category_id = ''
  syncTransactionCategorySelection()
}

function openTransactionModal() {
  transactionError.value = ''
  categoriesError.value = ''
  resetTransactionFieldErrors()
  Object.assign(transactionForm, createTransactionFormDefaults())
  transactionForm.account_id = defaultAccountId.value
  syncTransactionCategorySelection()
  transactionModalOpen.value = true
  void loadCategories()
}

function closeTransactionModal(force = false) {
  if (transactionSubmitting.value && !force) {
    return
  }

  transactionModalOpen.value = false
  categoriesError.value = ''
  transactionError.value = ''
  resetTransactionFieldErrors()
  Object.assign(transactionForm, createTransactionFormDefaults())
  transactionForm.account_id = defaultAccountId.value
  transactionForm.category_id = ''
}

function applyTransactionValidationErrors(errors) {
  Object.entries(errors || {}).forEach(([field, value]) => {
    const message = Array.isArray(value) ? value[0] || '' : String(value || '')
    if (!message) {
      return
    }

    if (field in transactionFieldErrors) {
      transactionFieldErrors[field] = message
      return
    }

    transactionError.value = message
  })
}

async function loadCategories() {
  const userId = user.value?.id
  if (!userId) {
    return
  }

  categoriesLoading.value = true
  categoriesError.value = ''

  try {
    const response = await fetchCategories(userId)
    availableCategories.value = Array.isArray(response?.data) ? response.data : []
    syncTransactionCategorySelection()
  } catch (error) {
    categoriesError.value = error?.payload?.message || error?.message || 'Unable to load categories.'
  } finally {
    categoriesLoading.value = false
  }
}

async function submitTransaction() {
  resetTransactionFieldErrors()
  transactionError.value = ''

  if (!hasAccounts.value) {
    transactionError.value = 'Create at least one account before adding a transaction.'
    return
  }

  const userId = user.value?.id
  if (!userId) {
    transactionError.value = 'User session is missing. Please log in again.'
    return
  }

  const title = transactionForm.title.trim()
  const amount = normalizeNumber(transactionForm.amount)
  const accountId = Number(transactionForm.account_id)
  const categoryId = transactionForm.category_id ? Number(transactionForm.category_id) : null
  const transactionDate = transactionForm.transaction_date || ''
  const transactionType = transactionForm.transaction_type

  if (!title) {
    transactionFieldErrors.title = 'Enter a transaction title.'
  }

  if (amount <= 0) {
    transactionFieldErrors.amount = 'Enter an amount greater than zero.'
  }

  if (!accountId) {
    transactionFieldErrors.account_id = 'Select an account.'
  }

  if (!transactionDate) {
    transactionFieldErrors.transaction_date = 'Select a transaction date.'
  }

  if (Object.values(transactionFieldErrors).some(Boolean)) {
    return
  }

  const selectedCategoryExists = categoryId
    ? filteredCategories.value.some((category) => Number(category.id) === categoryId)
    : true

  if (!selectedCategoryExists) {
    transactionFieldErrors.category_id = `Select a ${transactionType} category or leave it blank.`
    return
  }

  transactionSubmitting.value = true

  try {
    await createTransaction(userId, {
      account_id: accountId,
      category_id: categoryId,
      transaction_type: transactionType,
      amount,
      transaction_date: transactionDate,
      title,
      description: transactionForm.description.trim() || null,
      reference: transactionForm.reference.trim() || null,
    })

    closeTransactionModal(true)
    await loadDashboard()
  } catch (error) {
    if (error?.status === 422 && error?.payload?.errors) {
      applyTransactionValidationErrors(error.payload.errors)
      return
    }

    transactionError.value = error?.payload?.message || error?.message || 'Unable to save transaction.'
  } finally {
    transactionSubmitting.value = false
  }
}

function normalizeDashboard(payload) {
  dashboard.summary = {
    income: normalizeNumber(payload?.summary?.income),
    expense: normalizeNumber(payload?.summary?.expense),
    balance: normalizeNumber(payload?.summary?.balance),
    net_change: normalizeNumber(payload?.summary?.net_change),
    savings_rate: normalizeNumber(payload?.summary?.savings_rate),
  }

  dashboard.counts = {
    accounts: normalizeNumber(payload?.counts?.accounts),
    categories: normalizeNumber(payload?.counts?.categories),
    budgets: normalizeNumber(payload?.counts?.budgets),
    transactions: normalizeNumber(payload?.counts?.transactions),
  }

  dashboard.weeklyFlow = Array.isArray(payload?.weekly_flow) ? payload.weekly_flow : []
  dashboard.accounts = Array.isArray(payload?.accounts) ? payload.accounts : []
  dashboard.transactions = Array.isArray(payload?.recent_transactions) ? payload.recent_transactions : []
  dashboard.budgets = Array.isArray(payload?.budgets) ? payload.budgets : []
}

async function loadDashboard() {
  const userId = user.value?.id
  if (!userId) {
    router.replace({ name: 'login' })
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetchDashboard(userId)
    normalizeDashboard(response?.data)
    if (transactionModalOpen.value) {
      syncTransactionAccountSelection()
      syncTransactionCategorySelection()
    }
  } catch (error) {
    errorMessage.value = error?.payload?.message || error?.message || 'Unable to load dashboard data.'
  } finally {
    loading.value = false
  }
}

function signOut() {
  clearStoredUser()
  router.replace({ name: 'login' })
}

watch(transactionModalOpen, (isOpen) => {
  if (isOpen) {
    lockPageScroll()
    return
  }

  unlockPageScroll()
}, { immediate: true })

onBeforeUnmount(() => {
  unlockPageScroll()
})

onMounted(loadDashboard)
</script>

<template>
  <main class="dashboard-page">
    <section class="dashboard-shell">
      <aside class="dashboard-rail">
        <div class="rail-brand">
          <div class="brand-mark">ET</div>
          <div>
            <p class="brand-kicker">Expense tracker</p>
            <h1>Dashboard</h1>
          </div>
        </div>

        <div class="profile-card">
          <div class="avatar">{{ avatarLabel }}</div>
          <div>
            <p class="profile-label">Signed in as</p>
            <h2>{{ displayName }}</h2>
            <p class="profile-meta">{{ phoneNumber }}</p>
          </div>
        </div>

        <nav class="rail-nav" aria-label="Dashboard sections">
          <RouterLink
            :to="{ name: 'dashboard' }"
            class="rail-link"
            active-class="active"
            exact-active-class="active"
          >
            Overview
          </RouterLink>
          <RouterLink
            :to="{ name: 'accounts' }"
            class="rail-link"
            active-class="active"
            exact-active-class="active"
          >
            Accounts
          </RouterLink>
          <RouterLink
            :to="{ name: 'categories' }"
            class="rail-link"
            active-class="active"
            exact-active-class="active"
          >
            Categories
          </RouterLink>
          <RouterLink
            :to="{ name: 'transactions' }"
            class="rail-link"
            active-class="active"
            exact-active-class="active"
          >
            Transactions
          </RouterLink>
          <RouterLink
            :to="{ name: 'budgets' }"
            class="rail-link"
            active-class="active"
            exact-active-class="active"
          >
            Budgets
          </RouterLink>
        </nav>

        <button class="signout-button" type="button" @click="signOut">Sign out</button>
      </aside>

      <section class="dashboard-workspace">
        <div v-if="errorMessage" class="dashboard-alert" role="alert">
          <span>{{ errorMessage }}</span>
          <button type="button" class="alert-button" @click="loadDashboard">Retry</button>
        </div>

        <header class="topbar" id="overview">
          <div>
            <p class="eyebrow">{{ todayLabel }}</p>
            <h2>Welcome back, {{ displayName }}</h2>
            <p class="topbar-copy">{{ workspaceCopy }}</p>
            <div class="topbar-stats">
              <span class="stat-pill">{{ dashboard.counts.accounts }} accounts</span>
              <span class="stat-pill">{{ dashboard.counts.categories }} categories</span>
              <span class="stat-pill">{{ dashboard.counts.budgets }} budgets</span>
              <span class="stat-pill">{{ dashboard.counts.transactions }} transactions</span>
            </div>
          </div>

          <div class="topbar-actions">
            <button class="ghost-button" type="button">Export</button>
            <button class="primary-button" type="button" @click="openTransactionModal">Add transaction</button>
          </div>
        </header>

        <section class="metrics-grid">
          <article class="metric-card metric-card-large">
            <p class="metric-label">Net balance</p>
            <div class="metric-value-row">
              <h3>{{ formatCurrency(totalBalance) }}</h3>
              <span class="metric-chip positive">{{ latestBalanceChange }}</span>
            </div>
            <p class="metric-note">Across {{ dashboard.counts.accounts }} linked accounts</p>
            <div class="metric-strip">
              <div class="metric-strip-fill" :style="{ width: `${Math.min(100, savingsRate)}%` }"></div>
            </div>
          </article>

          <article class="metric-card">
            <p class="metric-label">Income</p>
            <h3>{{ formatCurrency(totalIncome) }}</h3>
            <p class="metric-note">This month</p>
          </article>

          <article class="metric-card">
            <p class="metric-label">Expenses</p>
            <h3>{{ formatCurrency(totalExpense) }}</h3>
            <p class="metric-note">This month</p>
          </article>

          <article class="metric-card">
            <p class="metric-label">Savings rate</p>
            <h3>{{ savingsRate }}%</h3>
            <p class="metric-note">Compared with income</p>
          </article>
        </section>

        <section class="content-grid">
          <article class="panel chart-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Cash flow</p>
                <h3>Weekly movement</h3>
              </div>
              <div class="panel-badge chart-badge" aria-label="Income versus expense">
                <span class="chart-badge-income">Income</span>
                <span class="chart-badge-separator">vs</span>
                <span class="chart-badge-expense">Expense</span>
              </div>
            </div>

            <div v-if="weeklyFlow.length" class="chart">
              <div v-for="day in weeklyFlow" :key="day.date" class="chart-column">
                <div class="chart-stacks">
                  <div
                    class="chart-bar income"
                    :style="{ height: `${Math.max(16, (normalizeNumber(day.income) / chartPeak) * 100)}%` }"
                    :title="`${day.label} income ${formatCurrency(day.income)}`"
                  ></div>
                  <div
                    class="chart-bar expense"
                    :style="{ height: `${Math.max(16, (normalizeNumber(day.expense) / chartPeak) * 100)}%` }"
                    :title="`${day.label} expense ${formatCurrency(day.expense)}`"
                  ></div>
                </div>
                <div class="chart-labels">
                  <span>{{ day.label }}</span>
                  <small>{{ formatCurrency(normalizeNumber(day.income) - normalizeNumber(day.expense)) }}</small>
                </div>
              </div>
            </div>

            <div v-else class="empty-state">
              No transaction activity yet.
            </div>
          </article>

          <article class="panel accounts-panel" id="accounts">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Accounts</p>
                <h3>Money in motion</h3>
              </div>
              <span class="panel-badge">{{ dashboard.counts.accounts }} accounts</span>
            </div>

            <div v-if="accounts.length" class="account-list">
              <article
                v-for="(account, index) in accounts"
                :key="account.id"
                class="account-row"
              >
                <div class="account-icon" :style="{ '--accent': accountAccent(account, index) }">
                  {{ accountInitial(account.name) }}
                </div>
                <div class="account-copy">
                  <div class="account-title-row">
                    <h4>{{ account.name }}</h4>
                    <span>{{ formatCurrency(account.balance) }}</span>
                  </div>
                  <p>{{ accountTypeLabel(account.type) }}</p>
                </div>
                <div class="account-meter">
                  <div
                    class="account-meter-fill"
                    :style="{ width: `${accountUsage(account)}%`, '--accent': accountAccent(account, index) }"
                  ></div>
                </div>
              </article>
            </div>

            <div v-else class="empty-state">
              No accounts have been created yet.
            </div>
          </article>
        </section>

        <section class="bottom-grid">
          <article class="panel transactions-panel" id="transactions">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Recent activity</p>
                <h3>Latest transactions</h3>
              </div>
              <span class="panel-badge">{{ dashboard.counts.transactions }} entries</span>
            </div>

            <div v-if="transactions.length" class="transaction-list">
              <article
                v-for="transaction in transactions"
                :key="transaction.id"
                class="transaction-row"
              >
                <div class="transaction-mark" :class="transaction.transaction_type">
                  {{ transaction.transaction_type === 'income' ? '+' : '-' }}
                </div>
                <div class="transaction-copy">
                  <div class="transaction-title-row">
                    <h4>{{ transaction.title }}</h4>
                    <strong :class="transaction.transaction_type">
                      {{ transaction.transaction_type === 'income' ? '+' : '-' }}{{ formatCurrency(transaction.amount) }}
                    </strong>
                  </div>
                  <p>{{ transactionCategoryLabel(transaction) }} | {{ formatShortDate(transaction.transaction_date) }}</p>
                </div>
              </article>
            </div>

            <div v-else class="empty-state">
              No recent transactions yet.
            </div>
          </article>

          <article class="panel budgets-panel" id="budgets">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Budgets</p>
                <h3>Spending limits</h3>
              </div>
              <span class="panel-badge">
                {{ topBudget ? `${budgetCategoryLabel(topBudget)} highest` : 'No budgets yet' }}
              </span>
            </div>

            <div v-if="budgets.length" class="budget-list">
              <article v-for="(budget, index) in budgets" :key="budget.id" class="budget-row">
                <div class="budget-row-top">
                  <div>
                    <h4>{{ budgetCategoryLabel(budget) }}</h4>
                    <p>{{ budgetPeriodLabel(budget.period) }} | {{ formatCurrency(budget.spent) }} spent</p>
                  </div>
                  <strong>{{ Math.round(normalizeNumber(budget.progress)) }}%</strong>
                </div>
                <div class="budget-track">
                  <div
                    class="budget-fill"
                    :style="{
                      width: `${Math.min(100, normalizeNumber(budget.progress))}%`,
                      '--accent': budgetAccent(index),
                    }"
                  ></div>
                </div>
                <p class="budget-footer">
                  {{ budgetRemainingLabel(budget) }}
                </p>
              </article>
            </div>

            <div v-else class="empty-state">
              No budgets are available yet.
            </div>
          </article>
        </section>
      </section>
    </section>

    <transition name="fade">
      <div
        v-if="transactionModalOpen"
        class="modal-backdrop"
        role="presentation"
        @click.self="closeTransactionModal"
      >
        <section
          class="transaction-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transaction-modal-title"
        >
          <aside class="modal-summary">
            <div class="modal-summary-header">
              <p class="eyebrow">Quick entry</p>
              <h3 id="transaction-modal-title">Add transaction</h3>
              <p class="modal-summary-copy">
                Record a new income or expense against one of the user-owned accounts.
              </p>
            </div>

            <div class="modal-summary-grid">
              <article>
                <span>Total balance</span>
                <strong>{{ formatCurrency(totalBalance) }}</strong>
              </article>
              <article>
                <span>Accounts</span>
                <strong>{{ dashboard.counts.accounts }}</strong>
              </article>
              <article>
                <span>Categories</span>
                <strong>{{ dashboard.counts.categories }}</strong>
              </article>
              <article>
                <span>Transactions</span>
                <strong>{{ dashboard.counts.transactions }}</strong>
              </article>
            </div>

            <p v-if="!hasAccounts" class="modal-note warning">
              Create an account before recording a transaction.
            </p>
            <p v-else class="modal-note">
              Income categories should be used for deposits. Expense categories should be used for
              spending.
            </p>
          </aside>

          <form class="transaction-form" @submit.prevent="submitTransaction" novalidate>
            <div v-if="transactionError" class="form-alert" role="alert">
              {{ transactionError }}
            </div>

            <div class="form-grid">
              <label class="field field-span-2">
                <span>Title</span>
                <input
                  v-model="transactionForm.title"
                  type="text"
                  name="title"
                  placeholder="Salary, grocery, rent, transport..."
                  @input="clearTransactionFieldError('title')"
                />
                <small v-if="transactionFieldErrors.title" class="field-error">
                  {{ transactionFieldErrors.title }}
                </small>
              </label>

              <label class="field">
                <span>Transaction type</span>
                <select
                  v-model="transactionForm.transaction_type"
                  name="transaction_type"
                  @change="handleTransactionTypeChange"
                >
                  <option v-for="option in transactionTypes" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <small v-if="transactionFieldErrors.transaction_type" class="field-error">
                  {{ transactionFieldErrors.transaction_type }}
                </small>
              </label>

              <label class="field">
                <span>Amount</span>
                <input
                  v-model="transactionForm.amount"
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  inputmode="decimal"
                  placeholder="0.00"
                  @input="clearTransactionFieldError('amount')"
                />
                <small v-if="transactionFieldErrors.amount" class="field-error">
                  {{ transactionFieldErrors.amount }}
                </small>
              </label>

              <label class="field">
                <span>Account</span>
                <select
                  v-model="transactionForm.account_id"
                  name="account_id"
                  :disabled="!hasAccounts || transactionSubmitting"
                  @change="clearTransactionFieldError('account_id')"
                >
                  <option value="">{{ hasAccounts ? 'Choose an account' : 'No accounts available' }}</option>
                  <option v-for="account in accounts" :key="account.id" :value="String(account.id)">
                    {{ account.name }} - {{ formatCurrency(account.balance) }}
                  </option>
                </select>
                <small v-if="transactionFieldErrors.account_id" class="field-error">
                  {{ transactionFieldErrors.account_id }}
                </small>
              </label>

              <label class="field">
                <span>Date</span>
                <input
                  v-model="transactionForm.transaction_date"
                  type="date"
                  name="transaction_date"
                  @input="clearTransactionFieldError('transaction_date')"
                />
                <small v-if="transactionFieldErrors.transaction_date" class="field-error">
                  {{ transactionFieldErrors.transaction_date }}
                </small>
              </label>

              <label class="field">
                <span>Category</span>
                <select
                  v-model="transactionForm.category_id"
                  name="category_id"
                  :disabled="categoriesLoading || !hasAccounts"
                  @change="clearTransactionFieldError('category_id')"
                >
                  <option value="">
                    {{ categoriesLoading ? 'Loading categories...' : 'No category' }}
                  </option>
                  <option v-for="category in filteredCategories" :key="category.id" :value="String(category.id)">
                    {{ category.name }}
                  </option>
                </select>
                <small v-if="categoriesError" class="field-error">{{ categoriesError }}</small>
                <small v-else-if="!categoriesLoading && filteredCategories.length === 0" class="field-hint">
                  No {{ transactionForm.transaction_type }} categories yet.
                </small>
                <small v-if="transactionFieldErrors.category_id" class="field-error">
                  {{ transactionFieldErrors.category_id }}
                </small>
              </label>

              <label class="field field-span-2">
                <span>Description</span>
                <textarea
                  v-model="transactionForm.description"
                  rows="3"
                  name="description"
                  placeholder="Optional details for the record"
                  @input="clearTransactionFieldError('description')"
                ></textarea>
                <small v-if="transactionFieldErrors.description" class="field-error">
                  {{ transactionFieldErrors.description }}
                </small>
              </label>

              <label class="field field-span-2">
                <span>Reference</span>
                <input
                  v-model="transactionForm.reference"
                  type="text"
                  name="reference"
                  placeholder="Receipt, invoice, or payment reference"
                  @input="clearTransactionFieldError('reference')"
                />
                <small v-if="transactionFieldErrors.reference" class="field-error">
                  {{ transactionFieldErrors.reference }}
                </small>
              </label>
            </div>

            <div class="form-actions">
              <button class="ghost-button" type="button" @click="closeTransactionModal">
                Cancel
              </button>
              <button class="submit-button" type="submit" :disabled="transactionSubmitting">
                <span v-if="transactionSubmitting" class="spinner" aria-hidden="true"></span>
                {{ transactionSubmitting ? 'Saving...' : 'Save transaction' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </transition>
  </main>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  padding: clamp(1rem, 2.5vw, 2rem);
  position: relative;
  overflow: hidden;
}

.dashboard-page::before,
.dashboard-page::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  filter: blur(18px);
  pointer-events: none;
}

.dashboard-page::before {
  width: 26rem;
  height: 26rem;
  right: -10rem;
  top: -8rem;
  background: radial-gradient(circle, rgba(59, 126, 255, 0.2), transparent 66%);
}

.dashboard-page::after {
  width: 20rem;
  height: 20rem;
  left: -8rem;
  bottom: -8rem;
  background: radial-gradient(circle, rgba(57, 208, 180, 0.16), transparent 68%);
}

.dashboard-shell {
  position: relative;
  z-index: 1;
  width: min(100%, 80rem);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  gap: 1rem;
}

.dashboard-rail,
.topbar,
.metric-card,
.panel {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(8, 17, 31, 0.72);
  backdrop-filter: blur(22px);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
}

.dashboard-rail {
  border-radius: 1.5rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.rail-brand {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.brand-mark {
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #4c7dff, #39d0b4);
  color: #08111f;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.brand-kicker,
.eyebrow,
.metric-label,
.profile-label {
  margin: 0 0 0.3rem;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 0.72rem;
  color: rgba(232, 237, 247, 0.56);
}

.rail-brand h1,
.profile-card h2,
.topbar h2,
.panel h3,
.metric-card h3,
.account-title-row h4,
.transaction-title-row h4,
.budget-row-top h4 {
  margin: 0;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.profile-card {
  padding: 1rem;
  border-radius: 1.2rem;
  background:
    radial-gradient(circle at top right, rgba(72, 129, 255, 0.18), transparent 46%),
    rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.9rem;
  align-items: center;
}

.avatar,
.account-icon,
.transaction-mark {
  display: grid;
  place-items: center;
  border-radius: 1rem;
  font-weight: 800;
}

.avatar {
  width: 3rem;
  height: 3rem;
  background: linear-gradient(135deg, #4c7dff, #39d0b4);
  color: #08111f;
  font-size: 1.05rem;
}

.profile-meta,
.topbar-copy,
.metric-note,
.account-copy p,
.transaction-copy p,
.budget-row-top p {
  margin: 0;
  color: rgba(232, 237, 247, 0.72);
}

.dashboard-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 1.2rem;
  background: rgba(225, 87, 87, 0.12);
  border: 1px solid rgba(225, 87, 87, 0.22);
  color: #ffd0d0;
}

.alert-button {
  padding: 0.7rem 0.95rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #f4f7fc;
}

.topbar-stats {
  margin-top: 0.85rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.stat-pill {
  padding: 0.42rem 0.7rem;
  border-radius: 999px;
  font-size: 0.82rem;
  color: rgba(232, 237, 247, 0.76);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.rail-nav {
  display: grid;
  gap: 0.45rem;
}

.rail-link {
  padding: 0.85rem 0.95rem;
  border-radius: 0.95rem;
  color: rgba(232, 237, 247, 0.82);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.rail-link:hover,
.rail-link.active {
  border-color: rgba(93, 148, 255, 0.4);
  background: rgba(93, 148, 255, 0.12);
  transform: translateX(2px);
}

.signout-button,
.ghost-button,
.primary-button {
  min-height: 2.9rem;
  border-radius: 1rem;
  border: 1px solid transparent;
  font-weight: 700;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.signout-button {
  margin-top: auto;
  background: rgba(255, 255, 255, 0.03);
  color: #f4f7fc;
  border-color: rgba(255, 255, 255, 0.08);
}

.signout-button:hover,
.ghost-button:hover {
  transform: translateY(-1px);
  border-color: rgba(93, 148, 255, 0.35);
}

.dashboard-workspace {
  display: grid;
  gap: 1rem;
}

.topbar {
  border-radius: 1.5rem;
  padding: 1.35rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.topbar h2 {
  font-size: clamp(1.8rem, 3vw, 2.4rem);
}

.topbar-copy {
  max-width: 42rem;
  margin-top: 0.35rem;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.ghost-button,
.primary-button {
  padding: 0.85rem 1.05rem;
  color: #f4f7fc;
}

.ghost-button {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08);
}

.primary-button {
  background: linear-gradient(135deg, #4c7dff, #39d0b4);
  color: #08111f;
  box-shadow: 0 18px 36px rgba(56, 129, 255, 0.28);
}

.primary-button:hover {
  transform: translateY(-1px);
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1.2fr repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.metric-card {
  border-radius: 1.4rem;
  padding: 1.25rem;
}

.metric-card-large {
  background:
    radial-gradient(circle at top right, rgba(72, 129, 255, 0.2), transparent 45%),
    rgba(8, 17, 31, 0.82);
}

.metric-label {
  color: rgba(232, 237, 247, 0.56);
}

.metric-value-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.metric-card h3 {
  font-size: clamp(1.45rem, 2vw, 2.15rem);
}

.metric-chip {
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 800;
}

.metric-chip.positive {
  background: rgba(57, 208, 180, 0.14);
  color: #7fe4cf;
}

.metric-strip {
  margin-top: 0.95rem;
  width: 100%;
  height: 0.55rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.metric-strip-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5f8bff, #39d0b4);
}

.content-grid,
.bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.9fr);
  gap: 1rem;
}

.panel {
  border-radius: 1.45rem;
  padding: 1.25rem;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.panel-badge {
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  color: rgba(232, 237, 247, 0.82);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
}

.chart-badge {
  display: flex;
  align-items: center;
  gap: 0.28rem;
}

.chart-badge-income {
  color: #7ea0ff;
}

.chart-badge-separator {
  color: rgba(232, 237, 247, 0.56);
}

.chart-badge-expense {
  color: #71e7d0;
}

.chart-badge-income,
.chart-badge-separator,
.chart-badge-expense {
  font-size: 0.8rem;
  font-weight: 700;
}

.empty-state {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(232, 237, 247, 0.64);
  text-align: center;
}

.chart {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  align-items: end;
  gap: 0.8rem;
  min-height: 18rem;
}

.chart-column {
  display: grid;
  gap: 0.8rem;
  justify-items: center;
}

.chart-stacks {
  width: 100%;
  height: 14rem;
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.4rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.03);
}

.chart-bar {
  width: 1rem;
  border-radius: 999px;
  min-height: 1rem;
}

.chart-bar.income {
  background: linear-gradient(180deg, #5f8bff, #7ea0ff);
}

.chart-bar.expense {
  background: linear-gradient(180deg, #39d0b4, #71e7d0);
}

.chart-labels {
  display: grid;
  gap: 0.1rem;
  text-align: center;
  color: rgba(232, 237, 247, 0.78);
}

.chart-labels small {
  color: rgba(232, 237, 247, 0.52);
}

.account-list,
.transaction-list,
.budget-list {
  display: grid;
  gap: 0.8rem;
}

.account-row,
.transaction-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  padding: 0.9rem;
  border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.account-icon {
  width: 2.75rem;
  height: 2.75rem;
  background: rgba(255, 255, 255, 0.05);
  color: var(--accent);
  border: 1px solid var(--accent);
}

.account-copy,
.transaction-copy {
  min-width: 0;
}

.account-title-row,
.transaction-title-row,
.budget-row-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.account-title-row span,
.transaction-title-row strong,
.budget-row-top strong {
  white-space: nowrap;
  font-weight: 800;
}

.account-meter,
.budget-track {
  grid-column: 1 / -1;
  height: 0.45rem;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}

.account-meter-fill,
.budget-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), rgba(255, 255, 255, 0.35));
}

.transaction-mark {
  width: 2.75rem;
  height: 2.75rem;
  font-size: 1rem;
}

.transaction-mark.income {
  background: rgba(57, 208, 180, 0.14);
  color: #7fe4cf;
}

.transaction-mark.expense {
  background: rgba(255, 184, 77, 0.14);
  color: #ffcc80;
}

.transaction-title-row strong.income {
  color: #7fe4cf;
}

.transaction-title-row strong.expense {
  color: #ffcc80;
}

.budget-row {
  padding: 0.95rem;
  border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.budget-row-top {
  margin-bottom: 0.7rem;
}

.budget-track {
  height: 0.5rem;
}

.budget-footer {
  margin: 0.55rem 0 0;
  color: rgba(232, 237, 247, 0.62);
  font-size: 0.9rem;
}

.field {
  display: grid;
  gap: 0.55rem;
}

.field > span {
  font-size: 0.92rem;
  color: rgba(232, 237, 247, 0.82);
}

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 0.92rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.04);
  color: #f6f8fd;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.field select option {
  background: #0a1424;
  color: #f6f8fd;
}

.field textarea {
  min-height: 7.5rem;
  resize: vertical;
}

.field input::placeholder,
.field textarea::placeholder {
  color: rgba(232, 237, 247, 0.35);
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: rgba(93, 148, 255, 0.62);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 4px rgba(75, 122, 255, 0.12);
}

.field-error {
  color: #ffb1b1;
  font-size: 0.88rem;
}

.field-hint {
  color: rgba(232, 237, 247, 0.58);
  font-size: 0.88rem;
}

.field-span-2 {
  grid-column: span 2;
}

.form-alert {
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  background: rgba(225, 87, 87, 0.12);
  border: 1px solid rgba(225, 87, 87, 0.24);
  color: #ffd0d0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.form-actions {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.submit-button {
  min-height: 2.9rem;
  padding: 0.85rem 1.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  border: 0;
  border-radius: 1rem;
  background: linear-gradient(135deg, #4c7dff, #39d0b4);
  color: #08111f;
  font-weight: 800;
  box-shadow: 0 18px 36px rgba(56, 129, 255, 0.28);
  transition:
    transform 0.2s ease,
    opacity 0.2s ease,
    box-shadow 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 22px 44px rgba(56, 129, 255, 0.34);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  box-shadow: none;
}

.spinner {
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 999px;
  border: 2px solid rgba(8, 17, 31, 0.26);
  border-top-color: rgba(8, 17, 31, 0.92);
  animation: spin 0.8s linear infinite;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 3vw, 2rem);
  background: rgba(5, 10, 18, 0.68);
  backdrop-filter: blur(10px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.transaction-modal {
  width: min(100%, 68rem);
  height: min(calc(100vh - 2rem), 52rem);
  height: min(calc(100dvh - 2rem), 52rem);
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(260px, 0.85fr) minmax(0, 1.15fr);
  border-radius: 1.7rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(8, 17, 31, 0.92);
  box-shadow: 0 38px 120px rgba(0, 0, 0, 0.42);
}

.modal-summary {
  padding: 1.4rem;
  display: grid;
  align-content: start;
  gap: 1rem;
  background:
    radial-gradient(circle at top right, rgba(72, 129, 255, 0.18), transparent 50%),
    rgba(255, 255, 255, 0.03);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  overflow-y: auto;
  min-height: 0;
  overscroll-behavior: contain;
}

.modal-summary-header h3 {
  margin: 0;
  font-size: 1.85rem;
}

.modal-summary-copy {
  margin: 0.35rem 0 0;
  color: rgba(232, 237, 247, 0.72);
}

.modal-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.modal-summary-grid article {
  padding: 0.9rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-summary-grid span {
  display: block;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(232, 237, 247, 0.56);
}

.modal-summary-grid strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.35rem;
}

.modal-note {
  margin: 0;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(232, 237, 247, 0.72);
}

.modal-note.warning {
  background: rgba(225, 87, 87, 0.12);
  border-color: rgba(225, 87, 87, 0.24);
  color: #ffd0d0;
}

.transaction-form {
  padding: 1.4rem;
  display: grid;
  align-content: start;
  overflow-y: auto;
  min-height: 0;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 1120px) {
  .dashboard-shell {
    grid-template-columns: 1fr;
  }

  .dashboard-rail {
    grid-template-columns: 1fr;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .content-grid,
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .transaction-modal {
    display: flex;
    flex-direction: column;
    height: min(calc(100dvh - 1.5rem), 52rem);
  }

  .modal-summary {
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    max-height: 42%;
  }

  .transaction-form {
    flex: 1 1 auto;
  }
}

@media (max-width: 720px) {
  .dashboard-page {
    padding: 0.85rem;
  }

  .dashboard-alert {
    flex-direction: column;
    align-items: flex-start;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .topbar-actions {
    width: 100%;
  }

  .ghost-button,
  .primary-button {
    flex: 1 1 0;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: span 1;
  }

  .form-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .submit-button,
  .form-actions .ghost-button {
    width: 100%;
  }

  .panel-heading,
  .account-title-row,
  .transaction-title-row,
  .budget-row-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .chart {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .chart {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .chart-stacks {
    height: 11rem;
  }

  .modal-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
