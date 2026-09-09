import { create } from 'zustand';
import type {
  DailyRecord,
  WithdrawalRequest,
  SavingsGoal,
  Transaction,
  Badge,
  AppSettings,
  AccountBalance,
  StarAwardResult,
  KidProfile,
} from '../types';

interface StarBankStore {
  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setActiveKid: (kidId: string) => void;
  addKid: (kidName: string) => void;
  removeKid: (kidId: string) => void;

  // Daily Records
  dailyRecords: DailyRecord[];
  getTodayRecord: () => DailyRecord;
  addTask: (taskName: string, stars: number) => void;
  completeTask: (taskId: string) => StarAwardResult;
  deleteTask: (taskId: string) => void;
  subtractStars: (stars: number, reason: string) => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id' | 'date'>) => void;

  // Withdrawal Requests
  withdrawalRequests: WithdrawalRequest[];
  requestWithdrawal: (request: Omit<WithdrawalRequest, 'id' | 'date' | 'status'>) => void;
  approveWithdrawal: (id: string, approvedAmount?: number, comments?: string) => void;
  rejectWithdrawal: (id: string, comments?: string) => void;

  // Savings Goals
  savingsGoals: SavingsGoal[];
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id' | 'createdDate'>) => void;
  updateSavingsGoal: (id: string, updates: Partial<SavingsGoal>) => void;
  deleteSavingsGoal: (id: string) => void;

  // Badges
  badges: Badge[];
  unlockBadge: (badge: Omit<Badge, 'id' | 'unlockedDate'>) => void;

  // Balance
  getAccountBalance: () => AccountBalance;

  // Statistics
  getTodayStars: () => number;
  getTotalStars: () => number;
  getWeeklyReport: () => any;
  getMonthlyReport: () => any;
}

const STORAGE_KEYS = {
  settings: 'starbank_settings',
  records: 'starbank_records',
  transactions: 'starbank_transactions',
  withdrawals: 'starbank_withdrawals',
  goals: 'starbank_goals',
  badges: 'starbank_badges',
} as const;

const getActiveAccountId = () => localStorage.getItem('starbank_active_account') || 'default';
const getScopedKey = (baseKey: string) => {
  const accountId = getActiveAccountId();
  return accountId === 'default' ? baseKey : `${baseKey}_${accountId}`;
};

const readScoped = (baseKey: string) => {
  const scoped = localStorage.getItem(getScopedKey(baseKey));
  if (scoped) return scoped;

  // Keep existing users' data by falling back to legacy global keys.
  return localStorage.getItem(baseKey);
};

const writeScoped = (baseKey: string, value: string) => {
  localStorage.setItem(getScopedKey(baseKey), value);
};

