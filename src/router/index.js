import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/dashboard.vue'
import AccountsView from '@/views/accounts.vue'
import CategoriesView from '@/views/categories.vue'
import LoginView from '@/views/login.vue'
import TransactionsView from '@/views/transactions.vue'
import BudgetsView from '@/views/budgets.vue'
import { getStoredUser } from '@/utils/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: () => (getStoredUser() ? { name: 'dashboard' } : { name: 'login' }),
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: {
        guestOnly: true,
      },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/dashboard/accounts',
      name: 'accounts',
      component: AccountsView,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/dashboard/categories',
      name: 'categories',
      component: CategoriesView,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/dashboard/transactions',
      name: 'transactions',
      component: TransactionsView,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/dashboard/budgets',
      name: 'budgets',
      component: BudgetsView,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: () => (getStoredUser() ? { name: 'dashboard' } : { name: 'login' }),
    },
  ],
})

router.beforeEach((to) => {
  const user = getStoredUser()

  if (to.meta.requiresAuth && !user) {
    return { name: 'login' }
  }

  if (to.meta.guestOnly && user) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
