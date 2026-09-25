export type UserRole = 'MASTER_ADMIN' | 'TRAINER' | 'STUDENT';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string | null;
  role: UserRole;
  name: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Student {
  id: string;
  tenantId: string;
  studentId: string;
  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  gender: 'M' | 'F' | 'O' | null;
  heightCm: number | null;
  isApproved: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  planMonthlyValue: number | null;
  planDueDay: number | null;
  planStatus: 'INACTIVE' | 'ACTIVE' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentProgress {
  id: string;
  studentId: string;
  tenantId: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  calfCm: number | null;
  notes: string | null;
  measuredAt: Date;
  createdAt: Date;
}

export interface Workout {
  id: string;
  tenantId: string;
  studentId: string;
  trainerId: string;
  title: string;
  description: string | null;
  weekNumber: number | null;
  dayOfWeek: number | null;
  scheduledDate: Date | null;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  name: string;
  muscleGroup: string | null;
  sets: number;
  reps: string;
  restSeconds: number | null;
  loadKg: number | null;
  notes: string | null;
  youtubeUrl: string | null;
  orderIndex: number;
  isCompleted: boolean;
  completedSets: number;
  completedAt: Date | null;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'passwordHash'>;
  tenant?: Tenant;
  student?: Student;
}

export interface StudentRegisterRequest {
  tenantSlug: string;
  name: string;
  email?: string;
  phone?: string;
  password: string;
}

export interface StudentRegisterResponse {
  studentId: string;
  message: string;
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'LATE' | 'CANCELED';

export interface Payment {
  id: string;
  tenantId: string;
  studentId: string;
  referenceMonth: string;
  dueDate: Date | string;
  amountBrl: number;
  status: PaymentStatus;
  paidAt: Date | null;
  paidBy: string | null;
  paymentMethod: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'TRANSFER' | 'CASH' | 'OTHER' | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApproveStudentRequest {
  studentId: string;
}
