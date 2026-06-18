const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')

function buildUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function parseResponse(response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function requestJson(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const data = await parseResponse(response)

  if (!response.ok) {
    const error = new Error(data?.message || 'Request failed.')
    error.status = response.status
    error.payload = data
    throw error
  }

  return data
}

export function loginUser(payload) {
  return requestJson('/api/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchDashboard(userId) {
  return requestJson(`/api/users/${userId}/dashboard`)
}

export function fetchCategories(userId) {
  return requestJson(`/api/users/${userId}/categories`)
}

export function createAccount(userId, payload) {
  return requestJson(`/api/users/${userId}/accounts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateAccount(userId, accountId, payload) {
  return requestJson(`/api/users/${userId}/accounts/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteAccount(userId, accountId) {
  return requestJson(`/api/users/${userId}/accounts/${accountId}`, {
    method: 'DELETE',
  })
}

export function createTransaction(userId, payload) {
  return requestJson(`/api/users/${userId}/transactions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchTransactions(userId) {
  return requestJson(`/api/users/${userId}/transactions`)
}

export function updateTransaction(userId, transactionId, payload) {
  return requestJson(`/api/users/${userId}/transactions/${transactionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteTransaction(userId, transactionId) {
  return requestJson(`/api/users/${userId}/transactions/${transactionId}`, {
    method: 'DELETE',
  })
}

export function createBudget(userId, payload) {
  return requestJson(`/api/users/${userId}/budgets`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateBudget(userId, budgetId, payload) {
  return requestJson(`/api/users/${userId}/budgets/${budgetId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteBudget(userId, budgetId) {
  return requestJson(`/api/users/${userId}/budgets/${budgetId}`, {
    method: 'DELETE',
  })
}
