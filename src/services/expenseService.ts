import { Expense, RecurringExpenseTemplate, User } from "../types";
import { supabase } from "./supabaseClient";
import authService from "./authService";
import expenseStorage from "./expenseStorage";
import networkService from "./networkService";
import { withNetworkTimeout } from "./networkTimeout";
import storageService, { StorageKeys } from "./storageService";

type PendingExpenseCreateOperation = {
  type: "create";
  localId: string;
  description: string;
  amount: number;
  category?: string;
  notes?: string;
  date: string;
  imageUri?: string | null;
};

type PendingExpenseUpdateOperation = {
  type: "update";
  expenseId: string;
  updates: {
    description?: string;
    amount?: number;
    category?: string;
    notes?: string;
    date?: string;
    imageUrl?: string | null;
    receiptPath?: string | null;
  };
};

type PendingExpenseDeleteOperation = {
  type: "delete";
  expenseId: string;
};

type PendingExpenseOperation =
  | PendingExpenseCreateOperation
  | PendingExpenseUpdateOperation
  | PendingExpenseDeleteOperation;

class ExpenseService {
  private getExpenseCacheKey(userId: string) {
    return `${StorageKeys.EXPENSE_CACHE_PREFIX}:${userId}`;
  }

  private getDeletedExpenseKey(userId: string) {
    return `${StorageKeys.EXPENSE_DELETED_PREFIX}:${userId}`;
  }

  private getPendingExpenseOperationsKey(userId: string) {
    return `${StorageKeys.PENDING_EXPENSE_OPERATIONS_PREFIX}:${userId}`;
  }

