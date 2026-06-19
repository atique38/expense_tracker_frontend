<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { clearStoredUser, getStoredUser } from '@/utils/auth'

const props = defineProps({
  activeSection: {
    type: String,
    default: 'dashboard',
  },
})

const router = useRouter()
const storedUser = ref(getStoredUser())

const displayName = computed(() => storedUser.value?.name?.trim() || 'Account holder')
const phoneNumber = computed(() => storedUser.value?.phone || 'Not available')
const avatarLabel = computed(() => {
  const name = displayName.value.trim()
  return (name[0] || phoneNumber.value[0] || 'U').toUpperCase()
})

const navItems = [
  { name: 'dashboard', label: 'Overview', key: 'dashboard' },
  { name: 'accounts', label: 'Accounts', key: 'accounts' },
  { name: 'categories', label: 'Categories', key: 'categories' },
  { name: 'transactions', label: 'Transactions', key: 'transactions' },
  { name: 'budgets', label: 'Budgets', key: 'budgets' },
]

function signOut() {
  clearStoredUser()
  router.replace({ name: 'login' })
}
</script>

<template>
  <main class="expense-page">
    <section class="expense-shell">
      <aside class="expense-rail">
        <div class="expense-brand">
          <div class="expense-brand-mark">ET</div>
          <div>
            <p class="expense-kicker">Expense tracker</p>
            <h1>Dashboard</h1>
          </div>
        </div>

        <nav class="expense-nav" aria-label="Dashboard sections">
          <RouterLink
            v-for="item in navItems"
            :key="item.key"
            :to="{ name: item.name }"
            class="expense-nav-link"
            :class="{ active: props.activeSection === item.key }"
            active-class="active"
            exact-active-class="active"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="expense-profile">
          <div class="expense-avatar">{{ avatarLabel }}</div>
          <div>
            <p class="expense-profile-label">Signed in as</p>
            <h2>{{ displayName }}</h2>
            <p class="expense-profile-meta">{{ phoneNumber }}</p>
          </div>
        </div>

        <button class="expense-signout" type="button" @click="signOut">
          Sign out
        </button>
      </aside>

      <section class="expense-workspace">
        <slot name="alert" />
        <slot name="header" />
        <slot />
      </section>
    </section>
  </main>
</template>

<style>
.expense-page {
  min-height: 100vh;
  padding: clamp(1rem, 2.5vw, 2rem);
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(76, 125, 255, 0.18), transparent 32%),
    radial-gradient(circle at bottom left, rgba(57, 208, 180, 0.14), transparent 28%),
    #050a12;
}

.expense-page::before,
.expense-page::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  filter: blur(18px);
  pointer-events: none;
}

.expense-page::before {
  width: 26rem;
  height: 26rem;
  right: -10rem;
  top: -8rem;
  background: radial-gradient(circle, rgba(59, 126, 255, 0.22), transparent 66%);
}

.expense-page::after {
  width: 20rem;
  height: 20rem;
  left: -8rem;
  bottom: -8rem;
  background: radial-gradient(circle, rgba(57, 208, 180, 0.16), transparent 68%);
}

.expense-shell {
  position: relative;
  z-index: 1;
  width: min(100%, 80rem);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  gap: 1rem;
}

.expense-rail,
.section-topbar,
.section-metric,
.section-panel,
.section-alert {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(8, 17, 31, 0.72);
  backdrop-filter: blur(22px);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
}

.expense-rail {
  border-radius: 1.5rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  align-self: start;
  position: sticky;
  top: 1rem;
}

