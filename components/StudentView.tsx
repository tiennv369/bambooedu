import React, { useState, useEffect, useRef } from 'react';
import { 
    BookOpen, User, Key, ArrowRight, Loader2, Trophy, 
    Zap, Clock, LogOut, 
    Play, X, CheckSquare, AlertCircle, 
    History, Calendar, Search, Check, AlertTriangle, 
    ArrowLeft, Send, Info, ChevronDown, ChevronUp, 
    Grid, Ban, ShieldAlert, MonitorPlay, Home, Menu,
    CheckCircle, Wifi, WifiOff, RefreshCw, Power, Users
} from 'lucide-react';
import { Student, Exam, Question, QuestionType } from '../types';
import Peer from 'peerjs';
import { useLocation } from 'react-router-dom';
import LatexRenderer from './LatexRenderer';

// --- ROBUST PEER CONFIGURATION FOR MOBILE (DEEP FIX) ---
// Note: We use a wide array of free STUN servers to maximize NAT traversal chances on 4G/5G
const PEER_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    key: 'peerjs',
    debug: 1, // Reduced debug level for production
    config: {
        iceServers: [
            // Google STUN (Reliable)
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            // Fallback STUNs for Mobile Carriers
            { urls: 'stun:stun.ekiga.net' },
            { urls: 'stun:stun.ideasip.com' },
            { urls: 'stun:stun.schlund.de' },
            { urls: 'stun:stun.voiparound.com' },
            { urls: 'stun:stun.voipstunt.com' },
        ],
        iceCandidatePoolSize: 10, // Pre-fetch candidates for faster switching
    }
};

// --- TYPES ---
interface DisplayQuestion extends Question {
    displayOptions: { text: string; originalIndex: number }[];
}

interface GameState {
    rank: number;
    score: number;
    status: 'waiting' | 'lobby' | 'live' | 'finished';
}

interface StudentHistoryItem {
    examId: string;
    examTitle: string;
    date: string;
    score: number;
    totalQuestions: number;
}

interface SessionConfig {
    allowReview: boolean;
    strictMode?: boolean; 
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
}

// --- UTILS ---
const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

// --- SMART COMPARATOR FOR SHORT ANSWERS ---
const checkShortAnswer = (userAnswer: any, correctAnswers: string[]): boolean => {
    if (userAnswer === undefined || userAnswer === null || String(userAnswer).trim() === '') return false;
    
    const normalize = (str: string) => String(str).trim().toLowerCase().replace(/\s+/g, ' '); 
    const userStr = normalize(userAnswer);

    return correctAnswers.some(option => {
        const correctStr = normalize(option);
        if (userStr === correctStr) return true;
        const userNum = parseFloat(userStr.replace(',', '.'));
        const correctNum = parseFloat(correctStr.replace(',', '.'));
        if (!isNaN(userNum) && !isNaN(correctNum)) {
            return Math.abs(userNum - correctNum) < 0.000001;
        }
        return false;
    });
};

