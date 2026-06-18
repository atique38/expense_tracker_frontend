<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DashboardShell from '@/components/DashboardShell.vue'
import { createAccount, deleteAccount, fetchDashboard, updateAccount } from '@/services/api'
import { getStoredUser } from '@/utils/auth'
import {
  accountAccent,
  accountInitial,
  accountTypeLabel,
  formatCurrency,
  normalizeNumber,
} from '@/utils/dashboard-display'

const router = useRouter()
const user = ref(getStoredUser())
const loading = ref(false)
const submitting = ref(false)
const accountEditSubmitting = ref(false)
const accountModalOpen = ref(false)
const errorMessage = ref('')
const accountEditError = ref('')
const editingAccountId = ref(null)
const scrollLockSnapshot = {
  bodyOverflow: '',
  htmlOverflow: '',
  locked: false,
}

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
  accounts: [],
})

const accountTypes = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'card', label: 'Card' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'other', label: 'Other' },
]

function createAccountDefaults(account = null) {
  return {
    name: account?.name ? String(account.name) : '',
    type: account?.type || 'cash',
    currency: account?.currency ? String(account.currency).trim().toUpperCase() : 'BDT',
    opening_balance:
      account?.opening_balance !== undefined && account?.opening_balance !== null
        ? String(account.opening_balance)
        : '',
    is_default: Boolean(account?.is_default),
    notes: account?.notes ? String(account.notes) : '',
  }
}

function createAccountFieldErrors() {
  return {
    name: '',
    type: '',
    currency: '',
    opening_balance: '',
    is_default: '',
    notes: '',
  }
}

const accountForm = reactive(createAccountDefaults())
const accountFieldErrors = reactive(createAccountFieldErrors())
const accountEditForm = reactive(createAccountDefaults())
const accountEditFieldErrors = reactive(createAccountFieldErrors())

const accounts = computed(() => dashboard.accounts)
const accountCount = computed(() => normalizeNumber(dashboard.counts.accounts) || accounts.value.length)
const totalBalance = computed(() => normalizeNumber(dashboard.summary.balance))
const openingBalanceTotal = computed(() =>
  accounts.value.reduce((sum, account) => sum + normalizeNumber(account.opening_balance), 0),
)
const defaultAccount = computed(() => accounts.value.find((account) => account.is_default) || null)
const accountActionDisabled = computed(() => loading.value || submitting.value || accountEditSubmitting.value)

function resetAccountFieldErrors(target = accountFieldErrors) {
  Object.keys(target).forEach((key) => {
    target[key] = ''
  })
}

function clearAccountFieldError(field) {
  if (field in accountFieldErrors) {
    accountFieldErrors[field] = ''
  }

  errorMessage.value = ''
}

function clearAccountEditFieldError(field) {
  if (field in accountEditFieldErrors) {
    accountEditFieldErrors[field] = ''
  }

  accountEditError.value = ''
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

  dashboard.accounts = Array.isArray(payload?.accounts) ? payload.accounts : []
}

async function loadAccounts() {
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
  } catch (error) {
    errorMessage.value = error?.payload?.message || error?.message || 'Unable to load accounts.'
  } finally {
    loading.value = false
  }
}

function applyValidationErrors(errors, targetErrors, generalErrorRef) {
  Object.entries(errors || {}).forEach(([field, value]) => {
    const message = Array.isArray(value) ? value[0] || '' : String(value || '')
    if (!message) {
      return
    }

    if (field in targetErrors) {
      targetErrors[field] = message
      return
    }

    if (generalErrorRef) {
      generalErrorRef.value = message
    }
  })
}

function buildAccountPayload(form) {
  const name = form.name.trim()
  const type = form.type
  const currency = (form.currency || 'BDT').trim().toUpperCase() || 'BDT'
  const openingBalance = form.opening_balance === '' ? 0 : Number(form.opening_balance)

  return {
    name,
    type,
    currency,
    openingBalance,
    isDefault: Boolean(form.is_default),
    notes: form.notes.trim() || null,
  }
}

