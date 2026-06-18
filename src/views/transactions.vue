<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DashboardShell from '@/components/DashboardShell.vue'
import {
  deleteTransaction as deleteTransactionRequest,
  fetchCategories,
  fetchDashboard,
  fetchTransactions,
  updateTransaction as updateTransactionRequest,
} from '@/services/api'
import { getStoredUser } from '@/utils/auth'
import {
  formatCurrency,
  formatShortDate,
  transactionAccountLabel,
  transactionCategoryLabel,
} from '@/utils/dashboard-display'

const router = useRouter()
const user = ref(getStoredUser())
const loading = ref(false)
const errorMessage = ref('')
const transactions = ref([])
const availableAccounts = ref([])
const availableCategories = ref([])
const transactionSubmitting = ref(false)
const transactionModalOpen = ref(false)
const transactionError = ref('')
const editingTransactionId = ref(null)
const scrollLockSnapshot = {
  bodyOverflow: '',
  htmlOverflow: '',
  locked: false,
}

const transactionTypes = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
]

function createTransactionFormDefaults(transaction = null) {
  const accountId = transaction?.account?.id ?? transaction?.account_id ?? ''
  const categoryId = transaction?.category?.id ?? transaction?.category_id ?? ''

  return {
    title: transaction?.title ? String(transaction.title) : '',
    amount: transaction?.amount !== undefined && transaction?.amount !== null ? String(transaction.amount) : '',
    transaction_type: transaction?.transaction_type || 'expense',
    account_id: accountId ? String(accountId) : '',
    category_id: categoryId ? String(categoryId) : '',
    transaction_date: transaction?.transaction_date ? String(transaction.transaction_date).slice(0, 10) : '',
    description: transaction?.description ? String(transaction.description) : '',
    reference: transaction?.reference ? String(transaction.reference) : '',
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

const transactionCount = computed(() => transactions.value.length)
const derivedAccounts = computed(() => {
  const seen = new Set()
  const items = []

  transactions.value.forEach((transaction) => {
    const account = transaction?.account
    const accountId = account?.id || transaction?.account_id
    if (!accountId) {
      return
    }

    const key = String(accountId)
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    items.push({
      id: account?.id || accountId,
      name: account?.name || 'Account',
      type: account?.type || 'other',
      balance: account?.balance,
      currency: account?.currency,
      opening_balance: account?.opening_balance,
      is_default: account?.is_default,
    })
  })

  return items
})
const derivedCategories = computed(() => {
  const seen = new Set()
  const items = []

  transactions.value.forEach((transaction) => {
    const category = transaction?.category
    const categoryId = category?.id || transaction?.category_id
    if (!categoryId) {
      return
    }

    const key = String(categoryId)
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    items.push({
      id: category?.id || categoryId,
      name: category?.name || 'Category',
      type: category?.type || transaction?.transaction_type || 'expense',
    })
  })

  return items
})
const accountOptions = computed(() => mergeOptions(availableAccounts.value, derivedAccounts.value))
const categoryOptions = computed(() => mergeOptions(availableCategories.value, derivedCategories.value))
const filteredCategories = computed(() =>
  categoryOptions.value.filter((category) => category.type === transactionForm.transaction_type),
)
const hasAccounts = computed(() => accountOptions.value.length > 0)
const defaultAccountId = computed(() => {
  const preferredAccount = accountOptions.value.find((account) => account.is_default) || accountOptions.value[0]
  return preferredAccount ? String(preferredAccount.id) : ''
})

function mergeOptions(primary, fallback) {
  const seen = new Set()

  return [...(primary || []), ...(fallback || [])].filter((item) => {
    const key = String(item?.id || '')
    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
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

function syncTransactionCategorySelection() {
  const selectedCategoryExists = filteredCategories.value.some(
    (category) => String(category.id) === String(transactionForm.category_id),
  )

  if (!selectedCategoryExists) {
    transactionForm.category_id = getDefaultCategoryId()
  }
}

function syncTransactionAccountSelection() {
  if (!hasAccounts.value) {
    transactionForm.account_id = ''
    return
  }

  const selectedAccountExists = accountOptions.value.some(
    (account) => String(account.id) === String(transactionForm.account_id),
  )

  if (!selectedAccountExists) {
    transactionForm.account_id = defaultAccountId.value
  }
}

function handleTransactionTypeChange() {
  transactionFieldErrors.transaction_type = ''
  transactionFieldErrors.category_id = ''
  syncTransactionCategorySelection()
}

function openEditTransaction(transaction) {
  transactionError.value = ''
  resetTransactionFieldErrors()
  editingTransactionId.value = transaction.id
  Object.assign(transactionForm, createTransactionFormDefaults(transaction))
  transactionModalOpen.value = true
  syncTransactionAccountSelection()
  syncTransactionCategorySelection()
}

function closeTransactionModal(force = false) {
  if (transactionSubmitting.value && !force) {
    return
  }

  transactionModalOpen.value = false
  transactionError.value = ''
  editingTransactionId.value = null
  resetTransactionFieldErrors()
  Object.assign(transactionForm, createTransactionFormDefaults())
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

async function loadTransactionData() {
  const userId = user.value?.id
  if (!userId) {
    router.replace({ name: 'login' })
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const [transactionsResult, dashboardResult, categoriesResult] = await Promise.allSettled([
      fetchTransactions(userId),
      fetchDashboard(userId),
      fetchCategories(userId),
    ])

    if (transactionsResult.status === 'fulfilled') {
      transactions.value = Array.isArray(transactionsResult.value?.data) ? transactionsResult.value.data : []
    } else {
      throw transactionsResult.reason
    }

    if (dashboardResult.status === 'fulfilled') {
      const dashboardData = dashboardResult.value?.data
      availableAccounts.value = Array.isArray(dashboardData?.accounts) ? dashboardData.accounts : []
    }

    if (categoriesResult.status === 'fulfilled') {
      availableCategories.value = Array.isArray(categoriesResult.value?.data)
        ? categoriesResult.value.data
        : []
    }

    if (transactionModalOpen.value) {
      syncTransactionAccountSelection()
      syncTransactionCategorySelection()
    }
  } catch (error) {
    errorMessage.value = error?.payload?.message || error?.message || 'Unable to load transactions.'
  } finally {
    loading.value = false
  }
}

async function submitTransaction() {
  resetTransactionFieldErrors()
  transactionError.value = ''

  const userId = user.value?.id
  if (!userId) {
    transactionError.value = 'User session is missing. Please log in again.'
    return
  }

  if (!editingTransactionId.value) {
    transactionError.value = 'Select a transaction to edit.'
    return
  }

  const title = transactionForm.title.trim()
  const amount = Number(transactionForm.amount)
  const accountId = transactionForm.account_id ? Number(transactionForm.account_id) : 0
  const categoryId = transactionForm.category_id ? Number(transactionForm.category_id) : null
  const transactionDate = transactionForm.transaction_date || ''
  const transactionType = transactionForm.transaction_type

  if (!title) {
    transactionFieldErrors.title = 'Enter a transaction title.'
  }

  if (!Number.isFinite(amount) || amount <= 0) {
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

  const selectedAccountExists = accountOptions.value.some((account) => Number(account.id) === accountId)
  if (!selectedAccountExists) {
    transactionFieldErrors.account_id = 'Select an account.'
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
    await updateTransactionRequest(userId, editingTransactionId.value, {
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
    await loadTransactionData()
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

async function removeTransaction(transaction) {
  if (transactionSubmitting.value) {
    return
  }

  const confirmed = window.confirm(`Delete "${transaction.title}"? This cannot be undone.`)
  if (!confirmed) {
    return
  }

  const userId = user.value?.id
  if (!userId) {
    errorMessage.value = 'User session is missing. Please log in again.'
    return
  }

  try {
    await deleteTransactionRequest(userId, transaction.id)

    if (String(editingTransactionId.value) === String(transaction.id)) {
      closeTransactionModal(true)
    }

    await loadTransactionData()
  } catch (error) {
    errorMessage.value = error?.payload?.message || error?.message || 'Unable to delete transaction.'
  }
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

onMounted(loadTransactionData)
</script>

<template>
  <DashboardShell active-section="transactions">
    <template #header>
      <header class="section-topbar">
        <div>
          <p class="section-kicker">Transactions</p>
          <h2>Transaction ledger</h2>
          <p class="section-copy">
            Review the live ledger from Laravel, then edit or remove entries without leaving the list.
          </p>
        </div>

        <div class="section-actions">
          <button class="section-button section-button--ghost" type="button" @click="loadTransactionData">
            Refresh
          </button>
        </div>
      </header>
    </template>

    <div v-if="errorMessage" class="section-alert" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="section-alert__button" @click="loadTransactionData">Retry</button>
    </div>

    <section class="section-panel">
      <div class="section-panel-head">
        <div>
          <p class="section-kicker">List only</p>
          <h3>All transactions</h3>
        </div>
        <span class="section-panel-badge">{{ transactionCount }} entries</span>
      </div>

      <div v-if="loading && transactions.length === 0" class="section-empty">
        Loading transactions...
      </div>

      <div v-else-if="transactions.length" class="section-list">
        <article v-for="transaction in transactions" :key="transaction.id" class="section-list-row">
          <div
            class="section-list-icon"
            :style="{ '--accent': transaction.transaction_type === 'income' ? '#39d0b4' : '#ffb84d' }"
          >
            {{ transaction.transaction_type === 'income' ? '+' : '-' }}
          </div>

          <div class="section-list-copy">
            <div class="section-row-head">
              <div>
                <h4>{{ transaction.title }}</h4>
                <span
                  class="section-chip"
                  :class="
                    transaction.transaction_type === 'income'
                      ? 'section-chip--positive'
                      : 'section-chip--warning'
                  "
                >
                  {{ transaction.transaction_type }}
                </span>
              </div>
              <div class="transaction-row-side">
                <strong
                  class="transaction-amount"
                  :class="transaction.transaction_type === 'income' ? 'income' : 'expense'"
                >
                  {{ transaction.transaction_type === 'income' ? '+' : '-' }}{{ formatCurrency(transaction.amount) }}
                </strong>
                <div class="transaction-row-actions">
                  <button
                    class="section-button transaction-action-button"
                    type="button"
                    :disabled="transactionSubmitting"
                    @click="openEditTransaction(transaction)"
                  >
                    Edit
                  </button>
                  <button
                    class="section-button transaction-action-button transaction-action-button--danger"
                    type="button"
                    :disabled="transactionSubmitting"
                    @click="removeTransaction(transaction)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <p class="section-row-meta">
              {{ transactionAccountLabel(transaction) }} | {{ transactionCategoryLabel(transaction) }} |
              {{ formatShortDate(transaction.transaction_date) }}
            </p>
            <p v-if="transaction.description" class="section-row-subtext">
              {{ transaction.description }}
            </p>
            <p v-if="transaction.reference" class="section-row-subtext">
              Reference: {{ transaction.reference }}
            </p>
          </div>
        </article>
      </div>

      <div v-else class="section-empty">
        No transactions have been recorded yet.
      </div>
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
          <header class="transaction-modal-header">
            <div>
              <p class="eyebrow">Edit entry</p>
              <h3 id="transaction-modal-title">Edit transaction</h3>
              <p class="transaction-modal-copy">
                Update the selected income or expense entry, then save the revised record.
              </p>
            </div>
            <button type="button" class="transaction-modal-close ghost-button" @click="closeTransactionModal">
              Close
            </button>
          </header>

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
                  <option v-for="account in accountOptions" :key="account.id" :value="String(account.id)">
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
                  :disabled="transactionSubmitting || !hasAccounts"
                  @change="clearTransactionFieldError('category_id')"
                >
                  <option value="">No category</option>
                  <option v-for="category in filteredCategories" :key="category.id" :value="String(category.id)">
                    {{ category.name }}
                  </option>
                </select>
                <small v-if="!filteredCategories.length" class="field-hint">
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
                {{ transactionSubmitting ? 'Saving...' : 'Save changes' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </transition>
  </DashboardShell>
</template>

<style scoped>
.transaction-row-side {
  display: grid;
  justify-items: end;
  gap: 0.55rem;
}

.transaction-amount {
  white-space: nowrap;
  font-weight: 800;
  font-size: 1rem;
}

.transaction-amount.income {
  color: #7fe4cf;
}

.transaction-amount.expense {
  color: #ffcc80;
}

.transaction-row-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.transaction-action-button {
  min-height: 2.3rem;
  padding: 0.45rem 0.75rem;
  border-radius: 0.85rem;
  font-size: 0.82rem;
  letter-spacing: 0.01em;
}

.transaction-action-button--danger {
  background: rgba(225, 87, 87, 0.12);
  border-color: rgba(225, 87, 87, 0.24);
  color: #ffd0d0;
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
  width: min(100%, 52rem);
  max-height: min(calc(100vh - 2rem), 52rem);
  max-height: min(calc(100dvh - 2rem), 52rem);
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-radius: 1.7rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(8, 17, 31, 0.94);
  box-shadow: 0 38px 120px rgba(0, 0, 0, 0.42);
}

.transaction-modal-header {
  padding: 1.35rem 1.4rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at top right, rgba(72, 129, 255, 0.18), transparent 50%),
    rgba(255, 255, 255, 0.03);
}

.transaction-modal-header h3 {
  margin: 0;
  font-size: 1.85rem;
  letter-spacing: -0.04em;
}

.transaction-modal-copy {
  margin: 0.35rem 0 0;
  color: rgba(232, 237, 247, 0.72);
}

.transaction-modal-close {
  min-height: 2.4rem;
  padding: 0.45rem 0.8rem;
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #f4f7fc;
  flex: 0 0 auto;
}

.transaction-form {
  padding: 1.4rem;
  display: grid;
  align-content: start;
  gap: 1rem;
  overflow-y: auto;
  min-height: 0;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
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
}

.form-actions {
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

@media (max-width: 720px) {
  .transaction-row-side {
    width: 100%;
    justify-items: start;
  }

  .transaction-row-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .transaction-action-button {
    flex: 1 1 0;
  }

  .transaction-modal {
    display: flex;
    flex-direction: column;
    height: min(calc(100dvh - 1.5rem), 52rem);
  }

  .transaction-modal-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .transaction-modal-close {
    width: 100%;
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
}

@media (max-width: 520px) {
  .transaction-modal {
    height: min(calc(100dvh - 1.25rem), 52rem);
  }
}
</style>
