<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import DashboardShell from '@/components/DashboardShell.vue'
import { createCategory, deleteCategory, fetchCategories, updateCategory } from '@/services/api'
import { getStoredUser } from '@/utils/auth'
import { normalizeNumber } from '@/utils/dashboard-display'

const router = useRouter()
const user = ref(getStoredUser())
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const editingCategoryId = ref(null)

const categories = ref([])

const categoryTypes = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

function createCategoryDefaults(category = null) {
  return {
    name: category?.name ? String(category.name) : '',
    type: category?.type || 'expense',
  }
}

function createCategoryFieldErrors() {
  return {
    name: '',
    type: '',
  }
}

const categoryForm = reactive(createCategoryDefaults())
const categoryFieldErrors = reactive(createCategoryFieldErrors())

const categoryCount = computed(() => categories.value.length)
const incomeCategoryCount = computed(
  () => categories.value.filter((category) => category.type === 'income').length,
)
const expenseCategoryCount = computed(
  () => categories.value.filter((category) => category.type === 'expense').length,
)

function resetCategoryFieldErrors() {
  Object.keys(categoryFieldErrors).forEach((key) => {
    categoryFieldErrors[key] = ''
  })
}

function clearCategoryFieldError(field) {
  if (field in categoryFieldErrors) {
    categoryFieldErrors[field] = ''
  }
}

function categoryInitial(name) {
  const value = (name || '').trim()
  return (value[0] || 'C').toUpperCase()
}

function categoryAccent(category, index) {
  if (category?.type === 'income') {
    const palette = ['#39d0b4', '#5f8bff', '#6fe6a7']
    return palette[index % palette.length]
  }

  const palette = ['#ffb84d', '#ff7bbf', '#a88bff', '#5f8bff']
  return palette[index % palette.length]
}

function normalizeCategories(payload) {
  categories.value = Array.isArray(payload) ? payload : []
}

async function loadCategories() {
  const userId = user.value?.id
  if (!userId) {
    router.replace({ name: 'login' })
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetchCategories(userId)
    normalizeCategories(response?.data)
  } catch (error) {
    errorMessage.value = error?.payload?.message || error?.message || 'Unable to load categories.'
  } finally {
    loading.value = false
  }
}

function applyValidationErrors(errors) {
  Object.entries(errors || {}).forEach(([field, value]) => {
    const message = Array.isArray(value) ? value[0] || '' : String(value || '')
    if (!message) {
      return
    }

    if (field in categoryFieldErrors) {
      categoryFieldErrors[field] = message
    } else {
      errorMessage.value = message
    }
  })
}

function startCreate() {
  editingCategoryId.value = null
  errorMessage.value = ''
  resetCategoryFieldErrors()
  Object.assign(categoryForm, createCategoryDefaults())
}

function startEdit(category) {
  editingCategoryId.value = category.id
  errorMessage.value = ''
  resetCategoryFieldErrors()
  Object.assign(categoryForm, createCategoryDefaults(category))
}

function cancelEdit() {
  startCreate()
}

async function submitCategory() {
  resetCategoryFieldErrors()
  errorMessage.value = ''

  const userId = user.value?.id
  if (!userId) {
    errorMessage.value = 'User session is missing. Please log in again.'
    return
  }

  const name = categoryForm.name.trim()
  const type = categoryForm.type

  if (!name) {
    categoryFieldErrors.name = 'Enter a category name.'
  }

  if (!type) {
    categoryFieldErrors.type = 'Choose a category type.'
  }

  if (Object.values(categoryFieldErrors).some(Boolean)) {
    return
  }

  submitting.value = true

  try {
    if (editingCategoryId.value) {
      await updateCategory(userId, editingCategoryId.value, { name, type })
    } else {
      await createCategory(userId, { name, type })
    }

    startCreate()
    await loadCategories()
  } catch (error) {
    if (error?.status === 422 && error?.payload?.errors) {
      applyValidationErrors(error.payload.errors)
      return
    }

    errorMessage.value = error?.payload?.message || error?.message || 'Unable to save category.'
  } finally {
    submitting.value = false
  }
}

async function confirmDelete(category) {
  const userId = user.value?.id
  if (!userId) {
    errorMessage.value = 'User session is missing. Please log in again.'
    return
  }

  const confirmed = window.confirm(`Delete the category "${category.name}"?`)
  if (!confirmed) {
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    await deleteCategory(userId, category.id)

    if (String(editingCategoryId.value) === String(category.id)) {
      startCreate()
    }

    await loadCategories()
  } catch (error) {
    errorMessage.value = error?.payload?.message || error?.message || 'Unable to delete category.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  startCreate()
  loadCategories()
})
</script>

