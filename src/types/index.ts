// Store types for Little Starts Bank application
export interface Task {
  id: string;
  name: string;
  taskType: string; // normalized task key used for daily duplicate-star checks
  stars: number;
  completed: boolean;
  completedDate?: string; // YYYY-MM-DD
}

export interface StarAwardResult {
  success: boolean;
  message: string;
  awardedStars: number;
}

export interface DailyRecord {
  kidId: string;
  date: string; // YYYY-MM-DD
  tasks: Task[];
  totalStarsEarned: number;
  starSubtractions: StarSubtraction[];
}

export interface KidProfile {
  id: string;
  name: string;
}

export interface StarSubtraction {
  id: string;
  stars: number;
  reason: string;
  date: string; // ISO string
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  category: 'spend' | 'save' | 'invest' | 'charity';
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedAmount?: number;
  comments?: string;
  photo?: string; // base64
  date: string; // ISO string
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  image?: string;
  createdDate: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO string
  type: 'earn' | 'spend' | 'save' | 'invest' | 'donate';
  amount: number;
  description: string;
  relatedTaskId?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedDate?: string;
}

export interface AppSettings {
  kids: KidProfile[];
  activeKidId: string;
  parentPin: string;
  starToDollarRate: number; // e.g., 2 stars = 1 dollar
  dailyStarLimit: number;
  defaultTasks: string[];
  theme: 'sunny' | 'sky' | 'forest' | 'candy';
  notificationsEnabled: boolean;
  dailyNotificationHour: number;
}

export interface AccountBalance {
  availableBalance: number;
  savingsBalance: number;
  investmentBalance: number;
  charityBalance: number;
  totalEarned: number;
  totalSpent: number;
}

