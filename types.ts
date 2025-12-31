export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Account {
    id: string;
    name: string;
    type: 'bank' | 'cash' | 'card';
    balance: number; // Derived state usually, but useful to track if static
}

export interface Transaction {
    id: number;
    type: TransactionType;
    amount: number;
    note: string;
    date: string; // ISO string
    acctFrom: string;
    acctTo?: string;
}

export interface ShiftType {
    id: string;
    name: string;
    rate: number;
    start: string;
    end: string;
    color: string;
}

export interface ShiftItem {
    name: string;
    color: string;
    pay: number;
}

export interface DayShift {
    date: string; // YYYY-MM-DD
    items: ShiftItem[];
    isDouble: boolean;
    note: string;
}

export interface RecurringItem {
    id: string;
    name: string;
    amount: number;
    day: number;
    accountId: string;
}

export interface SalaryConfig {
    amount: number;
    day: number;
    accountId: string;
    enabled: boolean;
}

export interface AppData {
    budget: number;
    transactions: Transaction[];
    accounts: Account[];
    shifts: DayShift[];
    shiftTypes: ShiftType[];
    recurring: RecurringItem[];
    salaryConfig: SalaryConfig;
    tags: string[];
    // Track processed automations
    processedEvents: string[];
    // Cloud Sync
    cloudSyncUrl?: string;
    lastSynced?: string;
}

export const HOLIDAYS = [
    '2026-01-01','2026-02-15','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
    '2026-02-28','2026-04-04','2026-04-05','2026-05-01','2026-06-19','2026-09-27','2026-09-28',
    '2026-10-10','2026-10-25','2026-12-25'
];

export const INITIAL_ACCOUNTS: Account[] = [
    { id: 'cash', name: '現金', type: 'cash', balance: 0 },
    { id: 'taishin', name: '台新銀行', type: 'bank', balance: 0 },
    { id: 'post', name: '郵局', type: 'bank', balance: 0 }
];

export const INITIAL_TAGS = ['早餐','午餐','晚餐','飲料','交通','娛樂','購物','日用'];