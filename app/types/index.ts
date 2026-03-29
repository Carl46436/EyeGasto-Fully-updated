export interface User {
  id: string;
  email: string;
  name: string;
  password?: string;
  avatar?: string;
  createdAt?: string | Date;
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
}
