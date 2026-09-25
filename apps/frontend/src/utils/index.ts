import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatStudentId(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const suffix = cleaned.slice(0, 4).padStart(4, '0');
  return '#ALU-' + suffix;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function hexToRgb(hex: string, alpha = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/,
    /^([A-Za-z0-9_-]{6,})$/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
}

export function dayOfWeekLabel(day: number | null | undefined): string {
  if (day == null) return 'Sem dia';
  const map = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return map[day] ?? 'Sem dia';
}

export function dayOfWeekShort(day: number | null | undefined): string {
  if (day == null) return '-';
  const map = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  return map[day] ?? '-';
}

export function formatCurrencyBrl(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return 'R$ 0,00';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export type PlanPaymentStatus = 'PAID' | 'PENDING' | 'LATE' | 'NO_PLAN' | 'INACTIVE' | 'SUSPENDED';

export interface PlanPaymentMeta {
  status: PlanPaymentStatus;
  label: string;
  dueDate: string | null;
  amountBrl: number | null;
  daysDiff: number | null;
}

export function computePlanStatus(student: { planDueDay?: number | null; planStatus?: string | null }, payments: any[]): PlanPaymentMeta {
  if (student?.planStatus === 'SUSPENDED') {
    return { status: 'SUSPENDED', label: 'Suspenso', dueDate: null, amountBrl: null, daysDiff: null };
  }
  if (!student?.planDueDay && payments.length === 0) {
    return { status: 'NO_PLAN', label: 'Sem plano', dueDate: null, amountBrl: null, daysDiff: null };
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const list = [...payments].sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));
  let latestPending: any = null;
  let earliestLate: any = null;

  for (const p of list) {
    const d = new Date(String(p.dueDate) + 'T23:59:59').getTime();
    const diff = Math.floor((today - d) / 86400000);
    if ((p.status || 'PENDING') === 'PAID' || p.status === 'CANCELED') continue;
    if (diff < 0) {
      if (!latestPending || new Date(String(latestPending.dueDate)).getTime() < d) latestPending = p;
    } else {
      if (!earliestLate || new Date(String(earliestLate.dueDate)).getTime() > d) earliestLate = p;
    }
  }

  if (earliestLate) {
    const d = new Date(String(earliestLate.dueDate) + 'T23:59:59').getTime();
    const diff = Math.floor((today - d) / 86400000);
    return {
      status: 'LATE',
      label: `Vencido há ${diff}d`,
      dueDate: String(earliestLate.dueDate),
      amountBrl: Number(earliestLate.amountBrl),
      daysDiff: diff,
    };
  }
  if (latestPending) {
    const d = new Date(String(latestPending.dueDate) + 'T00:00:00').getTime();
    const diff = Math.ceil((d - today) / 86400000);
    return {
      status: 'PENDING',
      label: diff === 0 ? 'Vence hoje' : diff === 1 ? 'Vence amanhã' : `Vence em ${diff}d`,
      dueDate: String(latestPending.dueDate),
      amountBrl: Number(latestPending.amountBrl),
      daysDiff: diff,
    };
  }
  const lastPaid = [...list].filter(p => p.status === 'PAID').sort((a, b) => a.paidAt < b.paidAt ? 1 : -1)[0];
  return {
    status: 'PAID',
    label: lastPaid ? 'Em dia' : 'Sem débitos',
    dueDate: lastPaid ? String(lastPaid.paidAt || lastPaid.dueDate) : null,
    amountBrl: lastPaid ? Number(lastPaid.amountBrl) : null,
    daysDiff: null,
  };
}

export function paymentMethodLabel(method: string | null | undefined): string {
  const map: Record<string, string> = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CREDIT_CARD: 'Cartão de Crédito',
    DEBIT_CARD: 'Cartão de Débito',
    TRANSFER: 'Transferência',
    CASH: 'Dinheiro',
    OTHER: 'Outro',
  };
  return method ? (map[method] || method) : '—';
}

export function monthLabel(ref: string): string {
  if (!ref) return '';
  const [y, m] = ref.split('-').map(Number);
  const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${names[m - 1]}/${y}`;
}
