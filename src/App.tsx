import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  Coins,
  DollarSign,
  History,
  LayoutDashboard,
  Mail,
  Percent,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './supabaseClient';

const formatMoney = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pipValueNote = (pips: number) =>
  `XAU/USD: 1 pip = 0.01 (10 points). Est. $/pip = lot × 10 (0.01 lot=$0.10, 0.10 lot=$1, 1.00 lot=$10). Target: ${pips} pips (Profit target: 1.5R–2R).`;

const MM_QUOTE = 'Perbesar Modal, Bukan Risiko!';

const AUTH_USER_KEY = 'gold_tracker_username';
const AUTH_PIN_HASH_KEY = 'gold_tracker_pin_hash';

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface TradeRecord {
  level: number;
  startingBalance: number;
  riskPercentage: number;
  riskAmount: number;
  profitGoal: number;
  pips: number;
  lotSize: number;
  result: 'Win' | 'Loss';
  lossAmount?: number;
  winAmount?: number;
  rr: 1.5 | 2;
  createdAt: string;
  endingBalance: number;
}

interface SetupData {
  initialBalance: number;
  targetPips: number;
  riskPercentage: number;
}

interface PlaybookItem {
  id: string;
  title: string;
  notes: string | null;
  trend15m: 'Uptrend' | 'Downtrend';
  condition3m: 'Uptrend' | 'Downtrend';
  imagePath: string;
  createdAt: string;
}

function floorTo2(value: number) {
  return Math.floor(value * 100) / 100;
}

