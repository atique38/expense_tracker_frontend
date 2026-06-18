const STORAGE_KEY = 'expense-tracker:user'

function getStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getStoredUser() {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  const rawUser = storage.getItem(STORAGE_KEY)
  if (!rawUser) {
    return null
  }

  try {
    return JSON.parse(rawUser)
  } catch {
    storage.removeItem(STORAGE_KEY)
    return null
  }
}

export function setStoredUser(user) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(user))
  } catch {
    // Ignore quota or privacy restrictions.
  }
}

export function clearStoredUser() {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.removeItem(STORAGE_KEY)
}