  private isRemoteImageUrl(value?: string | null) {
    return Boolean(value && (/^https?:\/\//i.test(value) || value.startsWith("data:")));
  }

  private serializeExpenseUpdates(updates: Partial<Expense>) {
    return {
      description: updates.description,
      amount: updates.amount,
      category: updates.category,
      notes: updates.notes,
      date:
        updates.date instanceof Date
          ? updates.date.toISOString()
          : typeof updates.date === "string"
            ? updates.date
            : undefined,
      imageUrl: updates.imageUrl,
      receiptPath: updates.receiptPath,
    };
  }

  private async isOfflineNow() {
    const status = await networkService.getStatus().catch(() => null);
    return status?.isOnline === false;
  }

  private async buildDurableOfflineImageUri(imageUri?: string | null) {
    if (!imageUri || this.isRemoteImageUrl(imageUri)) {
      return imageUri;
    }

    return expenseStorage.persistLocalImage(imageUri);
  }

  private async createOfflineExpense(
    userId: string,
    payload: {
      description: string;
      amount: number;
      category?: string;
      notes?: string;
      date: Date;
      imageUri?: string | null;
    },
  ) {
    const durableImageUri = await this.buildDurableOfflineImageUri(payload.imageUri);
    const offlineExpense: Expense = {
      id: `offline-${Date.now()}`,
      description: payload.description,
      amount: payload.amount,
      date: payload.date,
      category: payload.category || undefined,
      notes: payload.notes || undefined,
      imageUrl: durableImageUri ?? null,
      isPending: true,
    };
    const cachedExpenses = await this.getCachedExpenses(userId);

    await this.cacheExpenses(userId, [offlineExpense, ...cachedExpenses]);
    await this.enqueuePendingExpenseOperation(userId, {
      type: "create",
      localId: offlineExpense.id,
      description: payload.description,
      amount: payload.amount,
      category: payload.category || undefined,
      notes: payload.notes || undefined,
      date: payload.date.toISOString(),
      imageUri: durableImageUri ?? null,
    });

    return offlineExpense;
  }

  private async prepareOfflineExpenseUpdates(
    updates: PendingExpenseUpdateOperation["updates"],
  ): Promise<PendingExpenseUpdateOperation["updates"]> {
    if (!updates.imageUrl || this.isRemoteImageUrl(updates.imageUrl)) {
      return updates;
    }

    return {
      ...updates,
      imageUrl: await expenseStorage.persistLocalImage(updates.imageUrl),
    };
  }

  private async getPendingExpenseOperations(
    userId: string,
  ): Promise<PendingExpenseOperation[]> {
    return (
      (await storageService.getItem<PendingExpenseOperation[]>(
        this.getPendingExpenseOperationsKey(userId),
      )) ?? []
    );
  }

  private async setPendingExpenseOperations(
    userId: string,
    operations: PendingExpenseOperation[],
  ) {
    await storageService.setItem(
      this.getPendingExpenseOperationsKey(userId),
      operations,
    );
  }

  private async prunePendingExpenseOperations(
    userId: string,
    predicate: (operation: PendingExpenseOperation) => boolean,
  ) {
    const current = await this.getPendingExpenseOperations(userId);
    const next = current.filter((operation) => !predicate(operation));
    await this.setPendingExpenseOperations(userId, next);
  }

  private async enqueuePendingExpenseOperation(
    userId: string,
    operation: PendingExpenseOperation,
  ) {
    const current = await this.getPendingExpenseOperations(userId);

    if (operation.type === "create") {
      await this.setPendingExpenseOperations(userId, [...current, operation]);
      return;
    }

    if (operation.type === "update") {
      const createIndex = current.findIndex(
        (item) =>
          item.type === "create" && item.localId === operation.expenseId,
      );

      if (createIndex >= 0) {
        const createOp = current[createIndex] as PendingExpenseCreateOperation;
        current[createIndex] = {
          ...createOp,
          description:
            operation.updates.description ?? createOp.description,
          amount: operation.updates.amount ?? createOp.amount,
          category:
            operation.updates.category !== undefined
              ? operation.updates.category
              : createOp.category,
          notes:
            operation.updates.notes !== undefined
              ? operation.updates.notes
              : createOp.notes,
          date: operation.updates.date ?? createOp.date,
          imageUri:
            operation.updates.imageUrl !== undefined
              ? operation.updates.imageUrl
              : createOp.imageUri,
        };
        await this.setPendingExpenseOperations(userId, current);
        return;
      }

      const next = current.map((item) =>
        item.type === "update" && item.expenseId === operation.expenseId
          ? {
              ...item,
              updates: {
                ...item.updates,
                ...operation.updates,
              },
            }
          : item,
      );

      const hasExisting = current.some(
        (item) => item.type === "update" && item.expenseId === operation.expenseId,
      );

      await this.setPendingExpenseOperations(
        userId,
        hasExisting ? next : [...current, operation],
      );
      return;
    }

    const createIndex = current.findIndex(
      (item) => item.type === "create" && item.localId === operation.expenseId,
    );

    if (createIndex >= 0) {
      const next = current.filter((_, index) => index !== createIndex);
      await this.setPendingExpenseOperations(userId, next);
      return;
    }

    const next = current.filter(
      (item) =>
        !(
          item.type === "update" &&
          item.expenseId === operation.expenseId
        ) &&
        !(
          item.type === "delete" &&
          item.expenseId === operation.expenseId
        ),
    );

    await this.setPendingExpenseOperations(userId, [...next, operation]);
  }

  private async createExpenseRemotely(
    userId: string,
    payload: {
      description: string;
      amount: number;
      category?: string;
      notes?: string;
      date?: string;
      imageUri?: string | null;
    },
  ): Promise<{ expense?: Expense; error?: string }> {
    let uploadedReceipt:
      | { imageUrl?: string; path?: string }
      | undefined;

    if (payload.imageUri && !this.isRemoteImageUrl(payload.imageUri)) {
      const uploadResult = await expenseStorage.uploadReceipt(payload.imageUri);
      if (!uploadResult.success) {
        return { error: uploadResult.error || "Failed to upload receipt" };
      }
      uploadedReceipt = uploadResult;
    }

    const { data, error } = await withNetworkTimeout(
      supabase
        .from("expenses")
        .insert({
          user_id: userId,
          description: payload.description,
          amount: payload.amount,
          date: payload.date ?? new Date().toISOString(),
          category: payload.category || null,
          notes: payload.notes || null,
          image_url:
            uploadedReceipt?.imageUrl ??
            (this.isRemoteImageUrl(payload.imageUri) ? payload.imageUri : null) ??
            null,
          receipt_path: uploadedReceipt?.path || null,
        })
        .select("*")
        .single(),
    ).catch(() => ({ data: null, error: new Error("Network timed out") }));

    if (error || !data) {
      return { error: error?.message || "Failed to create expense" };
    }

    return { expense: this.mapExpenseRecord(data) };
  }

  private async updateExpenseRemotely(
    userId: string,
    expenseId: string,
    updates: PendingExpenseUpdateOperation["updates"],
  ): Promise<{ expense?: Expense; error?: string }> {
    const { data: existingExpense, error: existingError } = await withNetworkTimeout(
      supabase
        .from("expenses")
        .select("*")
        .eq("id", expenseId)
        .eq("user_id", userId)
        .maybeSingle(),
    ).catch(() => ({ data: null, error: new Error("Network timed out") }));

    if (existingError) {
      return { error: existingError.message };
    }

    if (!existingExpense) {
      return { error: "Expense not found" };
    }

    const updatePayload: Record<string, any> = {
      description: updates.description,
      amount: updates.amount,
      category: updates.category,
      notes: updates.notes,
      date: updates.date,
    };

    if (updates.imageUrl !== undefined) {
      if (updates.imageUrl && !this.isRemoteImageUrl(updates.imageUrl)) {
        const uploadResult = await expenseStorage.uploadReceipt(updates.imageUrl);
        if (!uploadResult.success) {
          return { error: uploadResult.error || "Failed to upload receipt" };
        }
        updatePayload.image_url = uploadResult.imageUrl ?? null;
        updatePayload.receipt_path = uploadResult.path ?? null;
      } else {
        updatePayload.image_url = updates.imageUrl;
        updatePayload.receipt_path = updates.receiptPath ?? null;
      }
    }

    Object.keys(updatePayload).forEach((key) => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key];
      }
    });