<template>
  <DashboardShell active-section="categories">
    <template #header>
      <header class="section-topbar">
        <div>
          <p class="section-kicker">Categories</p>
          <h2>Category setup</h2>
          <p class="section-copy">
            Organize your income and expense groups before recording transactions or assigning budgets.
          </p>
        </div>

        <div class="section-actions">
          <button class="section-button section-button--ghost" type="button" @click="loadCategories">
            Refresh
          </button>
        </div>
      </header>
    </template>

    <div v-if="errorMessage" class="section-alert" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="section-alert__button" @click="loadCategories">Retry</button>
    </div>

    <section class="section-metrics">
      <article class="section-metric section-metric--featured">
        <p class="section-metric-label">Total categories</p>
        <h3>{{ normalizeNumber(categoryCount) }}</h3>
        <p class="section-metric-note">All user-owned categories</p>
        <div class="section-metric-strip">
          <div class="section-metric-strip-fill" :style="{ width: '100%' }"></div>
        </div>
      </article>

      <article class="section-metric">
        <p class="section-metric-label">Income categories</p>
        <h3>{{ normalizeNumber(incomeCategoryCount) }}</h3>
        <p class="section-metric-note">Used for deposits and earnings</p>
      </article>

      <article class="section-metric">
        <p class="section-metric-label">Expense categories</p>
        <h3>{{ normalizeNumber(expenseCategoryCount) }}</h3>
        <p class="section-metric-note">Used for spending and budgets</p>
      </article>

      <article class="section-metric">
        <p class="section-metric-label">Edit mode</p>
        <h3>{{ editingCategoryId ? 'Active' : 'Off' }}</h3>
        <p class="section-metric-note">
          {{ editingCategoryId ? 'You are editing an existing category.' : 'Create a new category.' }}
        </p>
      </article>
    </section>

    <section class="section-grid">
      <article class="section-panel">
        <div class="section-panel-head">
          <div>
            <p class="section-kicker">Setup</p>
            <h3>{{ editingCategoryId ? 'Update category' : 'Create category' }}</h3>
          </div>
        
        </div>

        <form class="section-form" @submit.prevent="submitCategory" novalidate>
          <div class="section-form-grid">
            <label class="section-field section-field--span-2">
              <span>Name</span>
              <input
                v-model="categoryForm.name"
                type="text"
                name="name"
                placeholder="Salary, Food, Transport..."
                @input="clearCategoryFieldError('name')"
              />
              <small v-if="categoryFieldErrors.name" class="section-field-error">
                {{ categoryFieldErrors.name }}
              </small>
            </label>

            <label class="section-field section-field--span-2">
              <span>Type</span>
              <select v-model="categoryForm.type" name="type" @change="clearCategoryFieldError('type')">
                <option v-for="option in categoryTypes" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <small v-if="categoryFieldErrors.type" class="section-field-error">
                {{ categoryFieldErrors.type }}
              </small>
            </label>
          </div>

          <p class="section-field-hint">
            Income categories group deposits. Expense categories are used by transactions and budgets.
          </p>

          <div class="section-form-actions">
            <button
              v-if="editingCategoryId"
              class="section-button section-button--ghost"
              type="button"
              @click="cancelEdit"
            >
              Cancel edit
            </button>
            <button class="section-submit" type="submit" :disabled="submitting">
              <span v-if="submitting" class="section-spinner" aria-hidden="true"></span>
              {{ editingCategoryId ? 'Update category' : 'Save category' }}
            </button>
          </div>
        </form>
      </article>

      <article class="section-panel">
        <div class="section-panel-head">
          <div>
            <p class="section-kicker">Information</p>
            <h3>Category list</h3>
          </div>
          <span class="section-panel-badge">{{ categoryCount }} categories</span>
        </div>

        <div v-if="loading && categories.length === 0" class="section-empty">
          Loading categories...
        </div>

        <div v-else-if="categories.length" class="section-list">
          <article v-for="(category, index) in categories" :key="category.id" class="section-list-row category-row">
            <div class="section-list-icon" :style="{ '--accent': categoryAccent(category, index) }">
              {{ categoryInitial(category.name) }}
            </div>

            <div class="section-list-copy">
              <div class="section-row-head">
                <div>
                  <h4>{{ category.name }}</h4>
                  <span
                    class="section-chip"
                    :class="category.type === 'income' ? 'section-chip--positive' : 'section-chip--warning'"
                  >
                    {{ category.type }}
                  </span>
                </div>

                <div class="category-actions">
                  <button type="button" class="category-action-button" @click="startEdit(category)">
                    Edit
                  </button>
                  <button
                    type="button"
                    class="category-action-button category-action-button--danger"
                    @click="confirmDelete(category)"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p class="section-row-meta">
                {{ category.type === 'income' ? 'Used for deposits and revenue.' : 'Used for spending and budget tracking.' }}
              </p>
            </div>
          </article>
        </div>

        <div v-else class="section-empty">
          No categories have been created yet.
        </div>
      </article>
    </section>
  </DashboardShell>
</template>

<style scoped>
.category-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.category-action-button {
  min-height: 2.35rem;
  padding: 0.5rem 0.8rem;
  border-radius: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #f4f7fc;
  font-weight: 700;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.category-action-button:hover {
  transform: translateY(-1px);
  border-color: rgba(93, 148, 255, 0.35);
}

.category-action-button--danger:hover {
  border-color: rgba(225, 87, 87, 0.42);
  background: rgba(225, 87, 87, 0.12);
}

@media (max-width: 720px) {
  .category-actions {
    width: 100%;
  }

  .category-action-button {
    flex: 1 1 0;
  }
}
</style>
