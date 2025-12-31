import React, { useState, useEffect } from 'react';
import { Home, Calendar, Repeat, Plus, Settings } from 'lucide-react';
import { DashboardView, CalendarView, RecurringView } from './components/Views';
import { TransactionModal, AccountModal, ShiftModal, TypeModal, RecurringModal, SettingsModal } from './components/ActionModals';
import { AppData, INITIAL_ACCOUNTS, INITIAL_TAGS, DayShift, ShiftType, Transaction, SalaryConfig } from './types';
import { getFinancialAdvice } from './services/geminiService';
import { syncWithCloud } from './services/storageService';

const STORAGE_KEY = 'nzql_finance_data_v2';

const App: React.FC = () => {
    // --- State ---
    const [activeTab, setActiveTab] = useState<'home' | 'cal' | 'rec'>('home');
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [aiAdvice, setAiAdvice] = useState("AI 分析中...");
    
    // Data State
    const [data, setData] = useState<AppData>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                ...parsed,
                budget: parsed.budget || 40000,
                processedEvents: parsed.processedEvents || [],
                salaryConfig: parsed.salaryConfig || { amount: 0, day: 5, accountId: '', enabled: false },
                cloudSyncUrl: parsed.cloudSyncUrl || '',
                lastSynced: parsed.lastSynced || ''
            };
        }
        return {
            budget: 40000,
            transactions: [],
            accounts: INITIAL_ACCOUNTS,
            shifts: [],
            shiftTypes: [],
            recurring: [],
            salaryConfig: { amount: 0, day: 5, accountId: '', enabled: false },
            tags: INITIAL_TAGS,
            processedEvents: [],
            cloudSyncUrl: '',
            lastSynced: ''
        };
    });

    // Modals State
    const [modals, setModals] = useState({
        tx: false,
        acc: false,
        shift: false,
        type: false,
        rec: false,
        settings: false
    });
    const [selectedDate, setSelectedDate] = useState('');

    // --- Effects ---
    
    // Auto-Save to LocalStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, [data]);

    // Cloud Auto-Sync (Debounced)
    useEffect(() => {
        if (!data.cloudSyncUrl) return;

        const timer = setTimeout(async () => {
            console.log("Auto-syncing to cloud...");
            const res = await syncWithCloud(data.cloudSyncUrl!, data);
            if (res.success && res.time) {
                setData(prev => ({ ...prev, lastSynced: res.time }));
            }
        }, 5000); // 5 seconds debounce

        return () => clearTimeout(timer);
    }, [data.transactions, data.shifts, data.recurring, data.settings, data.cloudSyncUrl]);

    // Financial Advice
    useEffect(() => {
        if (activeTab === 'home') {
             const timer = setTimeout(async () => {
                 let spent = 0;
                 data.transactions.forEach(t => { if(t.type === 'expense' && t.date.startsWith(month)) spent += t.amount; });
                 const advice = await getFinancialAdvice(data.transactions, data.budget, spent);
                 setAiAdvice(advice);
             }, 1000);
             return () => clearTimeout(timer);
        }
    }, [activeTab, data.transactions, month, data.budget]);

    // Automation Logic (Recurring & Salary)
    useEffect(() => {
        const today = new Date();
        const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
        const currentDay = today.getDate();
        
        let newTxs: Transaction[] = [];
        let newProcessed = [...data.processedEvents];
        let hasChanges = false;

        // 1. Process Salary
        const salKey = `${currentMonthStr}-SALARY`;
        if (data.salaryConfig.enabled && data.salaryConfig.amount > 0 && currentDay >= data.salaryConfig.day) {
            if (!newProcessed.includes(salKey)) {
                newTxs.push({
                    id: Date.now() + Math.random(),
                    type: 'income',
                    amount: data.salaryConfig.amount,
                    note: '薪資自動入帳',
                    date: `${currentMonthStr}-${String(data.salaryConfig.day).padStart(2, '0')}T09:00`,
                    acctFrom: data.salaryConfig.accountId || data.accounts[0]?.id
                });
                newProcessed.push(salKey);
                hasChanges = true;
            }
        }

        // 2. Process Recurring
        data.recurring.forEach((rec, idx) => {
            const recKey = `${currentMonthStr}-REC-${rec.id}`;
            if (currentDay >= rec.day) {
                if (!newProcessed.includes(recKey)) {
                    newTxs.push({
                        id: Date.now() + idx + Math.random(), // Ensure unique ID
                        type: 'expense',
                        amount: rec.amount,
                        note: `${rec.name} (訂閱)`,
                        date: `${currentMonthStr}-${String(rec.day).padStart(2, '0')}T09:00`,
                        acctFrom: rec.accountId || data.accounts[0]?.id
                    });
                    newProcessed.push(recKey);
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            setData(prev => ({
                ...prev,
                transactions: [...prev.transactions, ...newTxs],
                processedEvents: newProcessed
            }));
            // Show simple toast or log
            console.log("Automation ran:", newTxs.length, "items added");
        }

    }, [data.salaryConfig, data.recurring, data.processedEvents, data.accounts]);

    // --- Handlers ---

    const handleSaveTx = (tx: Omit<Transaction, 'id'>) => {
        const newTx = { ...tx, id: Date.now() };
        setData(prev => ({ ...prev, transactions: [...prev.transactions, newTx] }));
    };

    const handleAddAccount = (name: string, balance: number, type: any) => {
        const id = `acc_${Date.now()}`;
        const newAcc = { id, name, balance: 0, type };
        
        let newTxs = [...data.transactions];
        if (balance > 0) {
            newTxs.push({ id: Date.now(), type: 'income', amount: balance, note: '初始餘額', date: new Date().toISOString(), acctFrom: id });
        }
        setData(prev => ({ ...prev, accounts: [...prev.accounts, newAcc], transactions: newTxs }));
        setModals(m => ({ ...m, acc: false }));
    };

    const handleDeleteAccount = (id: string) => {
        setData(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== id) }));
    };

    const handleSaveShift = (newShift: DayShift) => {
        setData(prev => ({
            ...prev,
            shifts: [...prev.shifts.filter(s => s.date !== newShift.date), newShift]
        }));
    };

    const handleAddShiftType = (type: Omit<ShiftType, 'id'>) => {
        setData(prev => ({ ...prev, shiftTypes: [...prev.shiftTypes, { ...type, id: `st_${Date.now()}` }] }));
    };

    const handleDeleteShiftType = (id: string) => {
        setData(prev => ({ ...prev, shiftTypes: prev.shiftTypes.filter(t => t.id !== id) }));
    };

    const handleSaveRec = (rec: any) => {
        setData(prev => ({ ...prev, recurring: [...prev.recurring, { ...rec, id: `rec_${Date.now()}` }] }));
        setModals(m => ({ ...m, rec: false }));
    };

    const handleDeleteRec = (id: string) => {
        setData(prev => ({ ...prev, recurring: prev.recurring.filter(r => r.id !== id) }));
    };

    const handleSettingsSave = (newData: Partial<AppData>) => {
        setData(prev => ({ ...prev, ...newData }));
    };

    const handleManualSync = async () => {
        if (data.cloudSyncUrl) {
            alert('正在同步中...');
            const res = await syncWithCloud(data.cloudSyncUrl, data);
            if (res.success && res.time) {
                setData(prev => ({ ...prev, lastSynced: res.time }));
                alert('同步成功！');
            } else {
                alert('同步失敗，請檢查網址或網路。');
            }
        }
    };

    // --- Render ---

    return (
        <div className="max-w-[480px] mx-auto min-h-screen bg-[#F5F5F5] pb-28 relative">
            
            {/* Header */}
            <header className="flex justify-between items-center p-5 pt-8 bg-[#F5F5F5] sticky top-0 z-40 backdrop-blur-sm bg-opacity-90">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-xl">N</div>
                    <span className="font-extrabold text-xl text-slate-900 tracking-tight">NzqL Finance</span>
                </div>
                <input 
                    type="month" 
                    value={month} 
                    onChange={e => setMonth(e.target.value)} 
                    className="bg-white border-none px-4 py-2 rounded-full font-bold text-sm shadow-sm outline-none cursor-pointer"
                />
            </header>

            {/* Main Content */}
            <main className="px-5">
                {activeTab === 'home' && (
                    <DashboardView 
                        data={data} 
                        month={month} 
                        advice={aiAdvice}
                        onOpenAccountModal={() => setModals(m => ({ ...m, acc: true }))}
                    />
                )}
                {activeTab === 'cal' && (
                    <CalendarView 
                        data={data} 
                        month={month}
                        onDayClick={(d) => { setSelectedDate(d); setModals(m => ({ ...m, shift: true })); }}
                        onAddShiftType={() => setModals(m => ({ ...m, type: true }))}
                        onDeleteShiftType={handleDeleteShiftType}
                    />
                )}
                {activeTab === 'rec' && (
                    <RecurringView 
                        data={data}
                        onAddRec={() => setModals(m => ({ ...m, rec: true }))}
                        onDeleteRec={handleDeleteRec}
                    />
                )}
            </main>

            {/* FAB */}
            <div className="fixed bottom-24 left-0 w-full flex justify-center pointer-events-none z-30">
                <button 
                    onClick={() => setModals(m => ({ ...m, tx: true }))}
                    className="pointer-events-auto bg-slate-900 text-white px-6 py-3.5 rounded-full flex items-center gap-2 font-bold shadow-2xl hover:scale-105 transition-transform"
                >
                    <Plus size={20} strokeWidth={3} /> 記一筆
                </button>
            </div>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 w-full h-20 bg-white border-t border-gray-100 flex justify-around items-center z-40 pb-2">
                <button onClick={() => setActiveTab('home')} className={`p-3 transition-colors ${activeTab === 'home' ? 'text-slate-900' : 'text-gray-300'}`}>
                    <Home size={28} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                </button>
                <button onClick={() => setActiveTab('cal')} className={`p-3 transition-colors ${activeTab === 'cal' ? 'text-slate-900' : 'text-gray-300'}`}>
                    <Calendar size={28} strokeWidth={activeTab === 'cal' ? 2.5 : 2} />
                </button>
                <button onClick={() => setActiveTab('rec')} className={`p-3 transition-colors ${activeTab === 'rec' ? 'text-slate-900' : 'text-gray-300'}`}>
                    <Repeat size={28} strokeWidth={activeTab === 'rec' ? 2.5 : 2} />
                </button>
                <button onClick={() => setModals(m => ({ ...m, settings: true }))} className="p-3 text-gray-300 hover:text-gray-400">
                    <Settings size={28} strokeWidth={2} />
                </button>
            </nav>

            {/* Modals */}
            {modals.tx && <TransactionModal onClose={() => setModals(m => ({ ...m, tx: false }))} onSave={handleSaveTx} accounts={data.accounts} tags={data.tags} onAddTag={(t) => setData(d => ({ ...d, tags: [...d.tags, t] }))} />}
            {modals.acc && <AccountModal accounts={data.accounts} onClose={() => setModals(m => ({ ...m, acc: false }))} onAdd={handleAddAccount} onDelete={handleDeleteAccount} />}
            {modals.rec && <RecurringModal accounts={data.accounts} onClose={() => setModals(m => ({ ...m, rec: false }))} onSave={handleSaveRec} />}
            {modals.type && <TypeModal onClose={() => setModals(m => ({ ...m, type: false }))} onSave={handleAddShiftType} />}
            {modals.settings && <SettingsModal data={data} onClose={() => setModals(m => ({ ...m, settings: false }))} onSave={handleSettingsSave} onSync={handleManualSync} />}
            {modals.shift && selectedDate && (
                <ShiftModal 
                    date={selectedDate} 
                    shiftTypes={data.shiftTypes} 
                    currentShift={data.shifts.find(s => s.date === selectedDate)}
                    onClose={() => { setModals(m => ({ ...m, shift: false })); setSelectedDate(''); }}
                    onSave={handleSaveShift}
                />
            )}
        </div>
    );
};

export default App;