    const { data, error } = await withNetworkTimeout(
      supabase
        .from("expenses")
        .update(updatePayload)
        .eq("id", expenseId)
        .eq("user_id", userId)
        .select("*")
        .maybeSingle(),
    ).catch(() => ({ data: null, error: new Error("Network timed out") }));

    if (error) {
      return { error: error.message };
    }

    const shouldRemoveOldReceipt =
      existingExpense.receipt_path &&
      existingExpense.receipt_path !== data?.receipt_path &&
      (updates.imageUrl !== undefined || updates.receiptPath === null);

    if (shouldRemoveOldReceipt) {
      await expenseStorage.removeReceipt(existingExpense.receipt_path);
    }

    return { expense: this.mapExpenseRecord(data ?? existingExpense) };
  }

  private async deleteExpenseRemotely(
    userId: string,
    expenseId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await withNetworkTimeout(
      supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId)
        .eq("user_id", userId)
        .select("receipt_path")
        .single(),
    ).catch(() => ({ data: null, error: new Error("Network timed out") }));

    if (error) {
      return { success: false, error: error.message };
    }

    await expenseStorage.removeReceipt(data?.receipt_path);
    return { success: true };
  }

  private async cacheExpenses(userId: string, expenses: Expense[]) {
    await storageService.setItem(this.getExpenseCacheKey(userId), expenses);
  }

  private async getDeletedExpenseIds(userId: string) {
    return (
      (await storageService.getItem<string[]>(this.getDeletedExpenseKey(userId))) ??
      []
    );
  }

  private async setDeletedExpenseIds(userId: string, ids: string[]) {
    await storageService.setItem(this.getDeletedExpenseKey(userId), ids);
  }

  private async getCachedExpenses(userId: string): Promise<Expense[]> {
    const cached =
      await storageService.getItem<(Expense & { date: string })[]>(
        this.getExpenseCacheKey(userId),
      );

    if (!cached) {
      return [];
    }

    return cached.map((expense) => ({
      ...expense,
      date: new Date(expense.date),
    }));
  }

  async getLocalExpenses(currentUser: User | string): Promise<Expense[]> {
    const userId = typeof currentUser === "string" ? currentUser : currentUser.id;
    const cachedExpenses = await this.getCachedExpenses(userId);
    const deletedIds = await this.getDeletedExpenseIds(userId);

    return cachedExpenses
      .filter((expense) => !deletedIds.includes(expense.id))
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
  }

  private mergeRemoteAndCachedExpenses(
    remoteExpenses: Expense[],
    cachedExpenses: Expense[],
    deletedIds: string[],
  ) {
    const merged = new Map<string, Expense>();

    remoteExpenses.forEach((expense) => {
      if (!deletedIds.includes(expense.id)) {
        merged.set(expense.id, expense);
      }
    });

    cachedExpenses.forEach((expense) => {
      if (deletedIds.includes(expense.id)) {
        return;
      }

      if (expense.isPending || !merged.has(expense.id)) {
        merged.set(expense.id, expense);
      }
    });

    return Array.from(merged.values()).sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  private getNextRecurringDate(
    template: RecurringExpenseTemplate,
    fromDate: Date,
  ) {
    const startDate = new Date(template.startDate);
    const nextDate = new Date(fromDate);
    nextDate.setMonth(nextDate.getMonth() + 1, 1);

    const daysInMonth = new Date(
      nextDate.getFullYear(),
      nextDate.getMonth() + 1,
      0,
    ).getDate();

    nextDate.setDate(Math.min(template.dayOfMonth, daysInMonth));
    nextDate.setHours(
      startDate.getHours(),
      startDate.getMinutes(),
      startDate.getSeconds(),
      startDate.getMilliseconds(),
    );

    return nextDate;
  }

  private mapExpenseRecord(record: any): Expense {
    const resolvedImageUrl =
      expenseStorage.getReceiptPublicUrl(record.receipt_path) ||
      record.image_url ||
      undefined;

    return {
      id: record.id,
      description: record.description,
      amount: record.amount,
      date: new Date(record.date),
      category: record.category ?? undefined,
      notes: record.notes ?? undefined,
      imageUrl: resolvedImageUrl,
      receiptPath: record.receipt_path ?? undefined,
    };
  }

  async addExpense(
    description: string,
    amount: number,
    category?: string,
    notes?: string,
    imageUri?: string,
  ): Promise<{ success: boolean; expense?: Expense; error?: string }> {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: "User not authenticated" };
      }

      if (!description || !amount) {
        return { success: false, error: "Description and amount are required" };
      }

      if (amount <= 0) {
        return { success: false, error: "Amount must be greater than 0" };
      }

      const createdAt = new Date();

      if (await this.isOfflineNow()) {
        const offlineExpense = await this.createOfflineExpense(currentUser.id, {
          description,
          amount,
          category,
          notes,
          date: createdAt,
          imageUri,
        });

        return { success: true, expense: offlineExpense };
      }

      const remoteResult = await this.createExpenseRemotely(currentUser.id, {
        description,
        amount,
        category,
        notes,
        date: createdAt.toISOString(),
        imageUri,
      });

      if (remoteResult.error || !remoteResult.expense) {
        const offlineExpense = await this.createOfflineExpense(currentUser.id, {
          description,
          amount,
          category,
          notes,
          date: createdAt,
          imageUri,
        });

        return { success: true, expense: offlineExpense };
      }

      const mappedExpense = remoteResult.expense;
      const cachedExpenses = await this.getCachedExpenses(currentUser.id);
      await this.cacheExpenses(currentUser.id, [mappedExpense, ...cachedExpenses]);

      return { success: true, expense: mappedExpense };
    } catch (error: any) {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return {
          success: false,
          error: error.message || "Failed to add expense",
        };
      }

      const offlineExpense = await this.createOfflineExpense(currentUser.id, {
        description,
        amount,
        category,
        notes,
        date: new Date(),
        imageUri,
      });

      return { success: true, expense: offlineExpense };
    }
  }

  async syncRecurringExpenses(
    currentUser?: User | null,
  ): Promise<{ syncedCount: number; user?: User }> {
    const resolvedUser = currentUser ?? (await authService.getCurrentUser());
    const recurringExpenses = resolvedUser?.recurringExpenses ?? [];

    if (!resolvedUser || recurringExpenses.length === 0) {
      return { syncedCount: 0, user: resolvedUser ?? undefined };
    }

    const now = new Date();
    let syncedCount = 0;
    let templatesChanged = false;
    const nextTemplates = [...recurringExpenses];

    for (let index = 0; index < nextTemplates.length; index += 1) {
      const template = nextTemplates[index];
      if (template.isActive === false) {
        continue;
      }

      let cursor = new Date(template.lastGeneratedAt || template.startDate);
      let latestGeneratedAt = template.lastGeneratedAt;

      while (true) {
        const nextOccurrence = this.getNextRecurringDate(template, cursor);
        if (nextOccurrence > now) {
          break;
        }

        const { error } = await withNetworkTimeout(
          supabase.from("expenses").insert({
            user_id: resolvedUser.id,
            description: template.description,
            amount: template.amount,
            date: nextOccurrence.toISOString(),
            category: template.category || null,
            notes: template.notes || null,
            image_url: null,
            receipt_path: null,
          }),
        ).catch(() => ({ error: new Error("Network timed out") }));

        if (error) {
          console.error("Error syncing recurring expense:", error);
          break;
        }

        syncedCount += 1;
        templatesChanged = true;
        latestGeneratedAt = nextOccurrence.toISOString();
        cursor = nextOccurrence;
      }

      if (latestGeneratedAt && latestGeneratedAt !== template.lastGeneratedAt) {
        nextTemplates[index] = {
          ...template,
          lastGeneratedAt: latestGeneratedAt,
        };
      }
    }

    if (!templatesChanged) {
      return { syncedCount: 0, user: resolvedUser };
    }

    const updateResult = await authService.updateUser({
      recurringExpenses: nextTemplates,
    });

    if (!updateResult.success) {
      return { syncedCount, user: resolvedUser };
    }

    return { syncedCount, user: updateResult.user };
  }

  async flushPendingExpenseOperations(
    currentUser?: User | null,
  ): Promise<{ syncedCount: number; failedCount: number }> {
    const resolvedUser = currentUser ?? (await authService.getCurrentUser());
    if (!resolvedUser) {
      return { syncedCount: 0, failedCount: 0 };
    }

    const pendingOperations = await this.getPendingExpenseOperations(resolvedUser.id);
    if (pendingOperations.length === 0) {
      return { syncedCount: 0, failedCount: 0 };
    }

    let cachedExpenses = await this.getCachedExpenses(resolvedUser.id);
    let deletedIds = await this.getDeletedExpenseIds(resolvedUser.id);
    const remaining: PendingExpenseOperation[] = [];
    let syncedCount = 0;

    for (const operation of pendingOperations) {
      if (operation.type === "create") {
        const result = await this.createExpenseRemotely(resolvedUser.id, {
          description: operation.description,
          amount: operation.amount,
          category: operation.category,
          notes: operation.notes,
          date: operation.date,
          imageUri: operation.imageUri,
        });

        if (!result.expense) {
          remaining.push(operation);
          continue;
        }

        cachedExpenses = cachedExpenses.map((expense) =>
          expense.id === operation.localId
            ? { ...result.expense!, isPending: false }
            : expense,
        );
        deletedIds = deletedIds.filter((id) => id !== operation.localId);
        syncedCount += 1;
        continue;
      }

      if (operation.type === "update") {
        const result = await this.updateExpenseRemotely(
          resolvedUser.id,
          operation.expenseId,
          operation.updates,
        );

        if (!result.expense) {
          remaining.push(operation);
          continue;
        }

        cachedExpenses = cachedExpenses.map((expense) =>
          expense.id === operation.expenseId
            ? { ...result.expense!, isPending: false }
            : expense,
        );
        syncedCount += 1;
        continue;
      }

      const result = await this.deleteExpenseRemotely(
        resolvedUser.id,
        operation.expenseId,
      );

      if (!result.success) {
        remaining.push(operation);
        continue;
      }

      cachedExpenses = cachedExpenses.filter(
        (expense) => expense.id !== operation.expenseId,
      );
      deletedIds = deletedIds.filter((id) => id !== operation.expenseId);
      syncedCount += 1;
    }

    await this.cacheExpenses(resolvedUser.id, cachedExpenses);
    await this.setDeletedExpenseIds(resolvedUser.id, deletedIds);
    await this.setPendingExpenseOperations(resolvedUser.id, remaining);

    return { syncedCount, failedCount: remaining.length };
  }

  async getExpenses(currentUser?: User | null): Promise<Expense[]> {
    try {
      const resolvedUser = currentUser ?? (await authService.getCurrentUser());
      if (!resolvedUser) {
        return [];
      }

      const { data, error } = await withNetworkTimeout(
        supabase
          .from("expenses")
          .select("*")
          .eq("user_id", resolvedUser.id)
          .order("date", { ascending: false }),
      ).catch(() => ({ data: null, error: new Error("Network timed out") }));

      const cachedExpenses = await this.getCachedExpenses(resolvedUser.id);
      const deletedIds = await this.getDeletedExpenseIds(resolvedUser.id);

      if (error || !data) {
        console.error("Error fetching expenses:", error);
        return cachedExpenses.filter((expense) => !deletedIds.includes(expense.id));
      }

      const mappedExpenses = data.map((e: any) => this.mapExpenseRecord(e));
      const mergedExpenses = this.mergeRemoteAndCachedExpenses(
        mappedExpenses,
        cachedExpenses,
        deletedIds,
      );
      await this.cacheExpenses(resolvedUser.id, mergedExpenses);
      return mergedExpenses;
    } catch (error) {
      console.error("Error fetching expenses:", error);
      const resolvedUser = currentUser ?? (await authService.getCurrentUser());
      if (!resolvedUser) {
        return [];
      }

      const cachedExpenses = await this.getCachedExpenses(resolvedUser.id);
      const deletedIds = await this.getDeletedExpenseIds(resolvedUser.id);
      return cachedExpenses.filter((expense) => !deletedIds.includes(expense.id));
    }
  }

  async deleteExpense(
    id: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: "User not authenticated" };
      }

      const cachedExpenses = await this.getCachedExpenses(currentUser.id);
      await this.cacheExpenses(
        currentUser.id,
        cachedExpenses.filter((expense) => expense.id !== id),
      );

      if (id.startsWith("offline-") || (await this.isOfflineNow())) {
        if (!id.startsWith("offline-")) {
          const deletedIds = await this.getDeletedExpenseIds(currentUser.id);
          if (!deletedIds.includes(id)) {
            await this.setDeletedExpenseIds(currentUser.id, [...deletedIds, id]);
          }
        }
        await this.enqueuePendingExpenseOperation(currentUser.id, {
          type: "delete",
          expenseId: id,
        });
        return { success: true };
      }

      const result = await this.deleteExpenseRemotely(currentUser.id, id);
      const deletedIds = await this.getDeletedExpenseIds(currentUser.id);

      if (!result.success) {
        if (!deletedIds.includes(id)) {
          await this.setDeletedExpenseIds(currentUser.id, [...deletedIds, id]);
        }
        await this.enqueuePendingExpenseOperation(currentUser.id, {
          type: "delete",
          expenseId: id,
        });
        return { success: true };
      }

      await this.setDeletedExpenseIds(
        currentUser.id,
        deletedIds.filter((deletedId) => deletedId !== id),
      );
      await this.prunePendingExpenseOperations(
        currentUser.id,
        (operation) =>
          (operation.type === "delete" || operation.type === "update") &&
          operation.expenseId === id,
      );
      return { success: true };
    } catch (error: any) {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return {
          success: false,
          error: error.message || "Failed to delete expense",
        };
      }

      const cachedExpenses = await this.getCachedExpenses(currentUser.id);
      await this.cacheExpenses(
        currentUser.id,
        cachedExpenses.filter((expense) => expense.id !== id),
      );
      const deletedIds = await this.getDeletedExpenseIds(currentUser.id);
      if (!id.startsWith("offline-") && !deletedIds.includes(id)) {
        await this.setDeletedExpenseIds(currentUser.id, [...deletedIds, id]);
      }
      await this.enqueuePendingExpenseOperation(currentUser.id, {
        type: "delete",
        expenseId: id,
      });

      return { success: true };
    }
  }

  async updateExpense(
    id: string,
    updates: Partial<Expense>,
  ): Promise<{ success: boolean; expense?: Expense; error?: string }> {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: "User not authenticated" };
      }

      const cachedExpenses = await this.getCachedExpenses(currentUser.id);
      const existingExpense = cachedExpenses.find((expense) => expense.id === id);
      if (!existingExpense) {
        return {
          success: false,
          error: "Expense not found",
        };
      }

      const serializedUpdates = this.serializeExpenseUpdates(updates);
      const shouldQueueWithoutRemote =
        id.startsWith("offline-") || (await this.isOfflineNow());
      const remoteResult =
        shouldQueueWithoutRemote
          ? { error: "Offline pending expense" }
          : await this.updateExpenseRemotely(currentUser.id, id, serializedUpdates);

      if (remoteResult.error || !remoteResult.expense) {
        const offlineUpdates =
          await this.prepareOfflineExpenseUpdates(serializedUpdates);
        const fallbackExpense: Expense = {
          ...existingExpense,
          ...updates,
          imageUrl:
            offlineUpdates.imageUrl !== undefined
              ? offlineUpdates.imageUrl
              : updates.imageUrl,
          date: updates.date ?? existingExpense.date,
          isPending: true,
        };
        await this.cacheExpenses(
          currentUser.id,
          cachedExpenses.map((expense) =>
            expense.id === id ? fallbackExpense : expense,
          ),
        );
        await this.enqueuePendingExpenseOperation(currentUser.id, {
          type: "update",
          expenseId: id,
          updates: offlineUpdates,
        });

        return { success: true, expense: fallbackExpense };
      }

      const mappedExpense = remoteResult.expense;
      await this.cacheExpenses(
        currentUser.id,
        cachedExpenses.map((expense) =>
          expense.id === id ? mappedExpense : expense,
        ),
      );
      await this.prunePendingExpenseOperations(
        currentUser.id,
        (operation) =>
          operation.type === "update" && operation.expenseId === id,
      );

      return { success: true, expense: mappedExpense };
    } catch (error: any) {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        return {
          success: false,
          error: error.message || "Failed to update expense",
        };
      }

      const cachedExpenses = await this.getCachedExpenses(currentUser.id);
      const existingExpense = cachedExpenses.find((expense) => expense.id === id);
      if (!existingExpense) {
        return {
          success: false,
          error: error.message || "Failed to update expense",
        };
      }

      const offlineUpdates = await this.prepareOfflineExpenseUpdates(
        this.serializeExpenseUpdates(updates),
      );
      const fallbackExpense: Expense = {
        ...existingExpense,
        ...updates,
        imageUrl:
          offlineUpdates.imageUrl !== undefined
            ? offlineUpdates.imageUrl
            : updates.imageUrl,
        date: updates.date ?? existingExpense.date,
        isPending: true,
      };
      await this.cacheExpenses(
        currentUser.id,
        cachedExpenses.map((expense) =>
          expense.id === id ? fallbackExpense : expense,
        ),
      );
      await this.enqueuePendingExpenseOperation(currentUser.id, {
        type: "update",
        expenseId: id,
        updates: offlineUpdates,
      });

      return { success: true, expense: fallbackExpense };
    }
  }

  async getTotalExpenses(): Promise<number> {
    const expenses = await this.getExpenses();
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  async getMonthlyExpenses(month: number, year: number): Promise<Expense[]> {
    const expenses = await this.getExpenses();
    return expenses.filter((e) => {
      const eDate = new Date(e.date);
      return eDate.getMonth() === month && eDate.getFullYear() === year;
    });
  }

  async getCategoryBreakdown(): Promise<Record<string, number>> {
    const expenses = await this.getExpenses();
    const breakdown: Record<string, number> = {};

    expenses.forEach((e) => {
      const category = e.category || "Uncategorized";
      breakdown[category] = (breakdown[category] || 0) + e.amount;
    });

    return breakdown;
  }

  async searchExpenses(query: string): Promise<Expense[]> {
    const expenses = await this.getExpenses();
    const lowerQuery = query.toLowerCase();
    return expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(lowerQuery) ||
        e.notes?.toLowerCase().includes(lowerQuery),
    );
  }

  async clearAllExpenses(): Promise<boolean> {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) return false;

      const cachedExpenses = await this.getCachedExpenses(currentUser.id);
      const pendingOperations = await this.getPendingExpenseOperations(
        currentUser.id,
      );
      await this.cacheExpenses(currentUser.id, []);

      const { error } = await withNetworkTimeout(
        supabase
          .from("expenses")
          .delete()
          .eq("user_id", currentUser.id),
      ).catch(() => ({ error: new Error("Network timed out") }));

      if (error) {
        const nextPendingOperations: PendingExpenseOperation[] =
          pendingOperations.filter((operation) => operation.type !== "delete");

        for (const expense of cachedExpenses) {
          if (expense.id.startsWith("offline-")) {
            const createOperation = nextPendingOperations.find(
              (operation) =>
                operation.type === "create" &&
                operation.localId === expense.id,
            );

            if (createOperation) {
              continue;
            }
          }

          nextPendingOperations.push({
            type: "delete",
            expenseId: expense.id,
          });
        }

        await this.setPendingExpenseOperations(currentUser.id, nextPendingOperations);
        return true;
      }

      await this.setDeletedExpenseIds(currentUser.id, []);
      await this.setPendingExpenseOperations(currentUser.id, []);
      return true;
    } catch (error) {
      console.error("Error clearing expenses:", error);
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) return false;

      const cachedExpenses = await this.getCachedExpenses(currentUser.id);
      const pendingOperations = await this.getPendingExpenseOperations(
        currentUser.id,
      );
      await this.cacheExpenses(currentUser.id, []);
      await this.setPendingExpenseOperations(currentUser.id, [
        ...pendingOperations,
        ...cachedExpenses.map((expense) => ({
          type: "delete" as const,
          expenseId: expense.id,
        })),
      ]);
      return true;
    }
  }
}

export default new ExpenseService();