async function submitAccount() {
  resetAccountFieldErrors()
  errorMessage.value = ''

  const userId = user.value?.id
  if (!userId) {
    errorMessage.value = 'User session is missing. Please log in again.'
    return
  }

  const { name, type, currency, openingBalance, isDefault, notes } = buildAccountPayload(accountForm)

  if (!name) {
    accountFieldErrors.name = 'Enter an account name.'
  }

  if (!type) {
    accountFieldErrors.type = 'Choose an account type.'
  }

  if (!currency || currency.length !== 3) {
    accountFieldErrors.currency = 'Use a 3-letter currency code.'
  }

  if (!Number.isFinite(openingBalance)) {
    accountFieldErrors.opening_balance = 'Enter a valid opening balance.'
  }

  if (Object.values(accountFieldErrors).some(Boolean)) {
    return
  }

  submitting.value = true

  try {
    await createAccount(userId, {
      name,
      type,
      currency,
      opening_balance: openingBalance,
      is_default: isDefault,
      notes,
    })

    Object.assign(accountForm, createAccountDefaults())
    await loadAccounts()
  } catch (error) {
    if (error?.status === 422 && error?.payload?.errors) {
      applyValidationErrors(error.payload.errors, accountFieldErrors, errorMessage)
      return
    }

    errorMessage.value = error?.payload?.message || error?.message || 'Unable to save account.'
  } finally {
    submitting.value = false
  }
}

function openEditAccount(account) {
  accountEditError.value = ''
  resetAccountFieldErrors(accountEditFieldErrors)
  editingAccountId.value = account?.id || null
  Object.assign(accountEditForm, createAccountDefaults(account))
  accountModalOpen.value = true
}

function closeAccountModal(force = false) {
  if (accountEditSubmitting.value && !force) {
    return
  }

  accountModalOpen.value = false
  accountEditError.value = ''
  editingAccountId.value = null
  resetAccountFieldErrors(accountEditFieldErrors)
  Object.assign(accountEditForm, createAccountDefaults())
}

async function submitAccountEdit() {
  resetAccountFieldErrors(accountEditFieldErrors)
  accountEditError.value = ''

  const userId = user.value?.id
  if (!userId) {
    accountEditError.value = 'User session is missing. Please log in again.'
    return
  }

  if (!editingAccountId.value) {
    accountEditError.value = 'Select an account to edit.'
    return
  }

  const { name, type, currency, openingBalance, isDefault, notes } = buildAccountPayload(accountEditForm)

  if (!name) {
    accountEditFieldErrors.name = 'Enter an account name.'
  }

  if (!type) {
    accountEditFieldErrors.type = 'Choose an account type.'
  }

  if (!currency || currency.length !== 3) {
    accountEditFieldErrors.currency = 'Use a 3-letter currency code.'
  }

  if (!Number.isFinite(openingBalance)) {
    accountEditFieldErrors.opening_balance = 'Enter a valid opening balance.'
  }

  if (Object.values(accountEditFieldErrors).some(Boolean)) {
    return
  }

  accountEditSubmitting.value = true

  try {
    await updateAccount(userId, editingAccountId.value, {
      name,
      type,
      currency,
      opening_balance: openingBalance,
      is_default: isDefault,
      notes,
    })

    closeAccountModal(true)
    await loadAccounts()
  } catch (error) {
    if (error?.status === 422 && error?.payload?.errors) {
      applyValidationErrors(error.payload.errors, accountEditFieldErrors, accountEditError)
      return
    }

    accountEditError.value = error?.payload?.message || error?.message || 'Unable to save account.'
  } finally {
    accountEditSubmitting.value = false
  }
}