function MoneyManagementCalculator() {
  const [balanceRaw, setBalanceRaw] = useState<string>('');
  const balance = Number(balanceRaw);

  const riskLimit = useMemo(() => {
    if (!isFinite(balance) || balance <= 0) return 0;
    return balance * 0.05;
  }, [balance]);

  const maxLot = useMemo(() => {
    if (!isFinite(balance) || balance <= 0) return 0;
    const lot = (balance / 200) * 0.01;
    return floorTo2(lot);
  }, [balance]);

  const targetMin = useMemo(() => riskLimit * 1.5, [riskLimit]);
  const targetIdeal = useMemo(() => riskLimit * 2, [riskLimit]);

  return (
    <div className="min-h-screen text-slate-50 selection:bg-blue-500/30">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full mb-6">
            <Coins className="w-4 h-4 text-yellow-500 fill-yellow-500/20" />
            <span className="text-xs font-bold tracking-widest uppercase text-blue-400">Trading GOLD</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
            Forex Money Management Calculator
          </h1>
          <p className="text-xl md:text-2xl font-extrabold tracking-tight text-white/90">{MM_QUOTE}</p>
        </div>

        <div className="glass-card rounded-[2rem] p-8 md:p-10 glow-blue">
          <label className="block text-sm font-semibold text-slate-300 ml-1 mb-3">
            Modal Saat Ini / Current Balance ($)
          </label>
          <div className="relative group">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="number"
              value={balanceRaw}
              onChange={(e) => setBalanceRaw(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-slate-900"
              placeholder="Masukkan modal (contoh: 1000)"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="glass-card rounded-3xl p-7 border border-red-500/20">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Batas Risiko (Risk Limit 5%)</p>
            <p className="mt-3 text-3xl font-extrabold text-red-400">Maksimal Loss: ${formatMoney(riskLimit)}</p>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              Risiko dibatasi 5% per trade. Anda memiliki "nafas" hingga 20x loss beruntun sebelum modal habis.
            </p>
          </div>

          <div className="glass-card rounded-3xl p-7 border border-blue-500/20">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Batas Lot (Max Lot Size)</p>
            <p className="mt-3 text-3xl font-extrabold text-blue-400">Maksimal Lot: {maxLot.toFixed(2)} Lot</p>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              Gunakan lot ini agar ketahanan dana tetap terjaga sesuai aturan.
            </p>
          </div>

          <div className="glass-card rounded-3xl p-7 border border-green-500/20">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Target Profit (Risk to Reward Ratio)</p>
            <div className="mt-3 space-y-2">
              <p className="text-base font-semibold text-slate-200">Target Profit Minimal (1:1.5): <span className="text-green-400">${formatMoney(targetMin)}</span></p>
              <p className="text-base font-semibold text-slate-200">Target Profit Ideal (1:2): <span className="text-green-400">${formatMoney(targetIdeal)}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [authPhase, setAuthPhase] = useState<'login' | 'ready'>('login');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [jakartaNow, setJakartaNow] = useState<Date>(() => new Date());
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderEmail, setReminderEmail] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [showAddPlaybookModal, setShowAddPlaybookModal] = useState(false);
  const [activePlaybook, setActivePlaybook] = useState<PlaybookItem | null>(null);
  const [playbookZoom, setPlaybookZoom] = useState(1);
  const [playbooks, setPlaybooks] = useState<PlaybookItem[]>([]);
  const [playbookBusy, setPlaybookBusy] = useState(false);
  const [playbookError, setPlaybookError] = useState<string | null>(null);
  const [pbTitle, setPbTitle] = useState('');
  const [pbNotes, setPbNotes] = useState('');
  const [pbTrend15m, setPbTrend15m] = useState<'Uptrend' | 'Downtrend'>('Uptrend');
  const [pbCondition3m, setPbCondition3m] = useState<'Uptrend' | 'Downtrend'>('Uptrend');
  const [pbFile, setPbFile] = useState<File | null>(null);
  const [pbUploading, setPbUploading] = useState(false);
  const [page, setPage] = useState<'challenge' | 'calculator'>('challenge');
  const [phase, setPhase] = useState<'setup' | 'active'>('setup');
  const [rr, setRr] = useState<1.5 | 2>(1.5);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [profitMode, setProfitMode] = useState<'rr' | 'pips'>('rr');
  const [lotMode, setLotMode] = useState<'auto' | 'manual'>('auto');
  const [lotSizeInput, setLotSizeInput] = useState('');
  const [setupData, setSetupData] = useState<SetupData>({
    initialBalance: 1000,
    targetPips: 20,
    riskPercentage: 30,
  });
  
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentBalance, setCurrentBalance] = useState(1000);
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
  const [showLossModal, setShowLossModal] = useState(false);
  const [lossAmount, setLossAmount] = useState('');
  const [showWinModal, setShowWinModal] = useState(false);
  const [winAmount, setWinAmount] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem(AUTH_USER_KEY);
    const savedPinHash = localStorage.getItem(AUTH_PIN_HASH_KEY);
    if (savedUser && savedPinHash) {
      setUsername(savedUser);
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      // Convert "now" to Asia/Jakarta clock time (GMT+7) without changing actual Date epoch.
      const dt = new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).formatToParts(dt);

      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
      const y = Number(get('year'));
      const m = Number(get('month'));
      const d = Number(get('day'));
      const hh = Number(get('hour'));
      const mm = Number(get('minute'));
      const ss = Number(get('second'));
      setJakartaNow(new Date(y, m - 1, d, hh, mm, ss));
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const openPlaybookViewer = (item: PlaybookItem) => {
    setActivePlaybook(item);
    setPlaybookZoom(1);
  };

  const closePlaybookViewer = () => {
    setActivePlaybook(null);
    setPlaybookZoom(1);
  };

  const handleLogout = () => {
    setAuthPhase('login');
    setPin('');
    setAuthError(null);
    setSessionId(null);
    setTradeHistory([]);
    setPhase('setup');
  };

  const handleLogin = async () => {
    const u = username.trim();
    const p = pin.trim();
    if (!u) {
      setAuthError('Username wajib diisi.');
      return;
    }
    if (!/^\d{4}$/.test(p)) {
      setAuthError('PIN harus 4 digit angka.');
      return;
    }

    setAuthBusy(true);
    setAuthError(null);
    try {
      const uname = u.toLowerCase();
      const pinHash = await sha256Hex(`${uname}:${p}`);

      // Preferred: Supabase-backed login (works across devices)
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('users')
          .select('pin_hash')
          .eq('username', uname)
          .limit(1);

        if (error) {
          setAuthError(`Supabase error: ${error.message}`);
          setAuthBusy(false);
          return;
        }

        const existing = (data ?? [])[0] as { pin_hash?: string } | undefined;
        if (!existing) {
          const { error: insertError } = await supabase.from('users').insert({
            username: uname,
            pin_hash: pinHash,
          });
          if (insertError) {
            setAuthError(`Supabase error: ${insertError.message}`);
            setAuthBusy(false);
            return;
          }
        } else {
          if (existing.pin_hash !== pinHash) {
            setAuthError('Username atau PIN salah.');
            setAuthBusy(false);
            return;
          }
        }

        localStorage.setItem(AUTH_USER_KEY, uname);
        setSessionId(`user:${uname}`);
      } else {
        // Fallback: local-only PIN
        const savedUser = localStorage.getItem(AUTH_USER_KEY);
        const savedPinHash = localStorage.getItem(AUTH_PIN_HASH_KEY);

        if (savedUser && savedPinHash) {
          if (savedUser !== uname || savedPinHash !== pinHash) {
            setAuthError('Username atau PIN salah.');
            setAuthBusy(false);
            return;
          }
        } else {
          localStorage.setItem(AUTH_USER_KEY, uname);
          localStorage.setItem(AUTH_PIN_HASH_KEY, pinHash);
        }

        setSessionId(`user:${uname}`);
      }

      setAuthPhase('ready');
      setPin('');
    } catch {
      setAuthError('Gagal memproses login.');
    } finally {
      setAuthBusy(false);
    }
  };

  useEffect(() => {
    if (!sessionId || !isSupabaseConfigured || !supabase) return;
    setIsSyncing(true);
    setSyncError(null);

    (async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('session_id', sessionId)
        .order('level', { ascending: false });

      if (error) {
        setSyncError(error.message);
        setIsSyncing(false);
        return;
      }

      const mapped: TradeRecord[] = (data ?? []).map((row: any) => ({
        level: row.level,
        startingBalance: Number(row.starting_balance),
        riskPercentage: Number(row.risk_percentage),
        riskAmount: Number(row.risk_amount),
        profitGoal: Number(row.profit_goal),
        pips: Number(row.pips),
        lotSize: Number(row.lot_size),
        result: row.result,
        lossAmount: row.loss_amount == null ? undefined : Number(row.loss_amount),
        winAmount: row.win_amount == null ? undefined : Number(row.win_amount),
        rr: row.rr === 2 || row.rr === '2' ? 2 : 1.5,
        createdAt: row.created_at == null ? new Date().toISOString() : String(row.created_at),
        endingBalance: Number(row.ending_balance),
      }));

      setTradeHistory(mapped);
      if (mapped.length > 0) {
        setCurrentLevel(mapped[0].level + 1);
        setCurrentBalance(mapped[0].endingBalance);
        setPhase('active');
      }
      setIsSyncing(false);
    })();
  }, [sessionId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const uname = username.trim().toLowerCase();
    if (!uname) return;

    (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('email,reminder_enabled')
        .eq('username', uname)
        .limit(1);

      if (error) return;
      const row = (data ?? [])[0] as { email?: string | null; reminder_enabled?: boolean | null } | undefined;
      if (!row) return;
      setReminderEmail(row.email ?? '');
      setReminderEnabled(Boolean(row.reminder_enabled));
    })();
  }, [username]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsAdmin(false);
      setAdminBusy(false);
      setAdminError(null);
      return;
    }
    const uname = username.trim().toLowerCase();
    if (!uname) {
      setIsAdmin(false);
      setAdminBusy(false);
      setAdminError(null);
      return;
    }

    (async () => {
      setAdminBusy(true);
      setAdminError(null);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('is_admin')
          .ilike('username', uname)
          .limit(1);
        if (error) throw new Error(error.message);
        const row = (data ?? [])[0] as { is_admin?: boolean | null } | undefined;
        if (!row) throw new Error(`User '${uname}' tidak ditemukan di table users.`);
        setIsAdmin(Boolean(row.is_admin));
      } catch (e) {
        setIsAdmin(false);
        setAdminError(e instanceof Error ? e.message : String(e));
      } finally {
        setAdminBusy(false);
      }
    })();
  }, [username]);

  const loadPlaybooks = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setPlaybooks([]);
      return;
    }
    setPlaybookBusy(true);
    setPlaybookError(null);
    try {
      const query = supabase
        .from('playbooks')
        .select('id,title,notes,trend_15m,condition_3m,image_path,created_at')
        .order('created_at', { ascending: false });
      let data: any[] | null = null;
      let error: { message: string } | null = null;

      const res1 = await query;
      data = (res1 as any).data ?? null;
      error = (res1 as any).error ?? null;

      if (error) {
        const msg = String(error.message || 'Unknown error');
        const missingTrendColumns =
          msg.includes('trend_15m') ||
          msg.includes('condition_3m') ||
          msg.includes("schema cache") ||
          msg.includes('does not exist');

        if (!missingTrendColumns) throw new Error(msg);

        const res2 = await supabase
          .from('playbooks')
          .select('id,title,notes,image_path,created_at')
          .order('created_at', { ascending: false });
        if (res2.error) throw new Error(res2.error.message);
        data = res2.data as any[];
      }

      const mapped = (data ?? []).map((r: any) => ({
        id: String(r.id),
        title: String(r.title ?? ''),
        notes: r.notes == null ? null : String(r.notes),
        trend15m: (String(r.trend_15m ?? 'Uptrend') === 'Downtrend' ? 'Downtrend' : 'Uptrend') as 'Uptrend' | 'Downtrend',
        condition3m: (String(r.condition_3m ?? 'Uptrend') === 'Downtrend' ? 'Downtrend' : 'Uptrend') as 'Uptrend' | 'Downtrend',
        imagePath: String(r.image_path ?? ''),
        createdAt: String(r.created_at ?? ''),
      })) as PlaybookItem[];
      setPlaybooks(mapped);
    } catch (e) {
      setPlaybookError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlaybookBusy(false);
    }
  };

  const getPlaybookImageUrl = (path: string) => {
    if (!isSupabaseConfigured || !supabase) return '';
    const { data } = supabase.storage.from('playbooks').getPublicUrl(path);
    return data.publicUrl;
  };

  const createPlaybook = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setPlaybookError('Supabase belum dikonfigurasi.');
      return;
    }
    if (!isAdmin) {
      setPlaybookError('Admin only.');
      return;
    }
    if (!pbTitle.trim()) {
      setPlaybookError('Title wajib diisi.');
      return;
    }
    if (!pbFile) {
      setPlaybookError('Gambar wajib diupload.');
      return;
    }

    const uname = username.trim().toLowerCase();
    setPbUploading(true);
    setPlaybookError(null);
    try {
      const safeName = pbFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const objectPath = `${uname}/${crypto.randomUUID()}_${safeName}`;
      const { error: uploadError } = await supabase
        .storage
        .from('playbooks')
        .upload(objectPath, pbFile, { upsert: false, contentType: pbFile.type || 'image/png' });
      if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);

      const payloadFull = {
        title: pbTitle.trim(),
        notes: pbNotes.trim() || null,
        trend_15m: pbTrend15m,
        condition_3m: pbCondition3m,
        image_path: objectPath,
        created_by: uname,
      };

      let insertError = (await supabase.from('playbooks').insert(payloadFull)).error;

      if (insertError) {
        const msg = String(insertError.message || 'Unknown error');
        const missingTrendColumns =
          msg.includes('trend_15m') ||
          msg.includes('condition_3m') ||
          msg.includes("schema cache") ||
          msg.includes('does not exist');

        if (!missingTrendColumns) throw new Error(`Simpan data gagal: ${msg}`);

        const payloadLegacy = {
          title: pbTitle.trim(),
          notes: pbNotes.trim() || null,
          image_path: objectPath,
          created_by: uname,
        };

        insertError = (await supabase.from('playbooks').insert(payloadLegacy)).error;
        if (insertError) throw new Error(`Simpan data gagal: ${insertError.message}`);

        setPlaybookError(
          "Kolom trend belum ada di table 'playbooks'. Data tersimpan tanpa trend. Jalankan SQL: ALTER TABLE playbooks ADD COLUMN trend_15m text; ALTER TABLE playbooks ADD COLUMN condition_3m text;"
        );
      }

      setPbTitle('');
      setPbNotes('');
      setPbTrend15m('Uptrend');
      setPbCondition3m('Uptrend');
      setPbFile(null);
      await loadPlaybooks();
    } catch (e) {
      setPlaybookError(e instanceof Error ? e.message : String(e));
    } finally {
      setPbUploading(false);
    }
  };

  const deletePlaybook = async (item: PlaybookItem) => {
    if (!isSupabaseConfigured || !supabase) return;
    if (!isAdmin) return;
    setPlaybookError(null);
    try {
      const { error: delRowError } = await supabase.from('playbooks').delete().eq('id', item.id);
      if (delRowError) throw new Error(delRowError.message);
      const { error: delFileError } = await supabase.storage.from('playbooks').remove([item.imagePath]);
      if (delFileError) throw new Error(delFileError.message);
      await loadPlaybooks();
    } catch (e) {
      setPlaybookError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveReminderSettings = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setReminderError('Supabase belum dikonfigurasi.');
      return;
    }
    const uname = username.trim().toLowerCase();
    if (!uname) return;

    if (reminderEnabled) {
      const email = reminderEmail.trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!ok) {
        setReminderError('Email tidak valid.');
        return;
      }
    }

    setReminderBusy(true);
    setReminderError(null);
    try {
      const { error } = await supabase
        .from('users')
        .update({ email: reminderEmail.trim() || null, reminder_enabled: reminderEnabled })
        .eq('username', uname);
      if (error) throw new Error(error.message);
      setShowReminderModal(false);
    } catch (e) {
      setReminderError(e instanceof Error ? e.message : String(e));
    } finally {
      setReminderBusy(false);
    }
  };

  async function insertTrade(record: TradeRecord) {
    if (!sessionId || !isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from('trades').insert({
      session_id: sessionId,
      level: record.level,
      starting_balance: record.startingBalance,
      risk_percentage: record.riskPercentage,
      risk_amount: record.riskAmount,
      profit_goal: record.profitGoal,
      pips: record.pips,
      lot_size: record.lotSize,
      result: record.result,
      win_amount: record.winAmount ?? null,
      loss_amount: record.lossAmount ?? null,
      ending_balance: record.endingBalance,
    });

    if (error) setSyncError(error.message);
  }

  const suggestions = useMemo(() => {
    const riskAmountRaw = currentBalance * (setupData.riskPercentage / 100);
    const riskAmount = Number(riskAmountRaw.toFixed(2));

    const profitMin = Number((riskAmount * 1.5).toFixed(2));
    const profitMax = Number((riskAmount * 2).toFixed(2));

    // User lot input (manual)
    const lotNum = parseFloat(lotSizeInput);
    const manualLotRaw = lotMode === 'manual' && isFinite(lotNum) && lotNum > 0 ? lotNum : null;

    // Lot cap rule:
    // For each $200 balance, max lot is 0.01.
    // Example: $200 => 0.01, $400 => 0.02, etc.
    const maxLot = currentBalance > 0 ? (currentBalance / 200) * 0.01 : 0;

    // XAU/USD pip value rule:
    // Profit ($) = Pips * Lot * 10
    // RR mode profit: Profit = Risk * RR
    const rrProfit = Number((riskAmount * rr).toFixed(2));

    // Auto lot is derived from RR target
    const autoLot = rrProfit / (setupData.targetPips * 10);
    const cappedAutoLot = maxLot > 0 ? Math.min(autoLot, maxLot) : autoLot;
    const cappedManualLot = manualLotRaw == null ? null : (maxLot > 0 ? Math.min(manualLotRaw, maxLot) : manualLotRaw);
    const lotSize = cappedManualLot ?? cappedAutoLot;
    const isCapped = (manualLotRaw != null && cappedManualLot != null && cappedManualLot < manualLotRaw) || (cappedAutoLot < autoLot);

    const expectedProfitAtPips = Number((setupData.targetPips * lotSize * 10).toFixed(2));

    const profitSelected = profitMode === 'rr' ? rrProfit : expectedProfitAtPips;

    return {
      riskAmount,
      lotSize: Number(lotSize.toFixed(2)),
      maxLot: Number(maxLot.toFixed(2)),
      isCapped,
      profitMin,
      profitMax,
      profitSelected,
      expectedProfitAtPips,
      rrProfit,
    };
  }, [currentBalance, setupData.riskPercentage, setupData.targetPips, rr, profitMode, lotMode, lotSizeInput]);

  const maxLotAllowed = useMemo(() => {
    if (!isFinite(currentBalance) || currentBalance <= 0) return 0;
    return Number(((currentBalance / 200) * 0.01).toFixed(2));
  }, [currentBalance]);

  const handleStartChallenge = () => {
    setCurrentBalance(setupData.initialBalance);
    setCurrentLevel(1);
    setTradeHistory([]);
    setPhase('active');
  };

  const challengeName = `${setupData.targetPips} Pip Challenge`;
  const goldNote = useMemo(() => pipValueNote(setupData.targetPips), [setupData.targetPips]);

  const sessionInfo = useMemo(() => {
    const minutes = jakartaNow.getHours() * 60 + jakartaNow.getMinutes();
    const tokyoStart = 7 * 60;
    const tokyoEnd = 16 * 60;
    const nyStart = 19 * 60;
    const nyEnd = 22 * 60;

    if (minutes >= tokyoStart && minutes < tokyoEnd) {
      return {
        key: 'tokyo' as const,
        title: 'Tokyo Session',
        subtitle: '07:00–16:00 (Jakarta GMT+7)',
        avg: 60.5,
        low: 33.27,
        high: 84.23,
        accent: 'text-blue-300',
        badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      };
    }

    if (minutes >= nyStart && minutes < nyEnd) {
      return {
        key: 'newyork' as const,
        title: 'New York Session',
        subtitle: '19:00–22:00 (Jakarta GMT+7)',
        // Using your provided non-news daily range as NY reference (breakout commonly happens in NY).
        avg: 78.5,
        low: 34,
        high: 110,
        accent: 'text-amber-300',
        badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      };
    }

    return {
      key: 'none' as const,
      title: 'Outside Major Session',
      subtitle: 'Tokyo 07:00–16:00 • New York 19:00–22:00 (Jakarta GMT+7)',
      avg: null as number | null,
      low: null as number | null,
      high: null as number | null,
      accent: 'text-slate-300',
      badge: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    };
  }, [jakartaNow]);

  if (authPhase === 'login') {
    return (
      <div className="min-h-screen px-4 py-14 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute -bottom-56 right-1/4 w-[900px] h-[900px] rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <div className="max-w-2xl mx-auto relative">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-700/60 bg-slate-900/40 backdrop-blur">
              <span className="text-xs font-extrabold tracking-widest text-blue-300">TRADING GOLD SPECIAL EDITION</span>
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl font-black tracking-tight text-white">GOLD TRACKER</h1>
            <p className="mt-3 text-slate-400">Masuk pakai username dan PIN untuk melanjutkan trading plan.</p>
          </div>

          <div className="glass-card rounded-3xl p-8 border border-slate-800/60 max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <p className="text-lg font-extrabold text-white">Login</p>
                <p className="text-xs text-slate-400">Tanpa email, tanpa registrasi.</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-300 ml-1 mb-2">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-4 px-4 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-slate-900"
                  placeholder="contoh: traderXAU"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 ml-1 mb-2">PIN (4 digit)</label>
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-4 px-4 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-slate-900 tracking-[0.3em]"
                  placeholder="••••"
                  inputMode="numeric"
                  autoComplete="current-password"
                />
              </div>

              {authError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {authError}
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={authBusy}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/25"
              >
                {authBusy ? 'Verifying...' : 'Continue'}
              </button>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Username & PIN disimpan di perangkat ini (local). Jika pindah device, set ulang username & PIN.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleWinOpen = () => {
    setWinAmount(String(suggestions.profitSelected));
    setShowWinModal(true);
  };

  const handleWinSubmit = () => {
    const win = parseFloat(winAmount);
    if (isNaN(win) || win < 0) return;
    const newBalance = currentBalance + win;
    const record: TradeRecord = {
      level: currentLevel,
      startingBalance: currentBalance,
      riskPercentage: setupData.riskPercentage,
      riskAmount: suggestions.riskAmount,
      profitGoal: suggestions.profitSelected,
      pips: setupData.targetPips,
      lotSize: suggestions.lotSize,
      result: 'Win',
      winAmount: win,
      rr,
      createdAt: new Date().toISOString(),
      endingBalance: newBalance,
    };
    
    setTradeHistory(prev => [record, ...prev]);
    setCurrentBalance(newBalance);
    setCurrentLevel(prev => prev + 1);
    void insertTrade(record);
    setShowWinModal(false);
    setWinAmount('');
  };

  const handleLossSubmit = () => {
    const loss = parseFloat(lossAmount);
    if (isNaN(loss) || loss < 0) return;
    
    const newBalance = Math.max(0, currentBalance - loss);
    const record: TradeRecord = {
      level: currentLevel,
      startingBalance: currentBalance,
      riskPercentage: setupData.riskPercentage,
      riskAmount: suggestions.riskAmount,
      profitGoal: suggestions.profitSelected,
      pips: setupData.targetPips,
      lotSize: suggestions.lotSize,
      result: 'Loss',
      lossAmount: loss,
      rr,
      createdAt: new Date().toISOString(),
      endingBalance: newBalance,
    };
    
    setTradeHistory(prev => [record, ...prev]);
    setCurrentBalance(newBalance);
    setCurrentLevel(prev => prev + 1);
    void insertTrade(record);
    setShowLossModal(false);
    setLossAmount('');
  };

  if (page === 'calculator') {
    return (
      <div>
        <div className="border-b border-slate-800/60 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">TRADING GOLD</h1>
                <p className="text-[10px] font-bold text-blue-400 tracking-widest uppercase">Money Management</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage('challenge')}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all"
              >
                Challenge
              </button>
              <button
                onClick={() => setPage('calculator')}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 border border-blue-500/40 rounded-xl text-sm font-semibold transition-all"
              >
                Calculator
              </button>
            </div>
          </div>
        </div>

        <MoneyManagementCalculator />
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <div className="min-h-screen text-slate-50 flex items-center justify-center p-6 selection:bg-blue-500/30">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full mb-6">
              <Coins className="w-4 h-4 text-yellow-500 fill-yellow-500/20" />
              <span className="text-xs font-bold tracking-widest uppercase text-blue-400">Trading GOLD Special Edition</span>
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
              {challengeName}
            </h1>
            <p className="text-slate-400 text-lg max-w-md mx-auto leading-relaxed">
              Master the XAU/USD market with professional compounding strategies.
            </p>
          </div>

          <div className="glass-card rounded-[2rem] p-10 glow-blue">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Challenge Setup</h2>
                <p className="text-slate-400 text-sm">Configure your trading parameters</p>
              </div>
            </div>

            <div className="grid gap-8">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-300 ml-1">Initial Balance ($)</label>
                <div className="group relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="number"
                    value={setupData.initialBalance}
                    onChange={(e) => setSetupData(prev => ({ ...prev, initialBalance: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-300 ml-1">Target Pips (0.01)</label>
                  <div className="group relative">
                    <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="number"
                      value={setupData.targetPips}
                      onChange={(e) => setSetupData(prev => ({ ...prev, targetPips: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-slate-900"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-300 ml-1">Risk % per Trade</label>
                  <div className="group relative">
                    <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="number"
                      value={setupData.riskPercentage}
                      onChange={(e) => setSetupData(prev => ({ ...prev, riskPercentage: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-slate-900"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartChallenge}
                className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-5 rounded-2xl transition-all duration-300 shadow-xl shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
              >
                Launch Challenge <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-50 selection:bg-blue-500/30">
      {/* Header Nav */}
      <div className="border-b border-slate-800/60 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">GOLD TRACKER</h1>
              <p className="text-[10px] font-bold text-blue-400 tracking-widest uppercase">XAU/USD Specialist</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-4">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Trading Mode</span>
              <span className="text-sm font-semibold text-slate-300">{challengeName}</span>
            </div>

            <div className="hidden md:flex flex-col items-end mr-4">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">User</span>
              <span className="text-sm font-semibold text-slate-300">{username}</span>
            </div>

            <div className="hidden lg:flex flex-col items-end mr-4">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Cloud Sync</span>
              <span className={`text-xs font-semibold ${syncError ? 'text-red-400' : isSyncing ? 'text-slate-300' : 'text-green-400'}`}>
                {syncError ? 'Error' : isSyncing ? 'Syncing…' : 'Connected'}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 mr-2">
              <button
                onClick={() => setPage('challenge')}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 border border-blue-500/40 rounded-xl text-sm font-semibold transition-all"
              >
                Challenge
              </button>
              <button
                onClick={() => setPage('calculator')}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all"
              >
                Calculator
              </button>
              <button
                onClick={async () => {
                  setPlaybookError(null);
                  setShowPlaybookModal(true);
                  await loadPlaybooks();
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-2"
                title="Playbook"
              >
                <BookOpen className="w-4 h-4 text-slate-300" />
                Playbook
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPhase('setup')}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all"
              >
                Reset Challenge
              </button>
              <button
                onClick={() => {
                  setReminderError(null);
                  setShowReminderModal(true);
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-2"
                title="Email Reminders"
              >
                <Mail className="w-4 h-4 text-slate-300" />
                Reminders
              </button>
              <button
                onClick={handleLogout}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Actions */}
          <div className="lg:col-span-8 space-y-8">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-700" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                    <LayoutDashboard className="w-6 h-6 text-blue-500" />
                  </div>
                  <span className="text-slate-400 font-semibold">Active Trade Level</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">{currentLevel}</span>
                  <span className="text-slate-500 font-medium">/ Challenge</span>
                </div>
              </div>

              <div className="glass-card rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-700" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-500" />
                  </div>
                  <span className="text-slate-400 font-semibold">Current Balance</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight">${formatMoney(currentBalance)}</span>
                </div>
              </div>
            </div>

            {/* Trading Suggestion */}
            <div className="glass-card rounded-[2.5rem] p-10 border-blue-500/20 shadow-2xl shadow-blue-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                <Target className="w-28 h-28 text-blue-500" />
              </div>

              <div className="flex items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-blue-500 rounded-full" />
                  <div>
                    <h3 className="text-2xl font-extrabold tracking-tight">Strategy Suggestion</h3>
                    <p className="mt-1 text-xs text-slate-500">Next-trade parameters (Gold/XAUUSD)</p>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mode</span>
                  <span className="text-xs font-extrabold text-slate-300">{profitMode === 'rr' ? 'RR' : 'Target Pips'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Risk Amount</p>
                  <p className="text-3xl font-bold text-white">${formatMoney(suggestions.riskAmount)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Lot Size</p>
                  <p className="text-3xl font-bold text-blue-400">{suggestions.lotSize.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Standard Gold Lots</p>
                </div>
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Profit Target</p>
                  <p className="text-3xl font-bold text-green-400">+${formatMoney(suggestions.profitSelected)}</p>
                  {profitMode === 'rr' ? (
                    <p className="text-[10px] text-slate-500 font-medium">
                      RR Range: +${formatMoney(suggestions.profitMin)} (1.5R) to +${formatMoney(suggestions.profitMax)} (2R)
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 font-medium">
                      Based on {setupData.targetPips} pips and lot size (${formatMoney(suggestions.expectedProfitAtPips)} expected).
                    </p>
                  )}
                  {profitMode === 'rr' && lotMode === 'manual' && (
                    <p className="text-[10px] text-slate-500 font-medium">RR mode tidak mengubah profit target berdasarkan lot.</p>
                  )}
                </div>
              </div>

              <div className="mt-7 grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5 glass-card rounded-2xl p-5 border-slate-800/60">
                  <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-3">Target Profit Mode</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setProfitMode('rr')}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${profitMode === 'rr' ? 'bg-blue-600 border-blue-500/40 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                    >
                      RR Mode
                    </button>
                    <button
                      onClick={() => setProfitMode('pips')}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${profitMode === 'pips' ? 'bg-blue-600 border-blue-500/40 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                    >
                      Target Pips
                    </button>
                  </div>
                  <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">
                    RR Mode: Profit = Risk × (1.5 atau 2). Target Pips: Profit = Pips × Lot × 10.
                  </p>
                </div>

                <div className="lg:col-span-7 glass-card rounded-2xl p-5 border-slate-800/60">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Lot Size</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLotMode('auto')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${lotMode === 'auto' ? 'bg-blue-600 border-blue-500/40 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                      >
                        Auto
                      </button>
                      <button
                        onClick={() => setLotMode('manual')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${lotMode === 'manual' ? 'bg-blue-600 border-blue-500/40 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                      >
                        Manual
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Manual Lot (optional)</label>
                      <input
                        type="number"
                        value={lotSizeInput}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (lotMode !== 'manual') {
                            setLotSizeInput(raw);
                            return;
                          }
                          const n = parseFloat(raw);
                          if (!isFinite(n) || n <= 0) {
                            setLotSizeInput(raw);
                            return;
                          }
                          const capped = maxLotAllowed > 0 ? Math.min(n, maxLotAllowed) : n;
                          setLotSizeInput(String(capped));
                        }}
                        disabled={lotMode !== 'manual'}
                        className={`w-full bg-slate-900/50 border rounded-2xl py-3 px-4 text-sm font-semibold outline-none transition-all ${lotMode === 'manual' ? 'border-slate-700/50 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 hover:bg-slate-900' : 'border-slate-800/50 opacity-60 cursor-not-allowed'}`}
                        placeholder="contoh: 0.10"
                        min="0"
                        step="0.01"
                      />
                      <p className="mt-2 text-[10px] text-slate-500 font-medium">Max lot: {maxLotAllowed.toFixed(2)} (rule: $200 = 0.01)</p>
                      {suggestions.isCapped && (
                        <p className="mt-1 text-[10px] text-amber-200 font-medium">Lot di-cap ke max lot.</p>
                      )}
                    </div>
                    <div className="text-sm text-slate-300">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Expected @ {setupData.targetPips} pips</p>
                      <p className="mt-1 font-extrabold text-green-400">+${formatMoney(suggestions.expectedProfitAtPips)}</p>
                    </div>
                  </div>

                  {profitMode === 'rr' && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2">RR</span>
                      <button
                        onClick={() => setRr(1.5)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${rr === 1.5 ? 'bg-blue-600 border-blue-500/40 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                      >
                        1 : 1.5
                      </button>
                      <button
                        onClick={() => setRr(2)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${rr === 2 ? 'bg-blue-600 border-blue-500/40 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                      >
                        1 : 2
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-6 text-xs text-slate-500 leading-relaxed">
                {goldNote}
              </p>

              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleWinOpen}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold py-6 rounded-2xl transition-all shadow-lg shadow-green-900/20 flex items-center justify-center gap-3 text-lg"
                >
                  <TrendingUp className="w-6 h-6" /> I Won Trade
                </button>
                <button
                  onClick={() => setShowLossModal(true)}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold py-6 rounded-2xl transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-3 text-lg"
                >
                  <TrendingDown className="w-6 h-6" /> I Lost Trade
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Brief History/Metrics */}
          <div className="lg:col-span-4 space-y-8">
            <div className="glass-card rounded-3xl p-7 border-slate-800/50">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className={`inline-flex items-center px-3 py-1.5 rounded-full border text-[10px] font-extrabold uppercase tracking-widest ${sessionInfo.badge}`}>
                    {sessionInfo.title}
                  </div>
                  <p className="mt-4 text-base font-extrabold text-white">Session Volatility</p>
                  <p className="mt-1 text-xs text-slate-500">{sessionInfo.subtitle}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Jakarta</p>
                  <p className="mt-1 text-base font-extrabold text-white font-mono">
                    {String(jakartaNow.getHours()).padStart(2, '0')}:{String(jakartaNow.getMinutes()).padStart(2, '0')}
                  </p>
                </div>
              </div>

              {sessionInfo.key === 'none' ? (
                <div className="mt-6 rounded-2xl border border-slate-800/60 bg-slate-950/30 p-5">
                  <p className="text-sm text-slate-200 font-bold">Outside session window</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Tokyo 07:00–16:00 • New York 19:00–22:00 (GMT+7)
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-b from-slate-950/40 to-slate-950/20 p-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Low</p>
                    <p className={`mt-2 text-xl font-black ${sessionInfo.accent}`}>{sessionInfo.low}</p>
                    <p className="text-[10px] text-slate-500">points</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-b from-slate-950/40 to-slate-950/20 p-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg</p>
                    <p className={`mt-2 text-xl font-black ${sessionInfo.accent}`}>~{sessionInfo.avg}</p>
                    <p className="text-[10px] text-slate-500">points</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-b from-slate-950/40 to-slate-950/20 p-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">High</p>
                    <p className={`mt-2 text-xl font-black ${sessionInfo.accent}`}>{sessionInfo.high}</p>
                    <p className="text-[10px] text-slate-500">points</p>
                  </div>
                </div>
              )}

              <p className="mt-5 text-[10px] text-slate-500">Based on recent Feb 2026 visual range analysis (non-news days).</p>
            </div>

            <div className="glass-card rounded-3xl p-7 border-slate-800/50">
              <div className="flex items-center justify-between gap-4 mb-6">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Trade Log</h4>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{tradeHistory.length} trades</span>
              </div>
              <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {tradeHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-center mx-auto mb-4">
                      <History className="w-7 h-7 text-slate-600" />
                    </div>
                    <p className="text-slate-300 text-sm font-bold">No trades yet</p>
                    <p className="mt-1 text-slate-500 text-xs">Record hasil trade pertama untuk mulai tracking.</p>
                  </div>
                ) : (
                  tradeHistory.map((trade) => (
                    <div key={trade.level} className="bg-slate-950/30 border border-slate-800/50 rounded-2xl p-4 flex items-center justify-between group hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${trade.result === 'Win' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {trade.result === 'Win' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-white">Level {trade.level}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{trade.result}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-extrabold ${trade.result === 'Win' ? 'text-green-400' : 'text-red-400'}`}>
                          {trade.result === 'Win'
                            ? `+$${formatMoney(trade.winAmount ?? trade.profitGoal)}`
                            : `-$${formatMoney(trade.lossAmount ?? 0)}`}
                        </p>
                        <p className="text-[10px] text-slate-500">${formatMoney(trade.endingBalance)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Full History Table */}
        <div className="mt-12 glass-card rounded-[2.5rem] overflow-hidden border-slate-800/50">
          <div className="p-8 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800">
                <History className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold">Comprehensive Performance Report</h3>
            </div>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-950/60 sticky top-0">
                  <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Level</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Starting Balance</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Percentage Risk (%)</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Risk ($)</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Profit Goal ($)</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Pips (0.01)</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Lot Size</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Result</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Ending Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {tradeHistory.map((record) => (
                  <tr key={record.level} className="hover:bg-slate-900/25 transition-colors">
                    <td className="py-5 px-6 font-bold text-slate-200">#{record.level}</td>
                    <td className="py-5 px-6 font-medium text-slate-300">${formatMoney(record.startingBalance)}</td>
                    <td className="py-5 px-6 text-slate-300">{record.riskPercentage}%</td>
                    <td className="py-5 px-6 text-slate-300">${formatMoney(record.riskAmount)}</td>
                    <td className="py-5 px-6 text-green-400 font-semibold">+${formatMoney(record.profitGoal)}</td>
                    <td className="py-5 px-6 text-slate-300">{record.pips}</td>
                    <td className="py-5 px-6 font-mono text-blue-400">{record.lotSize.toFixed(2)}</td>
                    <td className="py-5 px-6">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest ${record.result === 'Win' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {record.result === 'Win'
                          ? `WIN (+$${formatMoney(record.winAmount ?? record.profitGoal)})`
                          : `LOSS (-$${formatMoney(record.lossAmount ?? 0)})`}
                      </span>
                    </td>
                    <td className="py-5 px-6 font-bold text-white">${formatMoney(record.endingBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Win Modal */}
      {showWinModal && (
        <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-xl flex items-center justify-center p-6 z-[100]">
          <div className="glass-card rounded-[2rem] p-10 w-full max-w-md border-slate-800 shadow-2xl">
            <h3 className="text-2xl font-bold mb-2">Record Win</h3>
            <p className="text-slate-400 text-sm mb-8">Masukkan profit aktual untuk trade ini.</p>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-300 ml-1">Win Amount ($)</label>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-green-500 transition-colors" />
                  <input
                    type="number"
                    value={winAmount}
                    onChange={(e) => setWinAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-lg font-medium outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
                    placeholder={String(suggestions.profitSelected)}
                    min="0"
                    step="0.01"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-500">Suggested: +${formatMoney(suggestions.profitSelected)} ({rr === 1.5 ? '1:1.5' : '1:2'})</p>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => {
                    setShowWinModal(false);
                    setWinAmount('');
                  }}
                  className="flex-1 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWinSubmit}
                  className="flex-1 py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold transition-all shadow-lg shadow-green-600/20"
                >
                  Confirm Win
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loss Modal */}
      {showLossModal && (
        <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-xl flex items-center justify-center p-6 z-[100]">
          <div className="glass-card rounded-[2rem] p-10 w-full max-w-md border-slate-800 shadow-2xl">
            <h3 className="text-2xl font-bold mb-2">Record Loss</h3>
            <p className="text-slate-400 text-sm mb-8">Enter the actual drawdown for this trade.</p>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-300 ml-1">Loss Amount ($)</label>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-red-500 transition-colors" />
                  <input
                    type="number"
                    value={lossAmount}
                    onChange={(e) => setLossAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-lg font-medium outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>
              
              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => {
                    setShowLossModal(false);
                    setLossAmount('');
                  }}
                  className="flex-1 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLossSubmit}
                  className="flex-1 py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-lg shadow-red-600/20"
                >
                  Confirm Loss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReminderModal && (
        <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-xl flex items-center justify-center p-6 z-[100]">
          <div className="glass-card rounded-[2rem] p-10 w-full max-w-lg border-slate-800 shadow-2xl">
            <h3 className="text-2xl font-bold mb-2">Email Reminders</h3>
            <p className="text-slate-400 text-sm mb-8">
              Kirim reminder otomatis jam 09:00, 11:00, dan 20:00 WIB.
            </p>

            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800/60 bg-slate-950/30 px-5 py-4">
                <div>
                  <p className="text-sm font-extrabold text-white">Enable Reminders</p>
                  <p className="text-xs text-slate-500">Aktifkan pengiriman email terjadwal.</p>
                </div>
                <button
                  onClick={() => setReminderEnabled((v) => !v)}
                  className={`w-14 h-8 rounded-full border transition-all relative ${reminderEnabled ? 'bg-blue-600/80 border-blue-500/40' : 'bg-slate-900 border-slate-800'}`}
                  aria-label="Toggle reminders"
                >
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white transition-all ${reminderEnabled ? 'left-7' : 'left-1'}`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 ml-1 mb-2">Email</label>
                <input
                  value={reminderEmail}
                  onChange={(e) => setReminderEmail(e.target.value)}
                  disabled={!reminderEnabled}
                  className={`w-full bg-slate-900/50 border rounded-2xl py-4 px-4 text-lg font-medium outline-none transition-all ${reminderEnabled ? 'border-slate-700/50 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 hover:bg-slate-900' : 'border-slate-800/50 opacity-60 cursor-not-allowed'}`}
                  placeholder="you@email.com"
                  autoComplete="email"
                />
              </div>

              {reminderError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {reminderError}
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => {
                    setShowReminderModal(false);
                    setReminderError(null);
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-4 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={saveReminderSettings}
                  disabled={reminderBusy}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/25"
                >
                  {reminderBusy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPlaybookModal && (
        <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-xl flex items-center justify-center p-6 z-[100]">
          <div className="glass-card rounded-[2rem] p-10 w-full max-w-5xl border-slate-800 shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-6 mb-8">
              <div>
                <h3 className="text-2xl font-extrabold">Trading Playbook</h3>
                <p className="text-slate-400 text-sm">Kumpulan setup visual sebagai panduan eksekusi.</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => {
                      setPlaybookError(null);
                      setShowAddPlaybookModal(true);
                    }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 border border-blue-500/40 rounded-xl text-sm font-semibold transition-all"
                  >
                    Add Playbook
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowPlaybookModal(false);
                    setShowAddPlaybookModal(false);
                    closePlaybookViewer();
                    setPlaybookError(null);
                  }}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            {!isAdmin && (
              <div className="rounded-3xl border border-slate-800/60 bg-slate-950/30 p-6 mb-8">
                <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Admin Form</p>
                <p className="mt-2 text-sm text-slate-300">
                  Form input playbook hanya muncul untuk admin.
                </p>
                {adminBusy ? (
                  <p className="mt-2 text-xs text-slate-500">Checking admin status…</p>
                ) : adminError ? (
                  <p className="mt-2 text-xs text-red-300">Admin check failed: {adminError}</p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Pastikan `users.is_admin = true` untuk username: <span className="font-bold text-slate-300">{username.trim().toLowerCase()}</span>
                  </p>
                )}

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 px-4 py-3">
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Supabase</p>
                    <p className="mt-1 text-xs text-slate-300 font-bold">{isSupabaseConfigured ? 'Configured' : 'Not Configured'}</p>
                    {!isSupabaseConfigured && (
                      <p className="mt-1 text-[10px] text-slate-500">Set `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 px-4 py-3">
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Username (active)</p>
                    <p className="mt-1 text-xs text-slate-300 font-bold">{username.trim().toLowerCase() || '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {playbookError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-6">
                {playbookError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              {playbookBusy ? (
                <div className="text-center py-16 text-slate-400">Loading…</div>
              ) : playbooks.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-7 h-7 text-slate-600" />
                  </div>
                  <p className="text-slate-300 text-sm font-bold">No playbook yet</p>
                  <p className="mt-1 text-slate-500 text-xs">Admin bisa upload playbook pertama.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {playbooks.map((pb) => (
                    <div key={pb.id} className="rounded-3xl border border-slate-800/60 bg-slate-950/30 overflow-hidden group">
                      <button
                        onClick={() => openPlaybookViewer(pb)}
                        className="block w-full text-left"
                        title="Open"
                      >
                        <div className="aspect-video bg-slate-950/40">
                          <img
                            src={getPlaybookImageUrl(pb.imagePath)}
                            alt={pb.title}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-5">
                          <p className="text-sm font-extrabold text-white">{pb.title}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded-xl border border-slate-800 bg-slate-900/40 text-[10px] font-extrabold text-slate-300">
                              15m: {pb.trend15m}
                            </span>
                            <span className="px-2.5 py-1 rounded-xl border border-slate-800 bg-slate-900/40 text-[10px] font-extrabold text-slate-300">
                              3m: {pb.condition3m}
                            </span>
                          </div>
                          {pb.notes && <p className="mt-2 text-xs text-slate-500 leading-relaxed">{pb.notes}</p>}
                        </div>
                      </button>

                      {isAdmin && (
                        <div className="px-5 pb-5">
                          <button
                            onClick={() => void deletePlaybook(pb)}
                            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-extrabold text-slate-200 transition-all"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddPlaybookModal && isAdmin && (
        <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-xl flex items-center justify-center p-6 z-[110]">
          <div className="glass-card rounded-[2rem] p-10 w-full max-w-3xl border-slate-800 shadow-2xl">
            <div className="flex items-start justify-between gap-6 mb-8">
              <div>
                <h3 className="text-2xl font-extrabold">Add Playbook</h3>
                <p className="text-slate-400 text-sm">Isi data dan upload gambar.</p>
              </div>
              <button
                onClick={() => {
                  setShowAddPlaybookModal(false);
                  setPlaybookError(null);
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all"
              >
                Close
              </button>
            </div>

            <div className="rounded-3xl border border-slate-800/60 bg-slate-950/30 p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4">
                  <label className="block text-sm font-semibold text-slate-300 ml-1 mb-2">Title</label>
                  <input
                    value={pbTitle}
                    onChange={(e) => setPbTitle(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-3 px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-slate-900"
                    placeholder="contoh: OB + Liquidity Sweep"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="block text-sm font-semibold text-slate-300 ml-1 mb-2">Notes</label>
                  <input
                    value={pbNotes}
                    onChange={(e) => setPbNotes(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-3 px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-slate-900"
                    placeholder="rules singkat / checklist"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-semibold text-slate-300 ml-1 mb-2">15 Menit</label>
                  <select
                    value={pbTrend15m}
                    onChange={(e) => setPbTrend15m(e.target.value === 'Downtrend' ? 'Downtrend' : 'Uptrend')}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-3 px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-slate-900"
                  >
                    <option value="Uptrend">Uptrend</option>
                    <option value="Downtrend">Downtrend</option>
                  </select>
                </div>
                <div className="md:col-span-4">
                  <label className="block text-sm font-semibold text-slate-300 ml-1 mb-2">Kondisi 3 Menit</label>
                  <select
                    value={pbCondition3m}
                    onChange={(e) => setPbCondition3m(e.target.value === 'Downtrend' ? 'Downtrend' : 'Uptrend')}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-3 px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all hover:bg-slate-900"
                  >
                    <option value="Uptrend">Uptrend</option>
                    <option value="Downtrend">Downtrend</option>
                  </select>
                </div>
                <div className="md:col-span-8">
                  <label className="block text-sm font-semibold text-slate-300 ml-1 mb-2">Upload Gambar</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPbFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-slate-900 file:text-slate-200 hover:file:bg-slate-800"
                  />
                </div>
              </div>

              {playbookError && (
                <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {playbookError}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-[10px] text-slate-500">Upload ke bucket `playbooks` (public) dan simpan metadata ke table `playbooks`.</p>
                <button
                  onClick={async () => {
                    await createPlaybook();
                    if (!pbUploading) setShowAddPlaybookModal(false);
                  }}
                  disabled={pbUploading}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold transition-all"
                >
                  {pbUploading ? 'Uploading…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activePlaybook && (
        <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-xl flex items-center justify-center p-4 z-[120]">
          <div className="w-full max-w-6xl h-[85vh] glass-card rounded-[2rem] border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-white truncate">{activePlaybook.title}</p>
                {activePlaybook.notes && <p className="text-xs text-slate-500 truncate">{activePlaybook.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPlaybookZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all"
                >
                  -
                </button>
                <button
                  onClick={() => setPlaybookZoom(1)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all"
                >
                  Reset
                </button>
                <button
                  onClick={() => setPlaybookZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all"
                >
                  +
                </button>
                <button
                  onClick={closePlaybookViewer}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar bg-slate-950/30">
              <div className="min-h-full flex items-center justify-center p-6">
                <img
                  src={getPlaybookImageUrl(activePlaybook.imagePath)}
                  alt={activePlaybook.title}
                  className="max-w-none rounded-2xl border border-slate-800/60 shadow-2xl"
                  style={{ transform: `scale(${playbookZoom})`, transformOrigin: 'center center' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
