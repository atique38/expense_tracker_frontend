<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DashboardShell from '@/components/DashboardShell.vue'
import { createBudget, deleteBudget, fetchCategories, fetchDashboard, updateBudget } from '@/services/api'
import { getStoredUser } from '@/utils/auth'
import {
  budgetAccent,
  budgetCategoryLabel,
  budgetPeriodLabel,
  budgetRemainingLabel,
  formatCurrency,
  normalizeNumber,
} from '@/utils/dashboard-display'

const router = useRouter()
const user = ref(getStoredUser())
const loading = ref(false)
const submitting = ref(false)
const budgetEditSubmitting = ref(false)
const categoriesLoading = ref(false)
const budgetModalOpen = ref(false)
const errorMessage = ref('')
const categoriesError = ref('')
const budgetEditError = ref('')
const editingBudgetId = ref(null)
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
  budgets: [],
})

const availableCategories = ref([])

const budgetPeriods = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
]

function createBudgetDefaults(budget = null) {
  const categoryId = budget?.category?.id ?? budget?.category_id ?? ''

  return {
    category_id: categoryId ? String(categoryId) : '',
    amount:
      budget?.amount !== undefined && budget?.amount !== null ? String(budget.amount) : '',
    period: budget?.period || 'monthly',
    start_date: budget?.start_date ? String(budget.start_date).slice(0, 10) : '',
    end_date: budget?.end_date ? String(budget.end_date).slice(0, 10) : '',
  }
}

function createBudgetFieldErrors() {
  return {
    category_id: '',
    amount: '',
    period: '',
    start_date: '',
    end_date: '',
  }
}

const budgetForm = reactive(createBudgetDefaults())
const budgetFieldErrors = reactive(createBudgetFieldErrors())
const budgetEditForm = reactive(createBudgetDefaults())
const budgetEditFieldErrors = reactive(createBudgetFieldErrors())

const budgets = computed(() => dashboard.budgets)
const expenseCategories = computed(() =>
  availableCategories.value.filter((category) => category.type === 'expense'),
)
const budgetCount = computed(() => normalizeNumber(dashboard.counts.budgets) || budgets.value.length)
const totalBudgetAmount = computed(() =>
  budgets.value.reduce((sum, budget) => sum + normalizeNumber(budget.amount), 0),
)
const totalBudgetSpent = computed(() =>
  budgets.value.reduce((sum, budget) => sum + normalizeNumber(budget.spent), 0),
)
const overspentCount = computed(
  () => budgets.value.filter((budget) => budget.status === 'overspent').length,
)
const categoryCount = computed(() => expenseCategories.value.length)
const editingBudget = computed(
  () => budgets.value.find((budget) => String(budget.id) === String(editingBudgetId.value)) || null,
)
const editingBudgetCategory = computed(() => getBudgetCategoryFallback(editingBudget.value))
const budgetEditCategoryOptions = computed(() =>
  mergeCategoryOptions(
    expenseCategories.value,
    editingBudgetCategory.value ? [editingBudgetCategory.value] : [],
  ),
)
const budgetActionDisabled = computed(() => loading.value || submitting.value || budgetEditSubmitting.value)

function resetBudgetFieldErrors(target = budgetFieldErrors) {
  Object.keys(target).forEach((key) => {
    target[key] = ''
  })
}

function clearBudgetFieldError(field) {
  if (field in budgetFieldErrors) {
    budgetFieldErrors[field] = ''
  }

  errorMessage.value = ''
}

function clearBudgetEditFieldError(field) {
  if (field in budgetEditFieldErrors) {
    budgetEditFieldErrors[field] = ''
  }

  budgetEditError.value = ''
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

  dashboard.budgets = Array.isArray(payload?.budgets) ? payload.budgets : []
}

