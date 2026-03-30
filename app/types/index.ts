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

export interface User {
  id: string;
  email: string;
  name: string;
  password?: string;
  avatar?: string;
  createdAt?: string | Date;
  recurringExpenses?: RecurringExpenseTemplate[];
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
