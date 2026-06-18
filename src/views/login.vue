<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { loginUser } from '@/services/api'
import { setStoredUser } from '@/utils/auth'

const router = useRouter()

const form = reactive({
  name: '',
  phone: '',
})

const fieldErrors = reactive({
  name: '',
  phone: '',
})

const generalError = ref('')
const loading = ref(false)

const phoneDigitCount = computed(() => form.phone.length)
const canSubmit = computed(() => !loading.value && phoneDigitCount.value === 11)

function clearFieldError(field) {
  fieldErrors[field] = ''
  generalError.value = ''
}

function sanitizePhoneInput(event) {
  form.phone = event.target.value.replace(/\D/g, '').slice(0, 11)
  clearFieldError('phone')
}

function firstErrorMessage(value) {
  if (Array.isArray(value)) {
    return value[0] || ''
  }

  if (typeof value === 'string') {
    return value
  }

  return ''
}

function applyValidationErrors(errors) {
  Object.entries(errors || {}).forEach(([field, value]) => {
    const message = firstErrorMessage(value)
    if (!message) {
      return
    }

    if (field in fieldErrors) {
      fieldErrors[field] = message
      return
    }

    generalError.value = message
  })
}

async function handleSubmit() {
  fieldErrors.name = ''
  fieldErrors.phone = ''
  generalError.value = ''

  const phone = form.phone.replace(/\D/g, '')
  const name = form.name.trim()

  if (phone.length !== 11) {
    fieldErrors.phone = 'Phone number must be exactly 11 digits.'
    return
  }

  loading.value = true

  try {
    const response = await loginUser({
      phone,
      name: name || null,
    })

    const user = response?.data
    if (!user) {
      throw new Error('The server did not return a user.')
    }

    setStoredUser(user)
    await router.replace({ name: 'dashboard' })
  } catch (error) {
    const payload = error?.payload

    if (error?.status === 422 && payload?.errors) {
      applyValidationErrors(payload.errors)
      return
    }

    generalError.value = payload?.message || error?.message || 'Unable to log in right now.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="hero-panel">
      <div class="brand-row">
        <div class="brand-mark">ET</div>
        <div>
          <p class="brand-label">Expense tracker</p>
          <h1>Money flow, built around a phone number.</h1>
        </div>
      </div>

      <p class="hero-copy">
        Log in with your name and 11-digit phone number. The API will create the user if needed
        and take you straight to the dashboard.
      </p>

      <div class="hero-cards">
        <article>
          <span>1</span>
          <strong>Login request</strong>
          <p>Submit once and receive the user profile back.</p>
        </article>
        <article>
          <span>2</span>
          <strong>Scoped data</strong>
          <p>Accounts, categories, transactions, and budgets stay tied to one user.</p>
        </article>
        <article>
          <span>3</span>
          <strong>Dashboard ready</strong>
          <p>The next screen is waiting for your tracked data.</p>
        </article>
      </div>

      <ul class="feature-list">
        <li>Phone-based login, no password flow.</li>
        <li>Backend creates the user on first sign-in.</li>
        <li>Validation messages come from Laravel.</li>
      </ul>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <p class="card-kicker">Member access</p>
        <h2>Continue to your dashboard</h2>
        <p class="card-description">
          Enter the phone number linked to your profile. A name helps personalize the account, but
          the backend accepts an empty name too.
        </p>

        <div v-if="generalError" class="alert" role="alert" aria-live="polite">
          {{ generalError }}
        </div>

        <form class="login-form" @submit.prevent="handleSubmit" novalidate>
          <label class="field">
            <span>Name</span>
            <input
              v-model="form.name"
              type="text"
              name="name"
              autocomplete="name"
              placeholder="Your name"
              @input="clearFieldError('name')"
            />
            <small v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name }}</small>
          </label>

          <label class="field">
            <span>Phone number</span>
            <input
              :value="form.phone"
              type="tel"
              name="phone"
              inputmode="numeric"
              autocomplete="tel"
              placeholder="01XXXXXXXXX"
              maxlength="11"
              @input="sanitizePhoneInput"
            />
            <div class="field-meta">
              <small class="field-hint">11 digits only. Example: 01712345678</small>
              <small class="field-count">{{ phoneDigitCount }}/11</small>
            </div>
            <small v-if="fieldErrors.phone" class="field-error">{{ fieldErrors.phone }}</small>
          </label>

          <button class="submit-button" type="submit" :disabled="!canSubmit">
            <span v-if="loading" class="spinner" aria-hidden="true"></span>
            {{ loading ? 'Logging in...' : 'Log in' }}
          </button>
        </form>
      </div>

      <p class="footer-note">
        The user record is stored locally after a successful login so the dashboard can stay in
        sync while you build the rest of the app.
      </p>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
  position: relative;
  overflow: hidden;
}