function mergeCategoryOptions(primary, fallback) {
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

function getBudgetCategoryFallback(budget) {
  const categoryId = budget?.category?.id ?? budget?.category_id
  if (!categoryId) {
    return null
  }

  return {
    id: budget?.category?.id ?? categoryId,
    name: budget?.category?.name || 'Category',
    type: budget?.category?.type || 'expense',
  }
}

async function loadBudgets() {
  const userId = user.value?.id
  if (!userId) {
    router.replace({ name: 'login' })
    return
  }

  loading.value = true
  categoriesLoading.value = true
  errorMessage.value = ''
  categoriesError.value = ''

  const [dashboardResult, categoriesResult] = await Promise.allSettled([
    fetchDashboard(userId),
    fetchCategories(userId),
  ])

  if (dashboardResult.status === 'fulfilled') {
    normalizeDashboard(dashboardResult.value?.data)
  } else {
    errorMessage.value =
      dashboardResult.reason?.payload?.message ||
      dashboardResult.reason?.message ||
      'Unable to load budgets.'
  }

  if (categoriesResult.status === 'fulfilled') {
    availableCategories.value = Array.isArray(categoriesResult.value?.data)
      ? categoriesResult.value.data
      : []
  } else {
    categoriesError.value =
      categoriesResult.reason?.payload?.message ||
      categoriesResult.reason?.message ||
      'Unable to load categories.'
  }

  loading.value = false
  categoriesLoading.value = false
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

function buildBudgetPayload(form) {
  return {
    amount: normalizeNumber(form.amount),
    period: form.period,
    categoryId: form.category_id ? Number(form.category_id) : null,
    startDate: form.start_date || null,
    endDate: form.end_date || null,
  }
}

function validateBudgetPayload(payload, categoryOptions, targetErrors) {
  const { amount, period, categoryId, startDate, endDate } = payload

  if (amount <= 0) {
    targetErrors.amount = 'Enter a budget amount greater than zero.'
  }

  if (!period) {
    targetErrors.period = 'Choose a budget period.'
  }

  if (period === 'custom') {
    if (!startDate) {
      targetErrors.start_date = 'Select a custom start date.'
    }

    if (!endDate) {
      targetErrors.end_date = 'Select a custom end date.'
    }

    if (startDate && endDate && startDate > endDate) {
      targetErrors.end_date = 'End date must be after the start date.'
    }
  }

  const selectedCategoryExists = categoryId
    ? categoryOptions.some((category) => Number(category.id) === categoryId)
    : true

  if (!selectedCategoryExists) {
    targetErrors.category_id = 'Select an expense category or leave it blank.'
  }
}

async function submitBudget() {
  resetBudgetFieldErrors()
  errorMessage.value = ''

  const userId = user.value?.id
  if (!userId) {
    errorMessage.value = 'User session is missing. Please log in again.'
    return
  }

  const payload = buildBudgetPayload(budgetForm)
  validateBudgetPayload(payload, expenseCategories.value, budgetFieldErrors)

  if (Object.values(budgetFieldErrors).some(Boolean)) {
    return
  }

  submitting.value = true

  try {
    await createBudget(userId, {
      category_id: payload.categoryId,
      amount: payload.amount,
      period: payload.period,
      start_date: payload.startDate,
      end_date: payload.endDate,
    })

    Object.assign(budgetForm, createBudgetDefaults())
    await loadBudgets()
  } catch (error) {
    if (error?.status === 422 && error?.payload?.errors) {
      applyValidationErrors(error.payload.errors, budgetFieldErrors, errorMessage)
      return
    }

    errorMessage.value = error?.payload?.message || error?.message || 'Unable to save budget.'
  } finally {
    submitting.value = false
  }
}

function openEditBudget(budget) {
  budgetEditError.value = ''
  resetBudgetFieldErrors(budgetEditFieldErrors)
  editingBudgetId.value = budget?.id || null
  Object.assign(budgetEditForm, createBudgetDefaults(budget))
  budgetModalOpen.value = true
}

function closeBudgetModal(force = false) {
  if (budgetEditSubmitting.value && !force) {
    return
  }

  budgetModalOpen.value = false
  budgetEditError.value = ''
  editingBudgetId.value = null
  resetBudgetFieldErrors(budgetEditFieldErrors)
  Object.assign(budgetEditForm, createBudgetDefaults())
}

async function submitBudgetEdit() {
  resetBudgetFieldErrors(budgetEditFieldErrors)
  budgetEditError.value = ''

  const userId = user.value?.id
  if (!userId) {
    budgetEditError.value = 'User session is missing. Please log in again.'
    return
  }

  if (!editingBudgetId.value) {
    budgetEditError.value = 'Select a budget to edit.'
    return
  }

  const payload = buildBudgetPayload(budgetEditForm)
  validateBudgetPayload(payload, budgetEditCategoryOptions.value, budgetEditFieldErrors)

  if (Object.values(budgetEditFieldErrors).some(Boolean)) {
    return
  }

  budgetEditSubmitting.value = true

  try {
    await updateBudget(userId, editingBudgetId.value, {
      category_id: payload.categoryId,
      amount: payload.amount,
      period: payload.period,
      start_date: payload.startDate,
      end_date: payload.endDate,
    })

    closeBudgetModal(true)
    await loadBudgets()
  } catch (error) {
    if (error?.status === 422 && error?.payload?.errors) {
      applyValidationErrors(error.payload.errors, budgetEditFieldErrors, budgetEditError)
      return
    }

    budgetEditError.value = error?.payload?.message || error?.message || 'Unable to save budget.'
  } finally {
    budgetEditSubmitting.value = false
  }
}

async function removeBudget(budget) {
  if (budgetEditSubmitting.value) {
    return
  }

  const confirmed = window.confirm(`Delete budget for "${budgetCategoryLabel(budget)}"? This cannot be undone.`)
  if (!confirmed) {
    return
  }

  const userId = user.value?.id
  if (!userId) {
    errorMessage.value = 'User session is missing. Please log in again.'
    return
  }

  try {
    await deleteBudget(userId, budget.id)

    if (String(editingBudgetId.value) === String(budget.id)) {
      closeBudgetModal(true)
    }

    await loadBudgets()
  } catch (error) {
    errorMessage.value = error?.payload?.message || error?.message || 'Unable to delete budget.'
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
  budgetModalOpen,
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

onMounted(loadBudgets)
</script>

<template>
  <DashboardShell active-section="budgets">
    <template #header>
      <header class="section-topbar">
        <div>
          <p class="section-kicker">Budgets</p>
          <h2>Budget setup</h2>
          <p class="section-copy">
            Attach budgets to expense categories, choose a period, and track spending against the limit.
          </p>
        </div>

        <div class="section-actions">
          <button class="section-button section-button--ghost" type="button" @click="loadBudgets">
            Refresh
          </button>
        </div>
      </header>
    </template>

    <div v-if="errorMessage" class="section-alert" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="section-alert__button" @click="loadBudgets">Retry</button>
    </div>

    <section class="section-metrics">
      <article class="section-metric section-metric--featured">
        <p class="section-metric-label">Total budget</p>
        <h3>{{ formatCurrency(totalBudgetAmount) }}</h3>
        <p class="section-metric-note">Across {{ budgetCount }} active budgets</p>
        <div class="section-metric-strip">
          <div class="section-metric-strip-fill" :style="{ width: '100%' }"></div>
        </div>
      </article>

      <article class="section-metric">
        <p class="section-metric-label">Spent</p>
        <h3>{{ formatCurrency(totalBudgetSpent) }}</h3>
        <p class="section-metric-note">Tracked from expense transactions</p>
      </article>

      <article class="section-metric">
        <p class="section-metric-label">Overspent</p>
        <h3>{{ overspentCount }}</h3>
        <p class="section-metric-note">Budgets currently above their limit</p>
      </article>

      <article class="section-metric">
        <p class="section-metric-label">Expense categories</p>
        <h3>{{ categoryCount }}</h3>
        <p class="section-metric-note">Available for budget linking</p>
      </article>
    </section>

    <section class="section-grid">
      <article class="section-panel">
        <div class="section-panel-head">
          <div>
            <p class="section-kicker">Setup</p>
            <h3>Create budget</h3>
          </div>
          
        </div>

        <form class="section-form" @submit.prevent="submitBudget" novalidate>
          <div class="section-form-grid">
            <label class="section-field">
              <span>Amount</span>
              <input
                v-model="budgetForm.amount"
                type="number"
                name="amount"
                min="0"
                step="0.01"
                inputmode="decimal"
                placeholder="0.00"
                @input="clearBudgetFieldError('amount')"
              />
              <small v-if="budgetFieldErrors.amount" class="section-field-error">
                {{ budgetFieldErrors.amount }}
              </small>
            </label>

            <label class="section-field">
              <span>Period</span>
              <select
                v-model="budgetForm.period"
                name="period"
                @change="clearBudgetFieldError('period')"
              >
                <option v-for="option in budgetPeriods" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <small v-if="budgetFieldErrors.period" class="section-field-error">
                {{ budgetFieldErrors.period }}
              </small>
            </label>

            <label class="section-field section-field--span-2">
              <span>Category</span>
              <select
                v-model="budgetForm.category_id"
                name="category_id"
                :disabled="categoriesLoading"
                @change="clearBudgetFieldError('category_id')"
              >
                <option value="">
                  {{ categoriesLoading ? 'Loading categories...' : 'All expenses' }}
                </option>
                <option
                  v-for="category in expenseCategories"
                  :key="category.id"
                  :value="String(category.id)"
                >
                  {{ category.name }}
                </option>
              </select>
              <small v-if="categoriesError" class="section-field-error">
                {{ categoriesError }}
              </small>
              <small
                v-else-if="!categoriesLoading && expenseCategories.length === 0"
                class="section-field-hint"
              >
                Create expense categories first, or keep the budget untied to a category.
              </small>
              <small v-if="budgetFieldErrors.category_id" class="section-field-error">
                {{ budgetFieldErrors.category_id }}
              </small>
            </label>

            <label class="section-field">
              <span>Start date</span>
              <input
                v-model="budgetForm.start_date"
                type="date"
                name="start_date"
                @input="clearBudgetFieldError('start_date')"
              />
              <small v-if="budgetFieldErrors.start_date" class="section-field-error">
                {{ budgetFieldErrors.start_date }}
              </small>
            </label>

            <label class="section-field">
              <span>End date</span>
              <input
                v-model="budgetForm.end_date"
                type="date"
                name="end_date"
                @input="clearBudgetFieldError('end_date')"
              />
              <small v-if="budgetFieldErrors.end_date" class="section-field-error">
                {{ budgetFieldErrors.end_date }}
              </small>
            </label>
          </div>

          <p class="section-field-hint">
            Custom budgets should include both dates. Weekly, monthly, and yearly budgets can use the
            current period without dates.
          </p>

          <div class="section-form-actions">
            <button class="section-submit" type="submit" :disabled="submitting">
              <span v-if="submitting" class="section-spinner" aria-hidden="true"></span>
              {{ submitting ? 'Saving...' : 'Save budget' }}
            </button>
          </div>
        </form>
      </article>

      <article class="section-panel">
        <div class="section-panel-head">
          <div>
            <p class="section-kicker">Information</p>
            <h3>Budget list</h3>
          </div>
          <span class="section-panel-badge">{{ budgetCount }} budgets</span>
        </div>

        <div v-if="loading && budgets.length === 0" class="section-empty">
          Loading budgets...
        </div>

        <div v-else-if="budgets.length" class="section-list">
          <article v-for="(budget, index) in budgets" :key="budget.id" class="section-list-row">
            <div class="section-list-icon" :style="{ '--accent': budgetAccent(index) }">
              %
            </div>

            <div class="section-list-copy">
              <div class="section-row-head">
                <div>
                  <h4>{{ budgetCategoryLabel(budget) }}</h4>
                  <span
                    class="section-chip"
                    :class="budget.status === 'overspent' ? 'section-chip--warning' : 'section-chip--positive'"
                  >
                    {{ budget.status === 'overspent' ? 'Overspent' : 'On track' }}
                  </span>
                </div>

                <div class="budget-row-side">
                  <strong>{{ Math.round(normalizeNumber(budget.progress)) }}%</strong>
                  <div class="budget-row-actions">
                    <button
                      class="section-button budget-action-button"
                      type="button"
                      :disabled="budgetActionDisabled"
                      @click="openEditBudget(budget)"
                    >
                      Edit
                    </button>
                    <button
                      class="section-button budget-action-button budget-action-button--danger"
                      type="button"
                      :disabled="budgetActionDisabled"
                      @click="removeBudget(budget)"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <p class="section-row-meta">
                {{ budgetPeriodLabel(budget.period) }} | Spent {{ formatCurrency(budget.spent) }} of
                {{ formatCurrency(budget.amount) }}
              </p>
              <p class="section-row-subtext">
                {{ budgetRemainingLabel(budget) }}
              </p>

              <div class="section-progress">
                <div
                  class="section-progress-fill"
                  :style="{ width: `${Math.min(100, normalizeNumber(budget.progress))}%`, '--accent': budgetAccent(index) }"
                ></div>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="section-empty">
          No budgets are available yet.
        </div>
      </article>
    </section>

    <transition name="fade">
      <div
        v-if="budgetModalOpen"
        class="modal-backdrop"
        role="presentation"
        @click.self="closeBudgetModal"
      >
        <section class="budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-modal-title">
          <header class="budget-modal-header">
            <div>
              <p class="section-kicker">Edit budget</p>
              <h3 id="budget-modal-title">Edit budget</h3>
              <p class="budget-modal-copy">
                Update the selected budget details, then save the revised record.
              </p>
            </div>
            <button
              type="button"
              class="section-button section-button--ghost budget-modal-close"
              @click="closeBudgetModal"
            >
              Close
            </button>
          </header>

          <form class="section-form budget-form" @submit.prevent="submitBudgetEdit" novalidate>
            <div v-if="budgetEditError" class="section-form-alert" role="alert">
              {{ budgetEditError }}
            </div>

            <div class="section-form-grid">
              <label class="section-field">
                <span>Amount</span>
                <input
                  v-model="budgetEditForm.amount"
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  inputmode="decimal"
                  placeholder="0.00"
                  @input="clearBudgetEditFieldError('amount')"
                />
                <small v-if="budgetEditFieldErrors.amount" class="section-field-error">
                  {{ budgetEditFieldErrors.amount }}
                </small>
              </label>

              <label class="section-field">
                <span>Period</span>
                <select
                  v-model="budgetEditForm.period"
                  name="period"
                  @change="clearBudgetEditFieldError('period')"
                >
                  <option v-for="option in budgetPeriods" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <small v-if="budgetEditFieldErrors.period" class="section-field-error">
                  {{ budgetEditFieldErrors.period }}
                </small>
              </label>

              <label class="section-field section-field--span-2">
                <span>Category</span>
                <select
                  v-model="budgetEditForm.category_id"
                  name="category_id"
                  :disabled="categoriesLoading"
                  @change="clearBudgetEditFieldError('category_id')"
                >
                  <option value="">
                    {{ categoriesLoading ? 'Loading categories...' : 'All expenses' }}
                  </option>
                  <option
                    v-for="category in budgetEditCategoryOptions"
                    :key="category.id"
                    :value="String(category.id)"
                  >
                    {{ category.name }}
                  </option>
                </select>
                <small v-if="categoriesError" class="section-field-error">
                  {{ categoriesError }}
                </small>
                <small
                  v-else-if="!categoriesLoading && budgetEditCategoryOptions.length === 0"
                  class="section-field-hint"
                >
                  Create expense categories first, or keep the budget untied to a category.
                </small>
                <small v-if="budgetEditFieldErrors.category_id" class="section-field-error">
                  {{ budgetEditFieldErrors.category_id }}
                </small>
              </label>

              <label class="section-field">
                <span>Start date</span>
                <input
                  v-model="budgetEditForm.start_date"
                  type="date"
                  name="start_date"
                  @input="clearBudgetEditFieldError('start_date')"
                />
                <small v-if="budgetEditFieldErrors.start_date" class="section-field-error">
                  {{ budgetEditFieldErrors.start_date }}
                </small>
              </label>

              <label class="section-field">
                <span>End date</span>
                <input
                  v-model="budgetEditForm.end_date"
                  type="date"
                  name="end_date"
                  @input="clearBudgetEditFieldError('end_date')"
                />
                <small v-if="budgetEditFieldErrors.end_date" class="section-field-error">
                  {{ budgetEditFieldErrors.end_date }}
                </small>
              </label>
            </div>

            <p class="section-field-hint">
              Custom budgets should include both dates. Weekly, monthly, and yearly budgets can use the
              current period without dates.
            </p>

            <div class="section-form-actions">
              <button class="section-button section-button--ghost" type="button" @click="closeBudgetModal">
                Cancel
              </button>
              <button class="section-submit" type="submit" :disabled="budgetEditSubmitting">
                <span v-if="budgetEditSubmitting" class="section-spinner" aria-hidden="true"></span>
                {{ budgetEditSubmitting ? 'Saving...' : 'Save changes' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </transition>
  </DashboardShell>
</template>

<style scoped>
.budget-row-side {
  display: grid;
  justify-items: end;
  gap: 0.55rem;
}

.budget-row-side strong {
  white-space: nowrap;
  font-weight: 800;
}

.budget-row-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.budget-action-button {
  min-height: 2.3rem;
  padding: 0.45rem 0.75rem;
  border-radius: 0.85rem;
  font-size: 0.82rem;
  letter-spacing: 0.01em;
}

.budget-action-button--danger {
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

.budget-modal {
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

.budget-modal-header {
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

.budget-modal-header h3 {
  margin: 0;
  font-size: 1.85rem;
  letter-spacing: -0.04em;
}

.budget-modal-copy {
  margin: 0.35rem 0 0;
  color: rgba(232, 237, 247, 0.72);
}

.budget-modal-close {
  min-height: 2.4rem;
  padding: 0.45rem 0.8rem;
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #f4f7fc;
  flex: 0 0 auto;
}

.budget-form {
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
  .budget-row-side {
    width: 100%;
    justify-items: start;
  }

  .budget-row-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .budget-action-button {
    flex: 1 1 0;
  }

  .budget-modal {
    display: flex;
    flex-direction: column;
    height: min(calc(100dvh - 1.5rem), 52rem);
  }

  .budget-modal-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .budget-modal-close {
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
  .budget-modal {
    height: min(calc(100dvh - 1.25rem), 52rem);
  }
}
</style>