.expense-brand {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.expense-brand-mark,
.expense-avatar,
.section-list-icon {
  display: grid;
  place-items: center;
  border-radius: 1rem;
  font-weight: 800;
}

.expense-brand-mark {
  width: 3rem;
  height: 3rem;
  background: linear-gradient(135deg, #4c7dff, #39d0b4);
  color: #08111f;
  letter-spacing: 0.08em;
}

.expense-kicker,
.expense-profile-label,
.section-kicker,
.section-label {
  margin: 0 0 0.3rem;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 0.72rem;
  color: rgba(232, 237, 247, 0.56);
}

.expense-brand h1,
.expense-profile h2,
.section-topbar h2,
.section-panel h3,
.section-metric h3,
.section-row-head h4 {
  margin: 0;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.expense-profile {
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

.expense-avatar {
  width: 3rem;
  height: 3rem;
  background: linear-gradient(135deg, #4c7dff, #39d0b4);
  color: #08111f;
  font-size: 1.05rem;
}

.expense-profile-meta,
.section-copy,
.section-row-meta,
.section-row-subtext,
.section-metric-note {
  margin: 0;
  color: rgba(232, 237, 247, 0.72);
}

.expense-nav {
  display: grid;
  gap: 0.45rem;
}

.expense-nav-link {
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

.expense-nav-link:hover,
.expense-nav-link.active {
  border-color: rgba(93, 148, 255, 0.4);
  background: rgba(93, 148, 255, 0.12);
  transform: translateX(2px);
}

.expense-signout,
.section-button,
.section-submit {
  min-height: 2.9rem;
  border-radius: 1rem;
  border: 1px solid transparent;
  font-weight: 700;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    opacity 0.2s ease;
}

.expense-signout {
  margin-top: auto;
  background: rgba(255, 255, 255, 0.03);
  color: #f4f7fc;
  border-color: rgba(255, 255, 255, 0.08);
}

.expense-signout:hover,
.section-button:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(93, 148, 255, 0.35);
}

.expense-workspace {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.section-topbar {
  border-radius: 1.5rem;
  padding: 1.35rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.section-topbar h2 {
  font-size: clamp(1.8rem, 3vw, 2.4rem);
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.section-button {
  padding: 0.85rem 1.05rem;
  color: #f4f7fc;
}

.section-button--ghost {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08);
}

.section-button--primary,
.section-submit {
  background: linear-gradient(135deg, #4c7dff, #39d0b4);
  color: #08111f;
  box-shadow: 0 18px 36px rgba(56, 129, 255, 0.28);
}

.section-button--primary:hover:not(:disabled),
.section-submit:hover:not(:disabled) {
  box-shadow: 0 22px 44px rgba(56, 129, 255, 0.34);
}

.section-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 1.2rem;
  background: rgba(225, 87, 87, 0.12);
  border-color: rgba(225, 87, 87, 0.22);
  color: #ffd0d0;
}

.section-alert__button {
  padding: 0.7rem 0.95rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #f4f7fc;
}

.section-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.section-metric {
  border-radius: 1.4rem;
  padding: 1.25rem;
}

.section-metric--featured {
  background:
    radial-gradient(circle at top right, rgba(72, 129, 255, 0.2), transparent 45%),
    rgba(8, 17, 31, 0.82);
}

.section-metric-label,
.section-panel-badge,
.section-chip {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 800;
}

.section-metric-value {
  margin: 0.45rem 0 0;
  font-size: clamp(1.35rem, 2vw, 2rem);
  font-weight: 800;
}

.section-metric-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.75rem;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: rgba(57, 208, 180, 0.14);
  color: #7fe4cf;
}

.section-metric-strip,
.section-progress {
  margin-top: 0.95rem;
  width: 100%;
  height: 0.55rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.section-metric-strip-fill,
.section-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent, #5f8bff), rgba(255, 255, 255, 0.35));
}

.section-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 1rem;
}

.section-panel {
  border-radius: 1.45rem;
  padding: 1.25rem;
  min-width: 0;
}

.section-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-panel-badge {
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  color: rgba(232, 237, 247, 0.82);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
}

.section-empty {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(232, 237, 247, 0.64);
  text-align: center;
}

.section-list {
  display: grid;
  gap: 0.8rem;
}

.section-list-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  padding: 0.9rem;
  border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.section-list-icon {
  width: 2.75rem;
  height: 2.75rem;
  background: rgba(255, 255, 255, 0.05);
  color: var(--accent, #5f8bff);
  border: 1px solid var(--accent, #5f8bff);
}

.section-list-copy {
  min-width: 0;
}

.section-row-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.section-row-head strong {
  white-space: nowrap;
  font-weight: 800;
}

.section-row-meta,
.section-row-subtext {
  margin-top: 0.3rem;
}

.section-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(232, 237, 247, 0.82);
}

.section-chip--positive {
  background: rgba(57, 208, 180, 0.14);
  color: #7fe4cf;
}

.section-chip--warning {
  background: rgba(225, 87, 87, 0.14);
  color: #ffd0d0;
}

.section-progress {
  grid-column: 1 / -1;
  height: 0.45rem;
}

.section-form {
  display: grid;
  align-content: start;
  gap: 1rem;
}

.section-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.section-field {
  display: grid;
  gap: 0.55rem;
}

.section-field > span {
  font-size: 0.92rem;
  color: rgba(232, 237, 247, 0.82);
}

.section-field input,
.section-field select,
.section-field textarea {
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

.section-field select option {
  background: #0a1424;
  color: #f6f8fd;
}

.section-field textarea {
  min-height: 7.5rem;
  resize: vertical;
}

.section-field input::placeholder,
.section-field textarea::placeholder {
  color: rgba(232, 237, 247, 0.35);
}

.section-field input:focus,
.section-field select:focus,
.section-field textarea:focus {
  border-color: rgba(93, 148, 255, 0.62);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 4px rgba(75, 122, 255, 0.12);
}

.section-field-error,
.section-field-hint {
  font-size: 0.88rem;
}

.section-field-error {
  color: #ffb1b1;
}

.section-field-hint {
  color: rgba(232, 237, 247, 0.58);
}

.section-field--span-2 {
  grid-column: span 2;
}

.section-form-alert {
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  background: rgba(225, 87, 87, 0.12);
  border: 1px solid rgba(225, 87, 87, 0.24);
  color: #ffd0d0;
}

.section-form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.section-submit:disabled,
.section-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  box-shadow: none;
}

.section-spinner {
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 999px;
  border: 2px solid rgba(8, 17, 31, 0.26);
  border-top-color: rgba(8, 17, 31, 0.92);
  animation: expense-spin 0.8s linear infinite;
}

@keyframes expense-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1120px) {
  .expense-shell {
    grid-template-columns: 1fr;
  }

  .expense-rail {
    position: static;
  }

  .section-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .section-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .section-topbar {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 720px) {
  .expense-page {
    padding: 0.85rem;
  }

  .section-actions {
    width: 100%;
  }

  .section-button {
    flex: 1 1 0;
  }

  .section-metrics {
    grid-template-columns: 1fr;
  }

  .section-form-grid {
    grid-template-columns: 1fr;
  }

  .section-field--span-2 {
    grid-column: span 1;
  }

  .section-form-actions {
    flex-direction: column;
  }

  .section-button,
  .section-submit {
    width: 100%;
  }
}
</style>