.login-page::before,
.login-page::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  filter: blur(12px);
  pointer-events: none;
}

.login-page::before {
  width: 22rem;
  height: 22rem;
  right: -7rem;
  top: -6rem;
  background: radial-gradient(circle, rgba(48, 151, 255, 0.22), transparent 68%);
}

.login-page::after {
  width: 18rem;
  height: 18rem;
  left: -5rem;
  bottom: -5rem;
  background: radial-gradient(circle, rgba(47, 204, 157, 0.18), transparent 68%);
}

.hero-panel,
.login-panel {
  position: relative;
  z-index: 1;
}

.hero-panel {
  padding: clamp(2rem, 5vw, 4.5rem);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2rem;
}

.brand-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.brand-mark {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 1rem;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #4c7dff, #39d0b4);
  color: #08111f;
  font-weight: 800;
  letter-spacing: 0.08em;
  box-shadow: 0 18px 40px rgba(42, 123, 255, 0.28);
}

.brand-label {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 0.74rem;
  color: rgba(232, 237, 247, 0.62);
}

.brand-row h1 {
  margin: 0;
  max-width: 14ch;
  font-size: clamp(2.8rem, 5vw, 5rem);
  line-height: 0.96;
  letter-spacing: -0.05em;
}

.hero-copy {
  margin: 0;
  max-width: 38rem;
  font-size: 1.05rem;
  color: rgba(232, 237, 247, 0.76);
}

.hero-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.hero-cards article {
  padding: 1.15rem;
  border-radius: 1.2rem;
  background: rgba(8, 17, 31, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(18px);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.16);
}

.hero-cards span {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  margin-bottom: 1rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(86, 126, 255, 0.16);
  color: #88a8ff;
  font-weight: 700;
}

.hero-cards strong {
  display: block;
  margin-bottom: 0.35rem;
}

.hero-cards p,
.feature-list {
  color: rgba(232, 237, 247, 0.7);
}

.hero-cards p {
  margin: 0;
}

.feature-list {
  margin: 0;
  padding-left: 1.2rem;
  display: grid;
  gap: 0.65rem;
  max-width: 34rem;
}

.login-panel {
  padding: clamp(1rem, 3vw, 2rem);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.login-card {
  width: min(100%, 28rem);
  padding: 2rem;
  border-radius: 1.5rem;
  background: rgba(8, 17, 31, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.11);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(22px);
}

.card-kicker {
  margin: 0 0 0.6rem;
  color: #88a8ff;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.74rem;
}

.login-card h2 {
  margin: 0;
  font-size: 2rem;
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.card-description {
  margin: 0.85rem 0 1.5rem;
  color: rgba(232, 237, 247, 0.72);
}

.alert {
  padding: 0.95rem 1rem;
  margin-bottom: 1rem;
  border-radius: 1rem;
  background: rgba(225, 87, 87, 0.14);
  border: 1px solid rgba(225, 87, 87, 0.28);
  color: #ffc8c8;
}

.login-form {
  display: grid;
  gap: 1rem;
}

.field {
  display: grid;
  gap: 0.55rem;
}

.field > span {
  font-size: 0.92rem;
  color: rgba(232, 237, 247, 0.82);
}

.field input {
  width: 100%;
  padding: 0.95rem 1rem;
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

.field input::placeholder {
  color: rgba(232, 237, 247, 0.35);
}

.field input:focus {
  border-color: rgba(93, 148, 255, 0.62);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 4px rgba(75, 122, 255, 0.12);
}

.field-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.field-hint,
.field-count,
.footer-note {
  color: rgba(232, 237, 247, 0.58);
}

.field-error {
  color: #ffb1b1;
}

.submit-button {
  min-height: 3.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  border: 0;
  border-radius: 1rem;
  background: linear-gradient(135deg, #4c7dff, #39d0b4);
  color: #08111f;
  font-weight: 800;
  letter-spacing: 0.01em;
  box-shadow: 0 18px 36px rgba(56, 129, 255, 0.28);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 22px 44px rgba(56, 129, 255, 0.34);
}

.submit-button:disabled {
  opacity: 0.6;
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

.footer-note {
  width: min(100%, 28rem);
  margin: 0;
  font-size: 0.92rem;
  text-align: center;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 960px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .hero-panel {
    padding-bottom: 0;
  }

  .hero-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .hero-panel {
    padding: 1.5rem 1.25rem 0;
  }

  .brand-row h1 {
    max-width: none;
    font-size: clamp(2.2rem, 12vw, 3.4rem);
  }

  .login-panel {
    padding: 1rem 1.25rem 1.5rem;
  }

  .login-card {
    padding: 1.4rem;
  }

  .field-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }
}
</style>
