// Types khớp với response của service min-healthy trong api-longnh-tools.

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type ReadingKind = "pre" | "post";

export interface MealReading {
  value: number;
  measuredAt: string; // ISO 8601
}

export interface Meal {
  id: string;
  mealType: MealType;
  eatenAt: string; // ISO 8601
  foods: string;
  note: string;
  photoUrl: string | null;
  pre: MealReading | null;
  post: MealReading | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MealPage {
  items: Meal[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ReminderKind = "pre" | "post" | "general";

export interface GlucoseReminder {
  time: string; // "HH:mm"
  kind: ReminderKind;
  enabled: boolean;
  lastSentDate?: string;
}

export interface GlucoseSettings {
  low: number;
  preMin: number;
  preMax: number;
  postMax: number;
  veryHigh: number;
  reminders: GlucoseReminder[];
}

/** In-app notification (service notification của monolith, app=min-healthy) */
export interface AppNotification {
  id: string;
  type: string;
  app: string;
  title: string;
  body: string;
  is_read: boolean;
  createdAt: string;
}

/** Kết quả xét nghiệm HbA1c thực tế (FR-LAB, BR-12: value 3.0–20.0%) */
export interface LabResult {
  id: string;
  value: number;
  testedAt: string;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Bữa sáng",
  lunch: "Bữa trưa",
  dinner: "Bữa tối",
  snack: "Bữa phụ",
};

/** Giờ VN theo tiêu đề thông báo nhắc đo */
export const REMINDER_KIND_LABELS: Record<ReminderKind, string> = {
  pre: "Trước bữa ăn",
  post: "Sau bữa ăn",
  general: "Nhắc chung",
};