async function removeAccount(account) {
  if (accountEditSubmitting.value) {
    return
  }

  const confirmed = window.confirm(`Delete "${account.name}"? This cannot be undone.`)
  if (!confirmed) {
    return
  }

  const userId = user.value?.id
  if (!userId) {
    errorMessage.value = 'User session is missing. Please log in again.'
    return
  }

  try {
    await deleteAccount(userId, account.id)

    if (String(editingAccountId.value) === String(account.id)) {
      closeAccountModal(true)
    }

    await loadAccounts()
  } catch (error) {
    errorMessage.value = error?.payload?.message || error?.message || 'Unable to delete account.'
  }
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

watch(
  accountModalOpen,
  (isOpen) => {
    if (isOpen) {
      lockPageScroll()
      return
    }

    unlockPageScroll()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  unlockPageScroll()
})

onMounted(loadAccounts)
</script>

<template>
  <DashboardShell active-section="accounts">
    <template #header>
      <header class="section-topbar">
        <div>
          <p class="section-kicker">Accounts</p>
          <h2>Account setup</h2>
          <p class="section-copy">
            Create the places where money lives and set one as the default for fast transaction entry.
          </p>
        </div>

        <div class="section-actions">
          <button class="section-button section-button--ghost" type="button" @click="loadAccounts">
            Refresh
          </button>
        </div>
      </header>
    </template>

    <div v-if="errorMessage" class="section-alert" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="section-alert__button" @click="loadAccounts">Retry</button>
    </div>

    <section class="section-metrics">
      <article class="section-metric section-metric--featured">
        <p class="section-metric-label">Total balance</p>
        <h3>{{ formatCurrency(totalBalance) }}</h3>
        <p class="section-metric-note">Across {{ accountCount }} linked accounts</p>
        <div class="section-metric-strip">
          <div class="section-metric-strip-fill" :style="{ width: '100%' }"></div>
        </div>
      </article>

      <article class="section-metric">
        <p class="section-metric-label">Accounts</p>
        <h3>{{ accountCount }}</h3>
        <p class="section-metric-note">Created for this user</p>
      </article>

      <article class="section-metric">
        <p class="section-metric-label">Default account</p>
        <h3>{{ defaultAccount ? defaultAccount.name : 'None' }}</h3>
        <p class="section-metric-note">
          {{ defaultAccount ? accountTypeLabel(defaultAccount.type) : 'Mark one while creating it.' }}
        </p>
      </article>

      <article class="section-metric">
        <p class="section-metric-label">Opening balance</p>
        <h3>{{ formatCurrency(openingBalanceTotal) }}</h3>
        <p class="section-metric-note">Total starting value across accounts</p>
      </article>
    </section>

    <section class="section-grid">
      <article class="section-panel">
        <div class="section-panel-head">
          <div>
            <p class="section-kicker">Setup</p>
            <h3>Create account</h3>
          </div>
          <span class="section-panel-badge">Laravel accounts endpoint</span>
        </div>

        <form class="section-form" @submit.prevent="submitAccount" novalidate>
          <div class="section-form-grid">
            <label class="section-field section-field--span-2">
              <span>Name</span>
              <input
                v-model="accountForm.name"
                type="text"
                name="name"
                placeholder="Cash, Bank, Card, Wallet..."
                @input="clearAccountFieldError('name')"
              />
              <small v-if="accountFieldErrors.name" class="section-field-error">
                {{ accountFieldErrors.name }}
              </small>
            </label>

            <label class="section-field">
              <span>Type</span>
              <select v-model="accountForm.type" name="type" @change="clearAccountFieldError('type')">
                <option v-for="option in accountTypes" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <small v-if="accountFieldErrors.type" class="section-field-error">
                {{ accountFieldErrors.type }}
              </small>
            </label>

            <label class="section-field">
              <span>Currency</span>
              <input
                v-model="accountForm.currency"
                type="text"
                name="currency"
                maxlength="3"
                placeholder="BDT"
                @input="clearAccountFieldError('currency')"
              />
              <small v-if="accountFieldErrors.currency" class="section-field-error">
                {{ accountFieldErrors.currency }}
              </small>
            </label>

            <label class="section-field">
              <span>Opening balance</span>
              <input
                v-model="accountForm.opening_balance"
                type="number"
                name="opening_balance"
                step="0.01"
                inputmode="decimal"
                placeholder="0.00"
                @input="clearAccountFieldError('opening_balance')"
              />
              <small v-if="accountFieldErrors.opening_balance" class="section-field-error">
                {{ accountFieldErrors.opening_balance }}
              </small>
            </label>

            <label class="section-field">
              <span>Default account</span>
              <select
                v-model="accountForm.is_default"
                name="is_default"
                @change="clearAccountFieldError('is_default')"
              >
                <option :value="false">No</option>
                <option :value="true">Yes</option>
              </select>
              <small class="section-field-hint">
                The default account is preselected when adding a transaction.
              </small>
            </label>

            <label class="section-field section-field--span-2">
              <span>Notes</span>
              <textarea
                v-model="accountForm.notes"
                name="notes"
                rows="4"
                placeholder="Optional notes about this account"
                @input="clearAccountFieldError('notes')"
              ></textarea>
              <small v-if="accountFieldErrors.notes" class="section-field-error">
                {{ accountFieldErrors.notes }}
              </small>
            </label>
          </div>

          <div class="section-form-actions">
            <button class="section-submit" type="submit" :disabled="submitting">
              <span v-if="submitting" class="section-spinner" aria-hidden="true"></span>
              {{ submitting ? 'Saving...' : 'Save account' }}
            </button>
          </div>
        </form>
      </article>

      <article class="section-panel">
        <div class="section-panel-head">
          <div>
            <p class="section-kicker">Information</p>
            <h3>Account list</h3>
          </div>
          <span class="section-panel-badge">{{ accountCount }} accounts</span>
        </div>

        <div v-if="loading && accounts.length === 0" class="section-empty">
          Loading accounts...
        </div>

        <div v-else-if="accounts.length" class="section-list">
          <article v-for="(account, index) in accounts" :key="account.id" class="section-list-row">
            <div class="section-list-icon" :style="{ '--accent': accountAccent(account, index) }">
              {{ accountInitial(account.name) }}
            </div>

            <div class="section-list-copy">
              <div class="section-row-head">
                <div>
                  <h4>{{ account.name }}</h4>
                  <span v-if="account.is_default" class="section-chip section-chip--positive">
                    Default
                  </span>
                </div>

                <div class="account-row-side">
                  <strong>{{ formatCurrency(account.balance) }}</strong>
                  <div class="account-row-actions">
                    <button
                      class="section-button account-action-button"
                      type="button"
                      :disabled="accountActionDisabled"
                      @click="openEditAccount(account)"
                    >
                      Edit
                    </button>
                    <button
                      class="section-button account-action-button account-action-button--danger"
                      type="button"
                      :disabled="accountActionDisabled"
                      @click="removeAccount(account)"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <p class="section-row-meta">
                {{ accountTypeLabel(account.type) }} | Opening
                {{ formatCurrency(account.opening_balance) }} | {{ account.currency }}
              </p>
              <p v-if="account.notes" class="section-row-subtext">
                {{ account.notes }}
              </p>

              <div class="section-progress">
                <div
                  class="section-progress-fill"
                  :style="{ width: `${Math.min(100, normalizeNumber(account.usage))}%`, '--accent': accountAccent(account, index) }"
                ></div>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="section-empty">
          No accounts have been created yet.
        </div>
      </article>
    </section>

    <transition name="fade">
      <div
        v-if="accountModalOpen"
        class="modal-backdrop"
        role="presentation"
        @click.self="closeAccountModal"
      >
        <section
          class="account-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-modal-title"
        >
          <header class="account-modal-header">
            <div>
              <p class="section-kicker">Edit account</p>
              <h3 id="account-modal-title">Edit account</h3>
              <p class="account-modal-copy">
                Update the selected account details, then save the revised record.
              </p>
            </div>
            <button
              type="button"
              class="section-button section-button--ghost account-modal-close"
              @click="closeAccountModal"
            >
              Close
            </button>
          </header>

          <form class="section-form account-form" @submit.prevent="submitAccountEdit" novalidate>
            <div v-if="accountEditError" class="section-form-alert" role="alert">
              {{ accountEditError }}
            </div>

            <div class="section-form-grid">
              <label class="section-field section-field--span-2">
                <span>Name</span>
                <input
                  v-model="accountEditForm.name"
                  type="text"
                  name="name"
                  placeholder="Cash, Bank, Card, Wallet..."
                  @input="clearAccountEditFieldError('name')"
                />
                <small v-if="accountEditFieldErrors.name" class="section-field-error">
                  {{ accountEditFieldErrors.name }}
                </small>
              </label>

              <label class="section-field">
                <span>Type</span>
                <select
                  v-model="accountEditForm.type"
                  name="type"
                  @change="clearAccountEditFieldError('type')"
                >
                  <option v-for="option in accountTypes" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <small v-if="accountEditFieldErrors.type" class="section-field-error">
                  {{ accountEditFieldErrors.type }}
                </small>
              </label>

              <label class="section-field">
                <span>Currency</span>
                <input
                  v-model="accountEditForm.currency"
                  type="text"
                  name="currency"
                  maxlength="3"
                  placeholder="BDT"
                  @input="clearAccountEditFieldError('currency')"
                />
                <small v-if="accountEditFieldErrors.currency" class="section-field-error">
                  {{ accountEditFieldErrors.currency }}
                </small>
              </label>

              <label class="section-field">
                <span>Opening balance</span>
                <input
                  v-model="accountEditForm.opening_balance"
                  type="number"
                  name="opening_balance"
                  step="0.01"
                  inputmode="decimal"
                  placeholder="0.00"
                  @input="clearAccountEditFieldError('opening_balance')"
                />
                <small v-if="accountEditFieldErrors.opening_balance" class="section-field-error">
                  {{ accountEditFieldErrors.opening_balance }}
                </small>
              </label>

              <label class="section-field">
                <span>Default account</span>
                <select
                  v-model="accountEditForm.is_default"
                  name="is_default"
                  @change="clearAccountEditFieldError('is_default')"
                >
                  <option :value="false">No</option>
                  <option :value="true">Yes</option>
                </select>
                <small class="section-field-hint">
                  The default account is preselected when adding a transaction.
                </small>
              </label>

              <label class="section-field section-field--span-2">
                <span>Notes</span>
                <textarea
                  v-model="accountEditForm.notes"
                  name="notes"
                  rows="4"
                  placeholder="Optional notes about this account"
                  @input="clearAccountEditFieldError('notes')"
                ></textarea>
                <small v-if="accountEditFieldErrors.notes" class="section-field-error">
                  {{ accountEditFieldErrors.notes }}
                </small>
              </label>
            </div>

            <div class="section-form-actions">
              <button class="section-button section-button--ghost" type="button" @click="closeAccountModal">
                Cancel
              </button>
              <button class="section-submit" type="submit" :disabled="accountEditSubmitting">
                <span v-if="accountEditSubmitting" class="section-spinner" aria-hidden="true"></span>
                {{ accountEditSubmitting ? 'Saving...' : 'Save changes' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </transition>
  </DashboardShell>
</template>

<style scoped>
.account-row-side {
  display: grid;
  justify-items: end;
  gap: 0.55rem;
}

.account-row-side strong {
  white-space: nowrap;
  font-weight: 800;
}

.account-row-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.account-action-button {
  min-height: 2.3rem;
  padding: 0.45rem 0.75rem;
  border-radius: 0.85rem;
  font-size: 0.82rem;
  letter-spacing: 0.01em;
}

.account-action-button--danger {
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

.account-modal {
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

.account-modal-header {
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

.account-modal-header h3 {
  margin: 0;
  font-size: 1.85rem;
  letter-spacing: -0.04em;
}

.account-modal-copy {
  margin: 0.35rem 0 0;
  color: rgba(232, 237, 247, 0.72);
}

.account-modal-close {
  min-height: 2.4rem;
  padding: 0.45rem 0.8rem;
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #f4f7fc;
  flex: 0 0 auto;
}

.account-form {
  padding: 1.4rem;
  display: grid;
  align-content: start;
  gap: 1rem;
  overflow-y: auto;
  min-height: 0;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
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
  .account-row-side {
    width: 100%;
    justify-items: start;
  }

  .account-row-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .account-action-button {
    flex: 1 1 0;
  }

  .account-modal {
    display: flex;
    flex-direction: column;
    height: min(calc(100dvh - 1.5rem), 52rem);
  }

  .account-modal-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .account-modal-close {
    width: 100%;
  }

  .section-form-grid {
    grid-template-columns: 1fr;
  }

  .section-field--span-2 {
    grid-column: span 1;
  }

  .section-form-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .section-submit,
  .section-form-actions .section-button {
    width: 100%;
  }
}

@media (max-width: 520px) {
  .account-modal {
    height: min(calc(100dvh - 1.25rem), 52rem);
  }
}
</style>
