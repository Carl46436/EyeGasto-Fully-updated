export interface RecurringExpenseTemplate {
  id: string;
  description: string;
  amount: number;
  category?: string;
  notes?: string;
  frequency: "monthly";
  startDate: string;
  dayOfMonth: number;
  lastGeneratedAt?: string;
  isActive?: boolean;
}

export interface CategoryBudget {
  id: string;
  category: string;
  limit: number;
  note?: string;
  updatedAt?: string;
}

export interface DebtItem {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  person?: string;
  note?: string;
  isPaid?: boolean;
  createdAt?: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  name: string;
  password?: string;
  avatar?: string;
  createdAt?: string | Date;
  recurringExpenses?: RecurringExpenseTemplate[];
  categoryBudgets?: CategoryBudget[];
  debtItems?: DebtItem[];
}

export interface Expense {
  id: string;
  userId?: string;
  description: string;
  amount: number;
  category?: string;
  notes?: string;
  date: string | Date;
  imageUrl?: string | null;
  receiptPath?: string | null;
  isPending?: boolean;
}

export type SyncStatus = "idle" | "offline" | "syncing" | "synced" | "error";