const normalizeTaskType = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const createKidId = () => `kid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const defaultKid: KidProfile = {
  id: 'kid-default',
  name: 'Child',
};

const defaultSettings: AppSettings = {
  kids: [defaultKid],
  activeKidId: defaultKid.id,
  parentPin: '1234',
  starToDollarRate: 2,
  dailyStarLimit: 10,
  defaultTasks: [
    'Wake up early',
    'Get ready for school',
    'Brush teeth',
    'Fold clothes',
    'Do homework',
    'Listen well / no crying for the whole day',
  ],
  theme: 'sunny',
  notificationsEnabled: false,
  dailyNotificationHour: 18,
};

const getInitialSettings = (): AppSettings => {
  const stored = readScoped(STORAGE_KEYS.settings);
  if (!stored) return defaultSettings;

  try {
    const parsed = JSON.parse(stored) as Partial<AppSettings> & { childName?: string };
    const parsedKids = Array.isArray(parsed.kids) && parsed.kids.length > 0
      ? parsed.kids.filter((kid): kid is KidProfile => Boolean(kid?.id && kid?.name))
      : [];
    const kids = parsedKids.length > 0
      ? parsedKids
      : [{ id: defaultKid.id, name: parsed.childName?.trim() || defaultKid.name }];

    const activeKidId = kids.some((kid) => kid.id === parsed.activeKidId)
      ? (parsed.activeKidId as string)
      : kids[0].id;

    return {
      ...defaultSettings,
      ...parsed,
      kids,
      activeKidId,
      notificationsEnabled: typeof parsed.notificationsEnabled === 'boolean'
        ? parsed.notificationsEnabled
        : defaultSettings.notificationsEnabled,
      dailyNotificationHour:
        typeof parsed.dailyNotificationHour === 'number' && parsed.dailyNotificationHour >= 0 && parsed.dailyNotificationHour <= 23
          ? parsed.dailyNotificationHour
          : defaultSettings.dailyNotificationHour,
      defaultTasks: Array.isArray(parsed.defaultTasks) && parsed.defaultTasks.length > 0
        ? parsed.defaultTasks
        : defaultSettings.defaultTasks,
    };
  } catch {
    return defaultSettings;
  }
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

const syncRecordWithDefaultTasks = (record: DailyRecord, defaultTasks: string[]): DailyRecord => {
  const existingTypes = new Set(
    record.tasks.map((task) => task.taskType || normalizeTaskType(task.name)),
  );
  const missingTasks = defaultTasks.filter((taskName) => !existingTypes.has(normalizeTaskType(taskName)));

  if (missingTasks.length === 0) {
    return record;
  }

  const now = Date.now();
  return {
    ...record,
    tasks: [
      ...record.tasks,
      ...missingTasks.map((name, index) => ({
        id: `task-${now}-${index}`,
        name,
        taskType: normalizeTaskType(name),
        stars: 1,
        completed: false,
      })),
    ],
  };
};

const migrateTask = (task: DailyRecord['tasks'][number]): DailyRecord['tasks'][number] => ({
  ...task,
  taskType: task.taskType || normalizeTaskType(task.name),
});

const getInitialRecords = (fallbackKidId: string): DailyRecord[] => {
  const stored = readScoped(STORAGE_KEYS.records);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as DailyRecord[];
    const migrated = parsed.map((record) => ({
      ...record,
      kidId: record.kidId || fallbackKidId,
      tasks: record.tasks.map(migrateTask),
    }));
    writeScoped(STORAGE_KEYS.records, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
};

const initialSettings = getInitialSettings();

export const useStarBankStore = create<StarBankStore>((set, get) => ({
  settings: initialSettings,

  updateSettings: (newSettings) => {
    set((state) => {
      const updated = { ...state.settings, ...newSettings };
      if (!updated.kids.some((kid) => kid.id === updated.activeKidId)) {
        updated.activeKidId = updated.kids[0]?.id || defaultKid.id;
      }

      const today = getTodayDate();
      const updatedRecords = state.dailyRecords.map((record) => (
        record.date === today
          ? syncRecordWithDefaultTasks(record, updated.defaultTasks)
          : record
      ));

      writeScoped(STORAGE_KEYS.settings, JSON.stringify(updated));
      writeScoped(STORAGE_KEYS.records, JSON.stringify(updatedRecords));
      return {
        settings: updated,
        dailyRecords: updatedRecords,
      };
    });
  },

  setActiveKid: (kidId) => {
    set((state) => {
      if (!state.settings.kids.some((kid) => kid.id === kidId)) {
        return state;
      }

      const updatedSettings = {
        ...state.settings,
        activeKidId: kidId,
      };
      writeScoped(STORAGE_KEYS.settings, JSON.stringify(updatedSettings));
      return { settings: updatedSettings };
    });
  },

  addKid: (kidName) => {
    const trimmedName = kidName.trim();
    if (!trimmedName) return;

    set((state) => {
      const newKid: KidProfile = {
        id: createKidId(),
        name: trimmedName,
      };
      const updatedSettings = {
        ...state.settings,
        kids: [...state.settings.kids, newKid],
        activeKidId: newKid.id,
      };
      writeScoped(STORAGE_KEYS.settings, JSON.stringify(updatedSettings));
      return { settings: updatedSettings };
    });
  },

  removeKid: (kidId) => {
    set((state) => {
      if (state.settings.kids.length <= 1) {
        return state;
      }

      const remainingKids = state.settings.kids.filter((kid) => kid.id !== kidId);
      if (remainingKids.length === state.settings.kids.length) {
        return state;
      }

      const updatedSettings = {
        ...state.settings,
        kids: remainingKids,
        activeKidId:
          state.settings.activeKidId === kidId
            ? remainingKids[0].id
            : state.settings.activeKidId,
      };
      const updatedRecords = state.dailyRecords.filter((record) => record.kidId !== kidId);

      writeScoped(STORAGE_KEYS.settings, JSON.stringify(updatedSettings));
      writeScoped(STORAGE_KEYS.records, JSON.stringify(updatedRecords));

      return {
        settings: updatedSettings,
        dailyRecords: updatedRecords,
      };
    });
  },

  dailyRecords: getInitialRecords(initialSettings.activeKidId),

  getTodayRecord: () => {
    const state = get();
    const today = getTodayDate();
    const activeKidId = state.settings.activeKidId;
    let record = state.dailyRecords.find((r) => r.date === today && r.kidId === activeKidId);

    if (!record) {
      const createdRecord: DailyRecord = {
        kidId: activeKidId,
        date: today,
        tasks: state.settings.defaultTasks.map((name, i) => ({
          id: `task-${Date.now()}-${i}`,
          name,
          taskType: normalizeTaskType(name),
          stars: 1,
          completed: false,
        })),
        totalStarsEarned: 0,
        starSubtractions: [],
      };
      record = createdRecord;

      const updatedRecords = [...state.dailyRecords, createdRecord];
      writeScoped(STORAGE_KEYS.records, JSON.stringify(updatedRecords));
      set({ dailyRecords: updatedRecords });
    } else {
      const syncedRecord = syncRecordWithDefaultTasks(record, state.settings.defaultTasks);
      if (syncedRecord !== record) {
        const updatedRecords = state.dailyRecords.map((existingRecord) => (
          existingRecord.date === today && existingRecord.kidId === activeKidId
            ? syncedRecord
            : existingRecord
        ));
        writeScoped(STORAGE_KEYS.records, JSON.stringify(updatedRecords));
        set({ dailyRecords: updatedRecords });
        record = syncedRecord;
      }
    }

    return record;
  },

  addTask: (taskName, stars) => {
    set((state) => {
      const today = getTodayDate();
      const activeKidId = state.settings.activeKidId;
      const recordIndex = state.dailyRecords.findIndex((r) => r.date === today && r.kidId === activeKidId);

      if (recordIndex >= 0) {
        const updated = [...state.dailyRecords];
        updated[recordIndex].tasks.push({
          id: `task-${Date.now()}`,
          name: taskName,
          taskType: normalizeTaskType(taskName),
          stars,
          completed: false,
        });
        writeScoped(STORAGE_KEYS.records, JSON.stringify(updated));
        return { dailyRecords: updated };
      }
      return state;
    });
  },

  completeTask: (taskId) => {
    let result: StarAwardResult = {
      success: false,
      message: 'Task not found.',
      awardedStars: 0,
    };

    set((state) => {
      const today = getTodayDate();
      const activeKidId = state.settings.activeKidId;
      const recordIndex = state.dailyRecords.findIndex((r) => r.date === today && r.kidId === activeKidId);

      if (recordIndex >= 0) {
        const updated = [...state.dailyRecords];
        const task = updated[recordIndex].tasks.find((t) => t.id === taskId);
        if (task) {
          if (task.completed) {
            result = {
              success: false,
              message: 'This task already got a star today.',
              awardedStars: 0,
            };
            return state;
          }

          const hasCompletedTypeToday = updated[recordIndex].tasks.some(
            (t) => t.id !== task.id && t.taskType === task.taskType && t.completed,
          );

          if (hasCompletedTypeToday) {
            result = {
              success: false,
              message: 'Only one star per task type is allowed each day.',
              awardedStars: 0,
            };
            return state;
          }

          const earnedStars = updated[recordIndex].totalStarsEarned;
          if (earnedStars + task.stars > state.settings.dailyStarLimit) {
            result = {
              success: false,
              message: 'Daily star limit reached. Increase limit in Settings if needed.',
              awardedStars: 0,
            };
            return state;
          }

          task.completed = true;
          task.completedDate = new Date().toISOString();
          updated[recordIndex].totalStarsEarned += task.stars;

          result = {
            success: true,
            message: `Great! ${task.name} earned ${task.stars} star${task.stars > 1 ? 's' : ''}.`,
            awardedStars: task.stars,
          };
        }
        writeScoped(STORAGE_KEYS.records, JSON.stringify(updated));
        return { dailyRecords: updated };
      }

      result = {
        success: false,
        message: 'No record found for today. Try refreshing once.',
        awardedStars: 0,
      };
      return state;
    });

    return result;
  },

  deleteTask: (taskId) => {
    set((state) => {
      const today = getTodayDate();
      const activeKidId = state.settings.activeKidId;
      const recordIndex = state.dailyRecords.findIndex((r) => r.date === today && r.kidId === activeKidId);

      if (recordIndex >= 0) {
        const updated = [...state.dailyRecords];
        const taskIndex = updated[recordIndex].tasks.findIndex((t) => t.id === taskId);
        if (taskIndex >= 0) {
          const task = updated[recordIndex].tasks[taskIndex];
          if (task.completed) {
            updated[recordIndex].totalStarsEarned -= task.stars;
          }
          updated[recordIndex].tasks.splice(taskIndex, 1);
        }
        writeScoped(STORAGE_KEYS.records, JSON.stringify(updated));
        return { dailyRecords: updated };
      }
      return state;
    });
  },

  subtractStars: (stars, reason) => {
    set((state) => {
      const today = getTodayDate();
      const activeKidId = state.settings.activeKidId;
      const recordIndex = state.dailyRecords.findIndex((r) => r.date === today && r.kidId === activeKidId);

      if (recordIndex >= 0) {
        const updated = [...state.dailyRecords];
        updated[recordIndex].starSubtractions.push({
          id: `sub-${Date.now()}`,
          stars,
          reason,
          date: new Date().toISOString(),
        });
        updated[recordIndex].totalStarsEarned = Math.max(0, updated[recordIndex].totalStarsEarned - stars);
        writeScoped(STORAGE_KEYS.records, JSON.stringify(updated));
        return { dailyRecords: updated };
      }
      return state;
    });
  },

  transactions: (() => {
    const stored = readScoped(STORAGE_KEYS.transactions);
    return stored ? JSON.parse(stored) : [];
  })(),

  addTransaction: (transaction) => {
    set((state) => {
      const updated = [...state.transactions, {
        ...transaction,
        id: `trans-${Date.now()}`,
        date: new Date().toISOString(),
      }];
      writeScoped(STORAGE_KEYS.transactions, JSON.stringify(updated));
      return { transactions: updated };
    });
  },

  withdrawalRequests: (() => {
    const stored = readScoped(STORAGE_KEYS.withdrawals);
    return stored ? JSON.parse(stored) : [];
  })(),

  requestWithdrawal: (request) => {
    set((state) => {
      const updated = [...state.withdrawalRequests, {
        ...request,
        id: `wr-${Date.now()}`,
        date: new Date().toISOString(),
        status: 'pending' as const,
      }];
      writeScoped(STORAGE_KEYS.withdrawals, JSON.stringify(updated));
      return { withdrawalRequests: updated };
    });
  },

  approveWithdrawal: (id, approvedAmount, comments) => {
    set((state) => {
      const updated = [...state.withdrawalRequests];
      const req = updated.find((r) => r.id === id);
      if (req) {
        req.status = 'approved';
        req.approvedAmount = approvedAmount || req.amount;
        req.comments = comments;
      }
      writeScoped(STORAGE_KEYS.withdrawals, JSON.stringify(updated));
      return { withdrawalRequests: updated };
    });
  },

  rejectWithdrawal: (id, comments) => {
    set((state) => {
      const updated = [...state.withdrawalRequests];
      const req = updated.find((r) => r.id === id);
      if (req) {
        req.status = 'rejected';
        req.comments = comments;
      }
      writeScoped(STORAGE_KEYS.withdrawals, JSON.stringify(updated));
      return { withdrawalRequests: updated };
    });
  },

  savingsGoals: (() => {
    const stored = readScoped(STORAGE_KEYS.goals);
    return stored ? JSON.parse(stored) : [];
  })(),

  addSavingsGoal: (goal) => {
    set((state) => {
      const updated = [...state.savingsGoals, {
        ...goal,
        id: `goal-${Date.now()}`,
        createdDate: new Date().toISOString(),
      }];
      writeScoped(STORAGE_KEYS.goals, JSON.stringify(updated));
      return { savingsGoals: updated };
    });
  },

  updateSavingsGoal: (id, updates) => {
    set((state) => {
      const updated = [...state.savingsGoals];
      const goal = updated.find((g) => g.id === id);
      if (goal) {
        Object.assign(goal, updates);
      }
      writeScoped(STORAGE_KEYS.goals, JSON.stringify(updated));
      return { savingsGoals: updated };
    });
  },

  deleteSavingsGoal: (id) => {
    set((state) => {
      const updated = state.savingsGoals.filter((g) => g.id !== id);
      writeScoped(STORAGE_KEYS.goals, JSON.stringify(updated));
      return { savingsGoals: updated };
    });
  },

  badges: (() => {
    const stored = readScoped(STORAGE_KEYS.badges);
    return stored ? JSON.parse(stored) : [];
  })(),

  unlockBadge: (badge) => {
    set((state) => {
      if (state.badges.find((b) => b.name === badge.name)) return state;

      const updated = [...state.badges, {
        ...badge,
        id: `badge-${Date.now()}`,
        unlockedDate: new Date().toISOString(),
      }];
      writeScoped(STORAGE_KEYS.badges, JSON.stringify(updated));
      return { badges: updated };
    });
  },

  getAccountBalance: () => {
    const state = get();
    const totalStars = state.getTotalStars();
    const dollarRate = state.settings.starToDollarRate;
    const totalDollars = Math.floor(totalStars / dollarRate);

    const approvedWithdrawals = state.withdrawalRequests
      .filter((r) => r.status === 'approved')
      .reduce((sum, r) => sum + (r.approvedAmount || r.amount), 0);

    const savingsAmount = state.savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);

    return {
      availableBalance: totalDollars - approvedWithdrawals,
      savingsBalance: savingsAmount,
      investmentBalance: 0, // TODO: implement investment tracking
      charityBalance: 0, // TODO: implement charity tracking
      totalEarned: totalDollars,
      totalSpent: approvedWithdrawals,
    };
  },

  getTodayStars: () => {
    const record = get().getTodayRecord();
    return Math.max(0, record.totalStarsEarned);
  },

  getTotalStars: () => {
    const state = get();
    const activeKidId = state.settings.activeKidId;
    return state.dailyRecords
      .filter((record) => record.kidId === activeKidId)
      .reduce((sum, record) => sum + record.totalStarsEarned, 0);
  },

  getWeeklyReport: () => {
    const state = get();
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const activeKidId = state.settings.activeKidId;

    const weekData: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      weekData[dateStr] = 0;
    }

    state.dailyRecords.forEach((record) => {
      if (record.kidId === activeKidId && record.date >= weekStart.toISOString().split('T')[0]) {
        weekData[record.date] = record.totalStarsEarned;
      }
    });

    return weekData;
  },

  getMonthlyReport: () => {
    const state = get();
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const activeKidId = state.settings.activeKidId;

    const monthData: Record<string, number> = {};
    let current = new Date(monthStart);

    while (current <= monthEnd) {
      const dateStr = current.toISOString().split('T')[0];
      monthData[dateStr] = 0;
      current.setDate(current.getDate() + 1);
    }

    state.dailyRecords.forEach((record) => {
      if (record.kidId === activeKidId
          && record.date >= monthStart.toISOString().split('T')[0] &&
          record.date <= monthEnd.toISOString().split('T')[0]) {
        monthData[record.date] = record.totalStarsEarned;
      }
    });

    return monthData;
  },
}));