const StudentView: React.FC = () => {
    const location = useLocation();
    
    // --- APP STATE ---
    const [appMode, setAppMode] = useState<'login' | 'dashboard' | 'exam'>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [logoSrc, setLogoSrc] = useState<string | null>(null);
    
    // User Data
    const [credentials, setCredentials] = useState({ studentCode: '', password: '' });
    const [currentUser, setCurrentUser] = useState<Student | null>(null);
    const [examHistory, setExamHistory] = useState<StudentHistoryItem[]>([]);
    
    // Exam Data
    const [activeExam, setActiveExam] = useState<Exam | null>(null);
    const [questions, setQuestions] = useState<DisplayQuestion[]>([]);
    const [gameState, setGameState] = useState<GameState>({ rank: 0, score: 0, status: 'waiting' });
    const [sessionConfig, setSessionConfig] = useState<SessionConfig>({ allowReview: true, strictMode: false }); 
    const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
    const [timeLeft, setTimeLeft] = useState(0);
    
    // Connection & Inputs
    const [manualEntryCode, setManualEntryCode] = useState('');
    const [violationCount, setViolationCount] = useState(0);
    
    // UI Logic
    const [currentQIndex, setCurrentQIndex] = useState(0); 
    const [showPalette, setShowPalette] = useState(false); 
    const [showSubmitModal, setShowSubmitModal] = useState(false); 
    const [showReviewModal, setShowReviewModal] = useState(false); 
    const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
    const [isPenaltyActive, setIsPenaltyActive] = useState(false);
    const [penaltySeconds, setPenaltySeconds] = useState(0);
    const [exitCountdown, setExitCountdown] = useState<number | null>(null);

    // Refs
    const peerRef = useRef<Peer | null>(null);
    const connRef = useRef<any>(null);
    const timerRef = useRef<any>(null);
    const wakeLockRef = useRef<any>(null);
    
    // Mobile Connection Watchdogs
    const retryTimeoutRef = useRef<any>(null);
    const connectDelayRef = useRef<any>(null);

    // --- INITIALIZATION ---
    useEffect(() => {
        const storedProfile = localStorage.getItem('bamboo_student_profile');
        if (storedProfile) {
            const p = JSON.parse(storedProfile);
            setCredentials({ studentCode: p.studentCode || '', password: p.password || '' });
            setCurrentUser(p);
            setAppMode('dashboard');
        }
        
        const storedHistory = localStorage.getItem('bamboo_student_history');
        if (storedHistory) setExamHistory(JSON.parse(storedHistory));

        const savedAnswers = sessionStorage.getItem('bamboo_student_answers');
        if (savedAnswers) {
            try { setUserAnswers(JSON.parse(savedAnswers)); } catch(e) {}
        }

        const cachedLogo = localStorage.getItem('bamboo_student_cached_logo');
        if (cachedLogo) setLogoSrc(cachedLogo);

        const params = new URLSearchParams(location.search);
        const urlRoom = params.get('room');
        if (urlRoom && storedProfile) {
            setManualEntryCode(urlRoom);
        }
    }, [location]);

    // --- WAKE LOCK (PREVENT SLEEP) ---
    useEffect(() => {
        const requestWakeLock = async () => {
            if (appMode === 'exam' && 'wakeLock' in navigator) {
                try {
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                    console.log('Wake Lock active');
                } catch (err) {
                    console.log('Wake Lock error', err);
                }
            }
        };
        requestWakeLock();
        return () => {
            if (wakeLockRef.current) wakeLockRef.current.release();
        };
    }, [appMode]);

    // --- CONNECTION LOGIC (DEEP OPTIMIZED FOR MOBILE) ---
    const connectToExam = (code: string) => {
        if (connectionStatus === 'connected') return;
        
        // 1. Clear previous attempts and timeouts
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        if (connectDelayRef.current) clearTimeout(connectDelayRef.current);
        
        // Clean up previous peer instance aggressively
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }

        setConnectionStatus('connecting');
        setIsLoading(true);
        setError('');

        // 2. Watchdog: If not connected in 15s, stop spinning and show retry.
        // Mobile networks can be slow, so we give it a generous timeout.
        retryTimeoutRef.current = setTimeout(() => {
            if (connectionStatus !== 'connected') {
                console.log("Connection timed out. Resetting.");
                setIsLoading(false);
                setConnectionStatus('disconnected');
                setError('Kết nối quá lâu. Vui lòng kiểm tra mạng 4G/Wifi và thử lại.');
                if (peerRef.current) peerRef.current.destroy();
            }
        }, 15000);

        // 3. Small initial delay to ensure DOM/Network stack is clear from previous clicks
        setTimeout(() => {
            try {
                // @ts-ignore
                const peer = new Peer(PEER_CONFIG);
                peerRef.current = peer;

                peer.on('open', (id) => {
                    console.log('My Peer ID:', id);
                    
                    // 4. CRITICAL MOBILE FIX: 
                    // Do NOT connect immediately. Wait 1.5s for ICE candidates to gather on 4G.
                    // This allows the phone to find its public IP via STUN before shaking hands.
                    connectDelayRef.current = setTimeout(() => {
                        const conn = peer.connect(`bamboo_exam_${code}`, { 
                            reliable: true,
                            // 5. CRITICAL: Force JSON serialization. 
                            // BinaryPack (default) often fails on mobile networks/browsers (Safari/Chrome Mobile).
                            serialization: 'json' 
                        });
                        
                        conn.on('open', () => {
                            // Success! Clear watchdog
                            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                            console.log('Connected to Teacher!');
                            
                            connRef.current = conn;
                            setConnectionStatus('connected');
                            
                            // Send Login
                            conn.send({
                                type: 'LOGIN',
                                studentCode: credentials.studentCode,
                                password: credentials.password
                            });
                        });

                        conn.on('data', (data) => handleServerData(data));
                        
                        conn.on('close', () => {
                            console.log('Connection closed by peer');
                            setConnectionStatus('disconnected');
                            setIsLoading(false);
                        });

                        conn.on('error', (err) => {
                            console.error("Conn Error", err);
                            // Don't kill immediately, allow PeerJS to retry internally
                        });

                    }, 1500); // 1.5s Delay for ICE Gathering
                });

                peer.on('error', (err) => {
                    console.error("Peer Error", err);
                    // Specific handling for common errors
                    if (err.type === 'peer-unavailable') {
                        setError('Không tìm thấy phòng thi. Hãy kiểm tra lại Mã Code.');
                    } else if (err.type === 'network') {
                        setError('Lỗi mạng. Vui lòng kiểm tra kết nối Internet.');
                    } else {
                        setError('Lỗi kết nối. Thử tải lại trang.');
                    }
                    setIsLoading(false);
                    setConnectionStatus('disconnected');
                });

                peer.on('disconnected', () => {
                    // Auto reconnect to signalling server if connection drops but object allows
                    if (peer && !peer.destroyed) {
                        peer.reconnect();
                    }
                });

            } catch (e) {
                console.error(e);
                setIsLoading(false);
                setConnectionStatus('disconnected');
                setError('Lỗi khởi tạo. Trình duyệt không hỗ trợ WebRTC.');
            }
        }, 500);
    };

    // Manual Sync Button Action
    const handleManualSync = () => {
        if (connRef.current && connRef.current.open) {
            connRef.current.send({
                type: 'REQUEST_SYNC', // Custom type to ask teacher for state
                studentCode: credentials.studentCode
            });
            // Also re-send login just in case
            connRef.current.send({
                type: 'LOGIN',
                studentCode: credentials.studentCode,
                password: credentials.password
            });
            alert("Đã gửi yêu cầu đồng bộ!");
        } else {
            // Reconnect if dead
            connectToExam(manualEntryCode);
        }
    };

    const handleServerData = (data: any) => {
        if (data.type === 'LOGIN_SUCCESS') {
            setActiveExam(data.exam);
            
            if (data.student && currentUser) {
                const updatedUser = { ...currentUser, ...data.student };
                setCurrentUser(updatedUser);
                localStorage.setItem('bamboo_student_profile', JSON.stringify(updatedUser));
            }

            let processedQs: DisplayQuestion[] = [];
            if (data.exam && Array.isArray(data.exam.questions)) {
                processedQs = data.exam.questions.map((q: any) => ({
                    ...q,
                    displayOptions: Array.isArray(q.options) 
                        ? q.options.map((opt: string, idx: number) => ({ text: opt, originalIndex: idx })) 
                        : []
                }));
            }

            if (data.sessionConfig) {
                setSessionConfig(data.sessionConfig);
                if (data.sessionConfig.shuffleOptions) {
                    processedQs = processedQs.map((q: any) => ({ ...q, displayOptions: shuffleArray(q.displayOptions) }));
                }
                if (data.sessionConfig.shuffleQuestions) {
                    processedQs = shuffleArray(processedQs);
                }
            }
            setQuestions(processedQs);
            
            if (data.sessionState) {
                const status = (data.sessionState.status === 'setup' || data.sessionState.status === 'lobby') ? 'lobby' : data.sessionState.status;
                setGameState(prev => ({ ...prev, status: status }));
                setTimeLeft(data.sessionState.timeLeft || 0);
            }
            
            setAppMode('exam');
            setIsLoading(false);
        } else if (data.type === 'LOGIN_FAILED') {
            setError(data.message || 'Bạn không được phép tham gia phòng thi này.');
            setConnectionStatus('disconnected');
            setIsLoading(false);
            if (peerRef.current) peerRef.current.destroy();
        } else if (data.type === 'START') {
            setGameState(prev => ({ ...prev, status: 'live' }));
            if (activeExam) setTimeLeft(activeExam.durationMinutes * 60);
        } else if (data.type === 'SYNC') {
            if (data.timeLeft !== undefined) setTimeLeft(data.timeLeft);
            
            if (data.status) {
                 const status = (data.status === 'setup' || data.status === 'lobby') ? 'lobby' : data.status;
                 if (gameState.status === 'finished' && status === 'live') {
                     setGameState(prev => ({ ...prev, status: status }));
                 } else if (gameState.status !== 'finished') {
                     setGameState(prev => ({ ...prev, status: status }));
                 }
            }
        } else if (data.type === 'FINISH') {
            handleFinishExam();
        }
    };

    // --- GAMEPLAY LOGIC ---
    const calculateScore = () => {
        if (!activeExam || !questions.length) return 0;
        let score = 0;
        questions.forEach(q => {
            const ans = userAnswers[q.id];
            if (ans === undefined || ans === null) return;
            
            if (q.type === QuestionType.SHORT) {
                if (checkShortAnswer(ans, q.correctAnswers)) {
                    score += (q.points || 1);
                }
            } else {
                const correct = q.correctAnswers.map(String).sort().join(',');
                const user = Array.isArray(ans) ? ans.map(String).sort().join(',') : String(ans);
                if (correct === user) score += (q.points || 1);
            }
        });
        return score;
    };

    const handleAnswer = (qId: string, val: any, type: QuestionType) => {
        if (gameState.status !== 'live' || isPenaltyActive) return;
        const current = userAnswers[qId];
        let newVal = val;
        if (type === QuestionType.MULTIPLE) {
            const arr = current || [];
            newVal = arr.includes(val) ? arr.filter((x: any) => x !== val) : [...arr, val];
        }
        const newAnswers = { ...userAnswers, [qId]: newVal };
        setUserAnswers(newAnswers);
        sessionStorage.setItem('bamboo_student_answers', JSON.stringify(newAnswers));
        
        if (connRef.current?.open) {
            const score = calculateScore(); 
            connRef.current.send({
                type: 'UPDATE_PROGRESS',
                studentCode: credentials.studentCode,
                score: score,
                progress: Math.round((Object.keys(newAnswers).length / questions.length) * 100),
                violationCount: violationCount,
                status: 'in-exam'
            });
        }
    };

    const handleFinishExam = () => {
        if (!activeExam) return;
        const score = calculateScore();
        setGameState(prev => ({ ...prev, status: 'finished', score }));
        setShowSubmitModal(false);
        
        if (connRef.current?.open) {
            connRef.current.send({
                type: 'SUBMIT',
                studentCode: credentials.studentCode,
                score,
                violationCount,
                status: 'finished'
            });
        }

        const historyItem: StudentHistoryItem = {
            examId: activeExam.id,
            examTitle: activeExam.title,
            date: new Date().toISOString(),
            score,
            totalQuestions: activeExam.questions.length
        };
        const newHistory = [historyItem, ...examHistory];
        setExamHistory(newHistory);
        localStorage.setItem('bamboo_student_history', JSON.stringify(newHistory));
        sessionStorage.removeItem('bamboo_student_answers');
        setExitCountdown(10);
    };

    // Timer & Auto Exit
    useEffect(() => {
        if (gameState.status === 'live' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(t => {
                    if (t <= 1) { 
                        handleFinishExam(); 
                        return 0; 
                    }
                    return t - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [gameState.status, timeLeft > 0]);

    useEffect(() => {
        if (exitCountdown !== null && exitCountdown > 0) {
            const t = setTimeout(() => setExitCountdown(c => (c ? c - 1 : 0)), 1000);
            return () => clearTimeout(t);
        } else if (exitCountdown === 0) {
            setAppMode('dashboard');
            setExitCountdown(null);
        }
    }, [exitCountdown]);

    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!credentials.studentCode || !credentials.password) {
            setError("Vui lòng nhập đầy đủ thông tin!");
            return;
        }
        
        const tempUser: Student = {
             id: credentials.studentCode,
             studentCode: credentials.studentCode,
             name: 'Học sinh',
             password: credentials.password,
             avatar: `https://ui-avatars.com/api/?name=${credentials.studentCode}&background=random`,
             score: 0,
             progress: 0,
             streak: 0,
             status: 'online'
        };
        
        localStorage.setItem('bamboo_student_profile', JSON.stringify(tempUser));
        setCurrentUser(tempUser);
        setAppMode('dashboard');
    };

    // --- RENDER METHODS ---
    const renderLogin = () => (
        <div className="min-h-screen bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center p-6">
            <div className="bg-white/95 backdrop-blur-xl w-full max-w-sm rounded-3xl shadow-2xl p-8 border border-white/20">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                        {logoSrc ? <img src={logoSrc} className="w-16 h-16 object-contain"/> : <Zap size={40} className="text-green-600" />}
                    </div>
                    <h1 className="text-2xl font-black text-gray-800">Cổng Thi</h1>
                    <p className="text-gray-500 text-sm">Bamboo AI Student</p>
                </div>
                
                {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2 font-bold"><AlertCircle size={16}/> {error}</div>}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Mã định danh</label>
                        <input type="text" value={credentials.studentCode} onChange={e => setCredentials({...credentials, studentCode: e.target.value.toUpperCase()})} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-green-500 outline-none font-mono font-bold text-lg text-center" placeholder="HS..." />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Mật khẩu</label>
                        <input type="password" value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-green-500 outline-none font-mono text-lg text-center" placeholder="••••••" />
                    </div>
                    <button className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-200/50 flex items-center justify-center gap-2 text-lg transition-all active:scale-95 mt-2">
                        Đăng nhập
                    </button>
                </form>
            </div>
        </div>
    );

    const renderDashboard = () => (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header Mobile Compact */}
            <header className="bg-white px-5 py-3 shadow-sm flex justify-between items-center sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 p-0.5">
                        <img src={currentUser?.avatar} className="w-full h-full rounded-full border-2 border-white bg-white" alt="Avatar"/>
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-800 text-sm leading-tight">{currentUser?.name}</h2>
                        <p className="text-[10px] text-green-600 font-mono font-bold">{currentUser?.studentCode}</p>
                    </div>
                </div>
                <button onClick={() => setAppMode('login')} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"><LogOut size={18}/></button>
            </header>

            <main className="flex-1 p-4 md:p-6 max-w-md mx-auto w-full space-y-6">
                {/* MANUAL JOIN - HERO SECTION */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 text-center">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Search size={28} />
                    </div>
                    <h3 className="text-xl font-black text-gray-800 mb-1">Vào thi ngay</h3>
                    <p className="text-gray-500 text-xs mb-5">Nhập mã phòng thi do giáo viên cung cấp</p>
                    
                    <div className="flex flex-col gap-3">
                        <input 
                            type="text" 
                            value={manualEntryCode} 
                            onChange={e => setManualEntryCode(e.target.value)} 
                            className="w-full h-14 px-4 bg-gray-50 rounded-2xl font-mono text-center text-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500 border border-transparent focus:bg-white transition-all placeholder-gray-300 tracking-widest" 
                            placeholder="CODE" 
                            inputMode="numeric"
                        />
                        <button 
                            onClick={() => connectToExam(manualEntryCode)} 
                            disabled={!manualEntryCode || isLoading} 
                            className="w-full h-14 bg-gray-900 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : 'Tham gia'} <ArrowRight size={20}/>
                        </button>
                    </div>
                </div>

                {/* HISTORY - COMPACT LIST */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                        <History size={14}/> Lịch sử gần đây
                    </h3>
                    <div className="space-y-3 pb-8">
                        {examHistory.length === 0 ? (
                            <div className="text-center py-8 bg-white/50 rounded-2xl border border-dashed border-gray-200">
                                <p className="text-gray-400 text-sm">Chưa có lịch sử thi.</p>
                            </div>
                        ) : (
                            examHistory.slice(0, 5).map((h, i) => (
                                <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center active:scale-[0.98] transition-transform">
                                    <div>
                                        <p className="font-bold text-sm text-gray-800 line-clamp-1">{h.examTitle}</p>
                                        <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                                            <Calendar size={10}/> {new Date(h.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right pl-3 border-l border-gray-100 ml-3">
                                        <p className="text-xl font-black text-green-600 leading-none">{h.score}</p>
                                        <p className="text-[8px] uppercase text-gray-400 font-bold">Điểm</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );

    const renderExam = () => {
        // --- 1. WAITING LOBBY MODE ---
        if (gameState.status === 'waiting' || gameState.status === 'lobby') {
            return (
                 <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                     <div className="text-center max-w-sm w-full">
                         <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center mb-6 relative mx-auto">
                             {logoSrc ? <img src={logoSrc} className="w-12 h-12 object-contain" /> : <Loader2 className="animate-spin text-green-600" size={32} />}
                             <div className="absolute inset-0 border-4 border-green-100 rounded-full border-t-green-500 animate-spin"></div>
                         </div>
                         <h2 className="text-xl font-black text-gray-800 mb-2">Đang chờ giáo viên...</h2>
                         <div className="mb-6 flex flex-col items-center gap-2">
                             <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 w-full">
                                <p className="font-bold text-gray-800 text-lg">{currentUser?.name}</p>
                                {currentUser?.teamId && (
                                    <div className="inline-flex items-center gap-1 mt-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold border border-indigo-200">
                                        <Users size={12}/> Team: {currentUser.teamId}
                                    </div>
                                )}
                             </div>
                         </div>
                         <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
                             <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Đề thi</p>
                             <h3 className="font-bold text-green-700 leading-tight">{activeExam?.title}</h3>
                         </div>
                         
                         {/* Connection Status & Manual Sync Utility */}
                         <div className="mb-6 flex flex-col gap-3">
                             <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${connectionStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} mx-auto`}>
                                 {connectionStatus === 'connected' ? <Wifi size={14}/> : <WifiOff size={14}/>}
                                 {connectionStatus === 'connected' ? 'Kết nối ổn định' : 'Mất kết nối'}
                             </div>
                             <button 
                                onClick={handleManualSync}
                                className="px-6 py-3 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 flex items-center justify-center gap-2"
                             >
                                <RefreshCw size={16}/> Làm mới trạng thái
                             </button>
                         </div>

                         <button onClick={() => setAppMode('dashboard')} className="px-6 py-2 bg-gray-200 text-gray-600 rounded-full text-sm font-bold hover:bg-gray-300">Thoát phòng chờ</button>
                     </div>
                 </div>
            );
        }

        // Loading State
        if (!questions || questions.length === 0 || currentQIndex >= questions.length) {
            return (
                 <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                     <Loader2 className="animate-spin text-green-600" size={40}/>
                 </div>
            );
        }

        const currentQ = questions[currentQIndex];
        const progress = Math.round(((currentQIndex + 1) / questions.length) * 100);

        return (
            <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative overflow-hidden select-none">
                {/* HEADER EXAM - MOBILE OPTIMIZED */}
                <header className="bg-white px-4 py-3 shadow-sm flex items-center justify-between sticky top-0 z-40 safe-area-top">
                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <button onClick={() => setShowPalette(!showPalette)} className="p-2 bg-gray-100 rounded-lg text-gray-600 active:bg-gray-200"><Grid size={20}/></button>
                        
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                            <div className="h-full bg-green-500 transition-all duration-500" style={{width: `${progress}%`}}></div>
                        </div>
                        <span className="font-bold text-xs text-gray-500 whitespace-nowrap">{currentQIndex + 1}/{questions.length}</span>
                    </div>
                    
                    <div className="flex gap-2 items-center pl-2">
                        {/* Student Name & Team Display */}
                        <div className="flex flex-col items-end justify-center mr-1 leading-tight">
                             <span className="text-xs font-bold text-gray-700 hidden sm:inline-block max-w-[100px] truncate">{currentUser?.name}</span>
                             {currentUser?.teamId && (
                                 <div className="flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                     <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                     <span className="text-[9px] font-bold text-indigo-700 max-w-[60px] truncate">
                                         {currentUser.teamId}
                                     </span>
                                 </div>
                             )}
                        </div>

                        {/* Mobile User Icon Only */}
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs shrink-0 border border-green-200">
                            {currentUser?.name.charAt(0)}
                        </div>

                        <div className={`px-3 py-1.5 rounded-full font-mono font-bold flex items-center gap-1 text-sm shadow-sm border shrink-0 ${timeLeft < 300 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                            <Clock size={14} /> {formatTime(timeLeft)}
                        </div>
                    </div>
                </header>

                {/* MAIN CONTENT */}
                <main className="flex-1 overflow-y-auto p-4 pb-32 safe-area-inset-bottom">
                    {gameState.status === 'live' && currentQ && (
                        <div className="max-w-xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* QUESTION CARD */}
                            <div key={currentQ.id} className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                                <div className="p-5 md:p-8">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded uppercase">Câu {currentQIndex + 1}</span>
                                        {currentQ.points && <span className="text-[10px] font-bold text-yellow-600 flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded border border-yellow-100"><Zap size={10} fill="currentColor"/> {currentQ.points} điểm</span>}
                                    </div>
                                    
                                    <div className="text-lg md:text-xl font-medium text-gray-900 leading-relaxed mb-4 font-serif">
                                        <LatexRenderer key={`q-text-${currentQ.id}`} text={currentQ.content || ''} />
                                    </div>
                                    
                                    {currentQ.image && <img src={currentQ.image} className="w-full max-h-64 object-contain rounded-xl border border-gray-100 bg-gray-50 mb-4" />}

                                    {/* Options Area - Large Touch Targets */}
                                    <div className="space-y-3 font-sans"> 
                                        {currentQ.type === QuestionType.SHORT ? (
                                            <textarea 
                                                value={userAnswers[currentQ.id] || ''} 
                                                onChange={e => handleAnswer(currentQ.id, e.target.value, currentQ.type)} 
                                                className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-green-500 outline-none text-lg font-medium min-h-[120px] resize-none transition-colors" 
                                                placeholder="Nhập câu trả lời..." 
                                            />
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3">
                                                {currentQ.displayOptions.map((opt, i) => {
                                                    const rawAnswer = userAnswers[currentQ.id];
                                                    const isSelected = Array.isArray(rawAnswer) 
                                                        ? rawAnswer.includes(opt.originalIndex) 
                                                        : rawAnswer === opt.originalIndex;

                                                    return (
                                                        <button 
                                                            key={i}
                                                            onClick={() => handleAnswer(currentQ.id, opt.originalIndex, currentQ.type)}
                                                            className={`relative w-full text-left p-4 rounded-xl border-2 transition-all duration-150 flex items-center gap-3 active:scale-[0.98] ${
                                                                isSelected 
                                                                ? 'bg-green-600 border-green-600 text-white shadow-md' 
                                                                : 'bg-white border-gray-100 hover:border-gray-300 text-gray-700'
                                                            }`}
                                                        >
                                                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 font-bold text-sm transition-colors ${isSelected ? 'border-white bg-white text-green-600' : 'border-gray-300 text-gray-400'}`}>
                                                                {String.fromCharCode(65 + i)}
                                                            </div>
                                                            <span className="text-base font-medium flex-1 font-serif leading-snug">
                                                                <LatexRenderer key={`opt-${currentQ.id}-${i}`} text={opt.text || ''} />
                                                            </span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {gameState.status === 'finished' && (
                        <div className="h-full flex flex-col items-center justify-center animate-in zoom-in px-4">
                            <div className="w-20 h-20 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mb-6 shadow-xl">
                                <Trophy size={40} />
                            </div>
                            <h2 className="text-2xl font-black text-gray-800 mb-2">Hoàn thành!</h2>
                            <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 w-full max-w-xs text-center mb-6">
                                <p className="text-gray-500 text-[10px] font-bold uppercase mb-2">Tổng điểm</p>
                                <p className="text-5xl font-black text-green-600 mb-6">{gameState.score}</p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="bg-gray-50 p-2 rounded-xl">
                                        <span className="block font-bold text-gray-800">{questions.length}</span>
                                        <span className="text-gray-500 text-[10px]">Câu hỏi</span>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded-xl">
                                        <span className="block font-bold text-gray-800">{Object.keys(userAnswers).length}</span>
                                        <span className="text-gray-500 text-[10px]">Đã làm</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3 w-full max-w-xs">
                                {sessionConfig.allowReview && (
                                    <button onClick={() => setShowReviewModal(true)} className="w-full py-3.5 bg-white border-2 border-green-600 text-green-700 font-bold rounded-2xl active:scale-95 transition-transform">Xem lại bài làm</button>
                                )}
                                <button onClick={() => { localStorage.removeItem('bamboo_active_session'); setAppMode('dashboard'); }} className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-2xl active:scale-95 transition-transform">
                                    {exitCountdown ? `Tự động thoát (${exitCountdown}s)` : 'Về trang chủ'}
                                </button>
                            </div>
                        </div>
                    )}
                </main>

                {/* BOTTOM NAVIGATION - FIXED & SAFE AREA */}
                {gameState.status === 'live' && (
                    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-6 z-40 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <div className="max-w-xl mx-auto flex gap-3">
                            <button onClick={() => setCurrentQIndex(i => Math.max(0, i - 1))} disabled={currentQIndex === 0} className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gray-100 text-gray-600 disabled:opacity-30 active:bg-gray-200 transition-colors">
                                <ArrowLeft size={24} />
                            </button>
                            {currentQIndex < questions.length - 1 ? (
                                <button onClick={() => setCurrentQIndex(i => i + 1)} className="flex-1 h-14 bg-gray-900 text-white font-bold text-lg rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                                    Tiếp theo <ArrowRight size={20}/>
                                </button>
                            ) : (
                                <button onClick={() => setShowSubmitModal(true)} className="flex-1 h-14 bg-green-600 text-white font-bold text-lg rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                                    NỘP BÀI <Send size={20}/>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* MODALS */}
                {showPalette && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-in fade-in" onClick={() => setShowPalette(false)}>
                        <div className="bg-white rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg">Danh sách câu hỏi</h3>
                                <button onClick={() => setShowPalette(false)} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
                            </div>
                            <div className="grid grid-cols-5 gap-3 max-h-[50vh] overflow-y-auto pb-safe">
                                {questions.map((q, idx) => {
                                    const ans = userAnswers[q.id];
                                    const answered = Array.isArray(ans) ? ans.length > 0 : (ans !== undefined && ans !== null);
                                    return (
                                        <button key={idx} onClick={() => { setCurrentQIndex(idx); setShowPalette(false); }} 
                                            className={`aspect-square rounded-xl font-bold text-sm border-2 ${idx === currentQIndex ? 'border-green-600 text-green-700 bg-green-50 ring-2 ring-green-200' : answered ? 'bg-green-600 border-green-600 text-white' : 'border-gray-200 text-gray-400'}`}
                                        >
                                            {idx + 1}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {showSubmitModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                        <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center animate-in zoom-in-95 shadow-2xl">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckSquare size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Nộp bài ngay?</h3>
                            <p className="text-gray-500 mb-8 text-sm">Bạn đã làm <strong>{Object.keys(userAnswers).length}/{questions.length}</strong> câu hỏi.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-3 bg-gray-100 font-bold text-gray-600 rounded-xl active:bg-gray-200">Xem lại</button>
                                <button onClick={() => handleFinishExam()} className="flex-1 py-3 bg-green-600 font-bold text-white rounded-xl shadow-lg active:scale-95 transition-transform">Đồng ý</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Review Modal */}
                {showReviewModal && sessionConfig.allowReview && (
                    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
                        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50 safe-area-top">
                            <h3 className="font-bold text-lg">Chi tiết bài làm</h3>
                            <button onClick={() => setShowReviewModal(false)} className="p-2 bg-gray-200 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-100 space-y-4 pb-safe">
                            {questions.map((q, idx) => {
                                const isCorrect = (() => {
                                    const ans = userAnswers[q.id];
                                    if (ans === undefined || ans === null) return false;
                                    if (q.type === QuestionType.SHORT) {
                                        return checkShortAnswer(ans, q.correctAnswers);
                                    }
                                    const correct = q.correctAnswers.map(String).sort().join(',');
                                    const user = Array.isArray(ans) ? ans.map(String).sort().join(',') : String(ans);
                                    return correct === user;
                                })();
                                
                                const expanded = expandedReviewId === q.id;

                                return (
                                    <div key={q.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                        <div onClick={() => setExpandedReviewId(expanded ? null : q.id)} className="p-4 flex justify-between items-center cursor-pointer active:bg-gray-50">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{idx + 1}</div>
                                                <div className="font-serif font-medium text-gray-800 line-clamp-1 flex-1 text-sm">
                                                    <LatexRenderer text={q.content} />
                                                </div>
                                            </div>
                                            {expanded ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                                        </div>
                                        {expanded && (
                                            <div className="p-4 border-t border-gray-100 bg-gray-50 text-sm">
                                                <div className="font-serif text-base mb-4"><LatexRenderer text={q.content} /></div>
                                                {q.image && <img src={q.image} className="mb-4 rounded border max-h-40" />}
                                                <div className="space-y-2">
                                                    <div className={`p-3 rounded-xl border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                                        <span className="text-[10px] font-bold uppercase opacity-70 block mb-1">Bạn chọn</span>
                                                        <span className="font-bold">{String(userAnswers[q.id] !== undefined ? userAnswers[q.id] : '(Chưa chọn)')}</span>
                                                    </div>
                                                    {!isCorrect && (
                                                        <div className="p-3 rounded-xl border bg-white border-green-200">
                                                            <span className="text-[10px] font-bold uppercase text-green-600 block mb-1">Đáp án đúng</span>
                                                            <span className="font-bold">{q.correctAnswers.join(', ')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {q.explanation && <div className="mt-3 p-3 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 text-xs"><span className="font-bold block mb-1">Giải thích:</span><LatexRenderer text={q.explanation} /></div>}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (appMode === 'login') return renderLogin();
    if (appMode === 'dashboard') return renderDashboard();
    return renderExam();
};

export default StudentView;