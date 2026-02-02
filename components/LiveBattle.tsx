import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Play, Users, Trophy, Clock, StopCircle, ArrowRight, 
  Copy, RotateCcw, Activity, QrCode as QrIcon, AlertTriangle, Monitor,
  BookOpen, Settings, Filter, CheckCircle, Shuffle, Zap, Wand2, Save, Wifi, Calendar, Edit2, Check, X,
  PauseCircle, FileInput, MoreVertical
} from 'lucide-react';
import QRCode from 'react-qr-code';
import Peer from 'peerjs';
import { Exam, Student, ExamSession, Teacher } from '../types';

// --- ROBUST PEER CONFIGURATION FOR MOBILE ---
// MUST MATCH STUDENT SIDE CONFIG
const PEER_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    key: 'peerjs',
    debug: 1,
    config: {
        iceServers: [
            // Google STUN
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            // Additional Free STUN Servers
            { urls: 'stun:stun.ekiga.net' },
            { urls: 'stun:stun.ideasip.com' },
            { urls: 'stun:stun.schlund.de' },
            { urls: 'stun:stun.voiparound.com' },
            { urls: 'stun:stun.voipstunt.com' },
        ],
        iceCandidatePoolSize: 10,
    }
};

const TEAM_COLORS = [
    { name: 'Red', bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50', border: 'border-red-200' },
    { name: 'Blue', bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-200' },
    { name: 'Green', bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50', border: 'border-green-200' },
    { name: 'Yellow', bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50', border: 'border-yellow-200' },
    { name: 'Purple', bg: 'bg-purple-500', text: 'text-purple-600', light: 'bg-purple-50', border: 'border-purple-200' },
    { name: 'Orange', bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50', border: 'border-orange-200' },
    { name: 'Pink', bg: 'bg-pink-500', text: 'text-pink-600', light: 'bg-pink-50', border: 'border-pink-200' },
    { name: 'Teal', bg: 'bg-teal-500', text: 'text-teal-600', light: 'bg-teal-50', border: 'border-teal-200' },
];

const LiveBattle: React.FC = () => {
    // State
    const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
    const [exams, setExams] = useState<Exam[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [examHistory, setExamHistory] = useState<ExamSession[]>([]);
    
    // Setup Phase State
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [selectedGrade, setSelectedGrade] = useState<string>('12');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [examMode, setExamMode] = useState<'individual' | 'team'>('individual');
    
    // Team Settings
    const [teamCount, setTeamCount] = useState(4);
    const [teamNames, setTeamNames] = useState<string[]>([]);
    const [studentTeamMap, setStudentTeamMap] = useState<Record<string, number>>({}); // studentId -> teamIndex

    // Exam Settings
    const [shuffleQuestions, setShuffleQuestions] = useState(false);
    const [shuffleAnswers, setShuffleAnswers] = useState(false);

    // Lobby Settings
    const [customHost, setCustomHost] = useState(window.location.host);
    const [isEditingHost, setIsEditingHost] = useState(false);

    const [phase, setPhase] = useState<'setup' | 'lobby' | 'game' | 'report'>('setup');
    const [roomCode, setRoomCode] = useState<string>('');
    
    // --- HIGH PERFORMANCE DATA STRUCTURES ---
    // participantsRef holds the "Source of Truth" to prevent re-renders on every packet
    const participantsRef = useRef<Map<string, Student>>(new Map());
    
    // Whitelist Ref: Holds the studentCodes allowed to join based on Setup Phase selection
    const allowedStudentCodesRef = useRef<Set<string>>(new Set());

    // participants state is only updated via the Game Loop
    const [participants, setParticipants] = useState<Student[]>([]);
    
    const [timeLeft, setTimeLeft] = useState(0);
    const [isPaused, setIsPaused] = useState(false); 
    
    const peerRef = useRef<Peer | null>(null);
    const connectionsRef = useRef<any[]>([]);
    const timerRef = useRef<any>(null);
    const renderLoopRef = useRef<any>(null);

    // Helper to safely get array of students from map
    const getParticipantsList = (): Student[] => {
        return Array.from(participantsRef.current.values());
    };

    // Load Data
    useEffect(() => {
        const storedTeacher = localStorage.getItem('bamboo_current_teacher');
        if (storedTeacher) {
            const teacher = JSON.parse(storedTeacher);
            setCurrentTeacher(teacher);
            
            const storedExams = JSON.parse(localStorage.getItem(`bamboo_${teacher.id}_exams`) || '[]');
            setExams(storedExams);

            const storedStudents = JSON.parse(localStorage.getItem(`bamboo_${teacher.id}_students`) || '[]');
            setStudents(storedStudents);

            const storedHistory = JSON.parse(localStorage.getItem(`bamboo_${teacher.id}_exam_history`) || '[]');
            setExamHistory(storedHistory);
        }
        
        return () => {
            if (peerRef.current) peerRef.current.destroy();
            if (renderLoopRef.current) clearInterval(renderLoopRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // --- GAME LOOP RENDERING (Throttling Updates) ---
    // This is the core of the 1000+ users support. We only update React State once per second (or 500ms)
    // regardless of how many thousands of packets we receive.
    useEffect(() => {
        if (phase === 'lobby' || phase === 'game') {
            renderLoopRef.current = setInterval(() => {
                // Convert Map to Array for UI rendering
                // We optimize by checking if we really need to update (simple length check or dirty flag could be added)
                setParticipants(getParticipantsList());
            }, 1000); // 1 FPS update for UI is sufficient for Teacher View to prevent freezing
        } else {
            if (renderLoopRef.current) clearInterval(renderLoopRef.current);
        }
        return () => { if (renderLoopRef.current) clearInterval(renderLoopRef.current); };
    }, [phase]);

    // Initialize Team Names
    useEffect(() => {
        const names = Array.from({ length: teamCount }, (_, i) => `Đội ${String.fromCharCode(65 + i)}`);
        setTeamNames(names);
    }, [teamCount]);

    // Filter Logic for Setup Phase
    const classes = Array.from(new Set(students.filter(s => !selectedGrade || s.grade === selectedGrade).map(s => s.className))).sort();
    
    useEffect(() => {
        if (classes.length > 0 && !selectedClass) {
            setSelectedClass(classes[0]);
        }
    }, [classes, selectedClass]);

    const filteredStudents = students.filter(s => 
        (!selectedGrade || s.grade === selectedGrade) &&
        (!selectedClass || s.className === selectedClass)
    );

    // Auto-assign teams randomly
    const handleRandomizeTeams = () => {
        if (filteredStudents.length === 0) return;
        const shuffledStudents = [...filteredStudents].sort(() => Math.random() - 0.5);
        const newMap: Record<string, number> = {};
        
        shuffledStudents.forEach((student, index) => {
            newMap[student.id] = index % teamCount;
        });
        setStudentTeamMap(newMap);
    };

    // Timer Logic
    useEffect(() => {
        if (phase === 'game' && timeLeft > 0 && !isPaused) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    const newValue = prev - 1;
                    // Sync time periodically (every 10s to reduce traffic)
                    if (newValue % 10 === 0) {
                        broadcast({ type: 'SYNC', timeLeft: newValue, status: 'live' });
                    }
                    if (newValue <= 0) {
                         handleFinishGame();
                         return 0;
                    }
                    return newValue;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [phase, timeLeft, isPaused]);

    // --- CHUNKED BROADCASTING (Prevents Main Thread Blocking) ---
    const broadcast = useCallback((data: any) => {
        const CHUNK_SIZE = 50; // Send to 50 peers at a time
        const connections = [...connectionsRef.current]; // Snapshot
        
        const sendChunk = (startIndex: number) => {
            const chunk = connections.slice(startIndex, startIndex + CHUNK_SIZE);
            if (chunk.length === 0) return;

            chunk.forEach(conn => {
                if (conn.open) conn.send(data);
            });

            // Schedule next chunk in next frame to yield UI thread
            if (startIndex + CHUNK_SIZE < connections.length) {
                setTimeout(() => sendChunk(startIndex + CHUNK_SIZE), 10);
            }
        };

        sendChunk(0);
    }, []);

    // Force Submit for a specific student
    const handleForceSubmit = (studentId: string) => {
        if (!confirm("Bạn có chắc chắn muốn thu bài của học sinh này?")) return;

        // 1. Update local Ref
        const student = participantsRef.current.get(studentId);
        if (student) {
            const updated = { ...student, status: 'finished' as const, progress: 100 };
            participantsRef.current.set(studentId, updated);
            // Force immediate UI update for this action
            setParticipants(getParticipantsList());
        }

        // 2. Broadcast targeted message
        broadcast({ type: 'FORCE_SUBMIT', targetStudentId: studentId });
    };

    const togglePause = () => {
        const newStatus = !isPaused;
        setIsPaused(newStatus);
        broadcast({ type: 'SYNC', status: newStatus ? 'paused' : 'live' });
    };

    const updateGlobalRegistry = (code: string, active: boolean, currentParticipants: Student[]) => {
        const activeRooms = JSON.parse(localStorage.getItem('bamboo_active_rooms') || '[]');
        if (active) {
            const exam = exams.find(e => e.id === selectedExamId);
            const roomData = {
                code,
                examTitle: exam?.title,
                subject: exam?.subject,
                teacherId: currentTeacher?.id,
                timestamp: Date.now(),
                status: phase,
                playerCount: currentParticipants.length,
                allowedStudentCodes: filteredStudents.map(s => s.studentCode),
                mode: examMode,
                teamConfig: examMode === 'team' ? { teamNames, studentTeamMap } : undefined
            };
            // Upsert
            const existingIdx = activeRooms.findIndex((r: any) => r.code === code);
            if (existingIdx >= 0) activeRooms[existingIdx] = roomData;
            else activeRooms.push(roomData);
        } else {
            // Remove
            const newRooms = activeRooms.filter((r: any) => r.code !== code);
            localStorage.setItem('bamboo_active_rooms', JSON.stringify(newRooms));
            return;
        }
        localStorage.setItem('bamboo_active_rooms', JSON.stringify(activeRooms));
    };

    const createRoom = (examId: string) => {
        if (peerRef.current) peerRef.current.destroy();

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const finalExamId = examId || selectedExamId;
        setSelectedExamId(finalExamId);
        setRoomCode(code);
        setPhase('lobby');
        
        // --- 1. SET WHITELIST SNAPSHOT ---
        // Creating a Set for O(1) lookup speed during login attempts
        const allowedCodes = new Set(filteredStudents.map(s => s.studentCode || ''));
        allowedStudentCodesRef.current = allowedCodes;
        
        // Reset Data Structures
        participantsRef.current.clear();
        setParticipants([]);
        connectionsRef.current = [];

        // @ts-ignore
        const peer = new Peer(`bamboo_exam_${code}`, PEER_CONFIG);
        peerRef.current = peer;

        peer.on('open', (id) => {
            console.log('Room created:', id);
            updateGlobalRegistry(code, true, []);
        });

        peer.on('connection', (conn) => {
            conn.on('open', () => {
                connectionsRef.current.push(conn);
            });

            conn.on('data', (data: any) => {
                handleStudentData(conn, data);
            });

            conn.on('close', () => {
                connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
            });
        });

        peer.on('error', (err) => console.error(err));
    };

    const handleCreateRoom = () => {
        if (!selectedExamId) return alert("Vui lòng chọn đề thi!");
        if (filteredStudents.length === 0) return alert("Lớp học đã chọn chưa có học sinh nào!");
        createRoom(selectedExamId);
    };

    const handleStudentData = (conn: any, data: any) => {
        // NOTE: We update the Ref Map, NOT the State directly to avoid re-render flooding
        if (data.type === 'LOGIN') {
            
            // --- 2. ENFORCE WHITELIST CHECK ---
            // If valid list exists and student is NOT in it -> REJECT
            if (allowedStudentCodesRef.current.size > 0 && !allowedStudentCodesRef.current.has(data.studentCode)) {
                conn.send({
                    type: 'LOGIN_FAILED',
                    message: `Bạn không thuộc lớp ${selectedClass || selectedGrade} để tham gia phòng thi này.`
                });
                // Close connection after a short delay to ensure message is sent
                setTimeout(() => conn.close(), 500);
                return;
            }

            const studentProfile = students.find(s => s.studentCode === data.studentCode) || {
                id: data.studentCode,
                studentCode: data.studentCode,
                name: 'Học sinh mới',
                avatar: `https://ui-avatars.com/api/?name=${data.studentCode}&background=random`,
                score: 0
            };

            // Assign team if in team mode
            const assignedTeamIndex = studentTeamMap[studentProfile.id];
            const assignedTeamName = assignedTeamIndex !== undefined ? teamNames[assignedTeamIndex] : undefined;

            // Accept connection
            conn.send({
                type: 'LOGIN_SUCCESS',
                exam: exams.find(e => e.id === selectedExamId),
                student: { ...studentProfile, teamId: assignedTeamName }, // Send team info
                sessionState: { status: phase, timeLeft },
                sessionConfig: { 
                    shuffleQuestions, 
                    shuffleOptions: shuffleAnswers 
                }
            });

            const newStudentObj = { 
                ...studentProfile, 
                status: 'online', 
                score: 0, 
                progress: 0,
                teamId: assignedTeamName 
            } as Student;
            
            // Update Ref
            if (!participantsRef.current.has(newStudentObj.studentCode || '')) {
                participantsRef.current.set(newStudentObj.studentCode || '', newStudentObj);
                updateGlobalRegistry(roomCode, true, getParticipantsList());
            }

        } else if (data.type === 'UPDATE_PROGRESS') {
            const existing = participantsRef.current.get(data.studentCode);
            if (existing) {
                participantsRef.current.set(data.studentCode, { 
                    ...existing, 
                    score: data.score, 
                    progress: data.progress, 
                    status: 'in-exam' 
                });
            }
        } else if (data.type === 'SUBMIT') {
             const existing = participantsRef.current.get(data.studentCode);
             if (existing) {
                participantsRef.current.set(data.studentCode, { 
                    ...existing, 
                    score: data.score, 
                    status: 'finished', 
                    progress: 100 
                });
            }
        }
    };

    const startGame = () => {
        const exam = exams.find(e => e.id === selectedExamId);
        if (exam) {
            setTimeLeft(exam.durationMinutes * 60);
            setPhase('game');
            setIsPaused(false);
            broadcast({ type: 'START' });
            updateGlobalRegistry(roomCode, true, getParticipantsList());
        }
    };

    const handleFinishGame = () => {
        broadcast({ type: 'FINISH' });
        
        // Pull final data from Ref
        const finalParticipants = getParticipantsList();

        if (currentTeacher) {
            const exam = exams.find(e => e.id === selectedExamId);
            const newSession: ExamSession = {
                id: `session_${Date.now()}`,
                examId: selectedExamId,
                examTitle: exam?.title || 'Unknown',
                date: new Date().toISOString(),
                durationPlayed: (exam?.durationMinutes || 0) * 60 - timeLeft,
                participants: finalParticipants
            };
            const updatedHistory = [newSession, ...examHistory];
            setExamHistory(updatedHistory);
            localStorage.setItem(`bamboo_${currentTeacher.id}_exam_history`, JSON.stringify(updatedHistory));
        }

        setPhase('report');
        if (timerRef.current) clearInterval(timerRef.current);
        if (renderLoopRef.current) clearInterval(renderLoopRef.current);
        
        // Final State Update to ensure report shows correct data
        setParticipants(finalParticipants);
        
        updateGlobalRegistry(roomCode, false, []);
        if (peerRef.current) {
            setTimeout(() => peerRef.current?.destroy(), 5000);
        }
    };

    const cancelRoom = () => {
        if (peerRef.current) peerRef.current.destroy();
        updateGlobalRegistry(roomCode, false, []);
        setPhase('setup');
        setRoomCode('');
        participantsRef.current.clear();
        setParticipants([]);
    };

    // Render Helpers
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // --- TEAM CALCULATION ---
    const teamStats = useMemo(() => {
        if (examMode !== 'team') return [];
        const stats: Record<string, { name: string, score: number, members: number, finished: number }> = {};
        
        teamNames.forEach(name => {
            stats[name] = { name, score: 0, members: 0, finished: 0 };
        });

        participants.forEach(p => {
            if (p.teamId && stats[p.teamId]) {
                stats[p.teamId].score += p.score;
                stats[p.teamId].members += 1;
                if (p.status === 'finished') stats[p.teamId].finished += 1;
            }
        });

        return Object.values(stats).sort((a, b) => b.score - a.score);
    }, [participants, examMode, teamNames]);

    if (phase === 'setup') {
        return (
            <div className="h-[calc(100vh-120px)] flex flex-col items-center">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Settings className="text-green-600 animate-spin-slow" /> Thiết lập phòng thi
                </h2>
                
                <div className="w-full max-w-7xl flex-1 flex gap-6 overflow-hidden">
                    {/* Left Col: Config */}
                    <div className="w-1/3 flex flex-col gap-4 overflow-hidden">
                        {/* 1. Exam Selection */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col max-h-[40%]">
                            <div className="p-4 border-b border-gray-100 font-bold text-gray-700 flex items-center gap-2">
                                <BookOpen size={18}/> 1. Chọn đề thi
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50">
                                {exams.length === 0 ? (
                                    <div className="text-center text-gray-400 py-4 text-xs">Chưa có đề thi nào.</div>
                                ) : exams.map(exam => (
                                    <div 
                                        key={exam.id}
                                        onClick={() => setSelectedExamId(exam.id)}
                                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all bg-white relative ${selectedExamId === exam.id ? 'border-green-500 shadow-sm' : 'border-gray-100 hover:border-gray-300'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className={`font-bold text-sm line-clamp-1 ${selectedExamId === exam.id ? 'text-green-700' : 'text-gray-800'}`}>{exam.title}</h4>
                                                <p className="text-[10px] text-gray-500 mt-0.5">{exam.subject} • {exam.durationMinutes}p • {exam.questions.length} câu</p>
                                            </div>
                                            {selectedExamId === exam.id && <CheckCircle size={18} className="text-green-500" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Mode & Settings */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-100 font-bold text-gray-700 flex items-center gap-2">
                                <Settings size={18}/> 3. Chế độ thi
                            </div>
                            <div className="p-4 space-y-4 overflow-y-auto">
                                {/* Mode Tabs */}
                                <div className="flex p-1 bg-gray-100 rounded-lg">
                                    <button 
                                        onClick={() => setExamMode('individual')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${examMode === 'individual' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
                                    >
                                        <Users size={14} className="inline mr-1"/> Cá nhân
                                    </button>
                                    <button 
                                        onClick={() => setExamMode('team')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${examMode === 'team' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}
                                    >
                                        <Activity size={14} className="inline mr-1"/> Đồng đội
                                    </button>
                                </div>

                                {/* Team Config */}
                                {examMode === 'team' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase">SỐ LƯỢNG ĐỘI</label>
                                                <span className="text-sm font-bold text-gray-800">{teamCount}</span>
                                            </div>
                                            <input 
                                                type="range" min="2" max="8" 
                                                value={teamCount} 
                                                onChange={(e) => setTeamCount(parseInt(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                            />
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                            {Array.from({length: teamCount}).map((_, i) => (
                                                <div key={i} className="flex items-center gap-2 p-1.5 border border-gray-200 rounded-lg bg-white">
                                                    <div className={`w-3 h-3 rounded-full ${TEAM_COLORS[i % TEAM_COLORS.length].bg}`}></div>
                                                    <input 
                                                        type="text" 
                                                        value={teamNames[i]} 
                                                        onChange={(e) => {
                                                            const newNames = [...teamNames];
                                                            newNames[i] = e.target.value;
                                                            setTeamNames(newNames);
                                                        }}
                                                        className="w-full text-xs font-bold outline-none text-gray-700 bg-transparent"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <button 
                                            onClick={handleRandomizeTeams}
                                            className="w-full py-2 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-100 flex items-center justify-center gap-2 border border-purple-100"
                                        >
                                            <Shuffle size={14} /> Chia đội ngẫu nhiên
                                        </button>
                                    </div>
                                )}

                                {/* Settings Toggles */}
                                <div className="space-y-3 pt-2 border-t border-gray-100">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-sm font-medium text-gray-700">Trộn câu hỏi</span>
                                        <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${shuffleQuestions ? 'bg-green-500' : 'bg-gray-200'}`} onClick={() => setShuffleQuestions(!shuffleQuestions)}>
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${shuffleQuestions ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-sm font-medium text-gray-700">Trộn đáp án</span>
                                        <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${shuffleAnswers ? 'bg-green-500' : 'bg-gray-200'}`} onClick={() => setShuffleAnswers(!shuffleAnswers)}>
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${shuffleAnswers ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Student List */}
                    <div className="w-2/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                    <Users size={18}/> 2. Danh sách thí sinh & Phân đội
                                </h3>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex flex-col">
                                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">Khối lớp</label>
                                    <select 
                                        value={selectedGrade}
                                        onChange={(e) => { setSelectedGrade(e.target.value); setSelectedClass(''); }}
                                        className="p-2 border border-green-600 rounded-lg text-sm font-bold bg-green-600 text-white outline-none cursor-pointer hover:bg-green-700"
                                    >
                                        <option value="10">Khối 10</option>
                                        <option value="11">Khối 11</option>
                                        <option value="12">Khối 12</option>
                                    </select>
                                </div>
                                <div className="flex flex-col flex-1 overflow-hidden">
                                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">Lớp học</label>
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                        {classes.length > 0 ? classes.map(c => (
                                            <button 
                                                key={c}
                                                onClick={() => setSelectedClass(c)}
                                                className={`px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap border transition-all ${selectedClass === c ? 'bg-green-100 border-green-200 text-green-800' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                            >
                                                {c} {selectedClass === c && <CheckCircle size={14} className="inline ml-1"/>}
                                            </button>
                                        )) : <span className="text-sm text-gray-400 py-2 italic">Không có lớp nào</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                            <div className="grid grid-cols-2 gap-3">
                                {filteredStudents.length > 0 ? filteredStudents.map(s => {
                                    const teamIdx = studentTeamMap[s.id] ?? -1;
                                    const hasTeam = teamIdx !== -1;
                                    const color = hasTeam ? TEAM_COLORS[teamIdx % TEAM_COLORS.length] : { bg: 'bg-gray-400', text: 'text-gray-500', light: 'bg-gray-100', border: 'border-gray-200' };

                                    return (
                                        <div key={s.id} className="bg-white p-2.5 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 ${hasTeam ? color.bg : 'bg-gray-300'}`}>
                                                    {s.name.split(' ').pop()?.charAt(0)}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="font-bold text-sm text-gray-800 truncate leading-tight">{s.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono truncate">{s.studentCode} • {s.className}</p>
                                                </div>
                                            </div>
                                            
                                            {/* Team Selector on Student Card */}
                                            {examMode === 'team' && (
                                                <select 
                                                    value={teamIdx}
                                                    onChange={(e) => setStudentTeamMap(prev => ({...prev, [s.id]: parseInt(e.target.value)}))}
                                                    className={`text-[10px] font-bold py-1 pl-2 pr-1 rounded border outline-none cursor-pointer w-24 truncate ${hasTeam ? `${color.light} ${color.text} ${color.border}` : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                                                >
                                                    <option value="-1">Chọn đội</option>
                                                    {teamNames.map((name, idx) => (
                                                        <option key={idx} value={idx}>{name}</option>
                                                    ))}
                                                </select>
                                            )}
                                            {examMode === 'team' && hasTeam && (
                                                <div className={`w-2 h-2 rounded-full ${color.bg} shrink-0 ml-1`}></div>
                                            )}
                                        </div>
                                    );
                                }) : (
                                    <div className="col-span-2 text-center text-gray-400 py-10">Chưa có học sinh nào trong lớp này.</div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-white shrink-0">
                            <p className="text-sm text-gray-500">
                                Đã chọn: <strong className="text-gray-800">{selectedClass ? '1' : '0'} lớp</strong> • <strong className="text-gray-800">{filteredStudents.length} thí sinh</strong>
                            </p>
                            <button 
                                onClick={handleCreateRoom}
                                disabled={!selectedExamId}
                                className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                Tạo phòng thi <ArrowRight size={18}/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'lobby') {
        const exam = exams.find(e => e.id === selectedExamId);
        // Show ALL students in the class, not just participants
        const displayStudents = filteredStudents.length > 0 ? filteredStudents : participants; 

        return (
            <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-100px)]">
                {/* TOP HEADER */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-green-800 mb-4">Phòng chờ thi đấu</h2>
                    <div className="flex flex-col items-center">
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-green-100 inline-block mb-3">
                            <QRCode value={`${window.location.protocol}//${customHost}${window.location.pathname}#/student?room=${roomCode}`} size={140} />
                        </div>
                        <div className="px-10 py-2 bg-green-100 text-green-700 font-mono text-3xl font-bold rounded-xl tracking-widest mb-2 shadow-sm border border-green-200">
                            {roomCode}
                        </div>
                        <div className="flex items-center gap-2 text-sm font-bold text-green-600 mb-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Trạng thái: Sẵn sàng ({participants.length} online)
                        </div>
                        {isEditingHost ? (
                            <div className="flex items-center gap-2 text-xs bg-gray-100 px-3 py-1 rounded-full border border-green-300">
                                <Wifi size={12} className="text-gray-500"/>
                                <input 
                                    autoFocus
                                    type="text" 
                                    className="bg-transparent border-none outline-none text-gray-700 font-bold w-40"
                                    value={customHost} 
                                    onChange={(e) => setCustomHost(e.target.value)}
                                    onBlur={() => setIsEditingHost(false)}
                                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingHost(false)}
                                />
                                <button onClick={() => setIsEditingHost(false)}><Check size={14} className="text-green-600"/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full group cursor-pointer" onClick={() => setIsEditingHost(true)}>
                                <Wifi size={12}/> {customHost}
                                <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                        <p className="text-sm text-gray-500 mt-3">Học sinh quét mã QR hoặc truy cập <strong>Bamboo Student</strong> để tham gia.</p>
                    </div>
                </div>

                {/* MAIN SPLIT VIEW */}
                <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                    {/* LEFT COLUMN: STUDENT LIST */}
                    <div className="w-2/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                <Users size={18}/> Danh sách thí sinh ({participants.length}/{displayStudents.length})
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                            <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
                                {displayStudents.map((s, i) => {
                                    const participant = participants.find(p => p.studentCode === s.studentCode);
                                    const isJoined = !!participant;
                                    const p = participant || s; // Use participant data if joined, else student data

                                    // Team logic
                                    const teamIdx = studentTeamMap[s.id] ?? -1;
                                    let teamColor = { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' };
                                    
                                    if (teamIdx !== -1) {
                                        const baseColor = TEAM_COLORS[teamIdx % TEAM_COLORS.length];
                                        teamColor = {
                                            bg: isJoined ? baseColor.light : 'bg-gray-50',
                                            text: isJoined ? baseColor.text : 'text-gray-400',
                                            border: isJoined ? baseColor.border : 'border-gray-200'
                                        };
                                    }

                                    return (
                                        <div key={i} className={`bg-white p-2 rounded-xl border flex items-center gap-3 shadow-sm transition-all ${isJoined ? 'opacity-100 border-green-200 ring-1 ring-green-100' : 'opacity-50 grayscale border-dashed border-gray-300'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 ${isJoined ? (teamIdx !== -1 ? TEAM_COLORS[teamIdx % TEAM_COLORS.length].bg : 'bg-green-500') : 'bg-gray-300'}`}>
                                                {p.name.split(' ').pop()?.charAt(0)}
                                            </div>
                                            <div className="overflow-hidden min-w-0">
                                                <p className={`font-bold text-sm truncate ${isJoined ? 'text-gray-800' : 'text-gray-400'}`}>{p.name}</p>
                                                <div className="flex gap-1 items-center">
                                                    <span className="text-[10px] text-gray-400 font-mono truncate">{p.studentCode}</span>
                                                    {teamIdx !== -1 && (
                                                        <>
                                                            <span className="text-[8px] text-gray-300">•</span>
                                                            <span className={`text-[10px] font-bold truncate ${teamColor.text}`}>
                                                                {teamNames[teamIdx]}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {displayStudents.length === 0 && (
                                    <div className="col-span-4 text-center py-12 text-gray-400">Chưa có danh sách lớp...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: EXAM INFO & ACTIONS */}
                    <div className="w-1/3 flex flex-col gap-4">
                        {/* Exam Card */}
                        <div className="bg-[#1a4731] text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-xs font-bold text-green-200 uppercase mb-2">Đề thi được chọn</p>
                                <h3 className="text-2xl font-bold mb-4 leading-tight">{exam?.title}</h3>
                                <div className="space-y-2 text-sm text-green-100">
                                    <div className="flex items-center gap-2">
                                        <Clock size={16}/> {exam?.durationMinutes} phút
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <BookOpen size={16}/> {exam?.questions.length} câu
                                    </div>
                                </div>
                                <div className="mt-4 inline-block bg-white/10 px-3 py-1 rounded-lg text-xs font-bold border border-white/20">
                                    Chế độ: {examMode === 'team' ? `Đồng đội (${teamCount} đội)` : 'Cá nhân'}
                                </div>
                            </div>
                            {/* Decor */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <button 
                                onClick={startGame} 
                                disabled={participants.length === 0}
                                className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200/50 flex items-center justify-center gap-2 text-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Play size={24} fill="currentColor" /> Bắt đầu ngay
                            </button>
                            <button 
                                onClick={cancelRoom}
                                className="w-full py-4 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Hủy bỏ
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'game') {
        const exam = exams.find(e => e.id === selectedExamId);
        return (
            <div className="max-w-[1920px] mx-auto flex flex-col h-[calc(100vh-100px)] gap-4">
                {/* 1. HEADER - UPDATED DESIGN */}
                <div className="bg-[#1a4731] text-white p-4 rounded-xl shadow-lg flex justify-between items-center shrink-0">
                    <div className="flex gap-8 items-center">
                        <div className="border-r border-green-700 pr-8">
                            <p className="text-[10px] text-green-300 font-bold uppercase mb-0.5">MÃ PHÒNG</p>
                            <div className="font-mono font-black text-2xl tracking-widest leading-none">{roomCode}</div>
                        </div>
                        <div>
                            <p className="text-[10px] text-green-300 font-bold uppercase mb-0.5"><BookOpen size={10} className="inline mr-1"/>Đề thi</p>
                            <div className="font-bold text-lg leading-none">{exam?.title}</div>
                        </div>
                        <div>
                            <p className="text-[10px] text-green-300 font-bold uppercase mb-0.5"><Clock size={10} className="inline mr-1"/>Thời gian</p>
                            <div className={`font-mono font-bold text-2xl leading-none ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                                {formatTime(timeLeft)}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-800/50 rounded-lg border border-green-700/50 text-xs font-bold text-green-100">
                            <Wifi size={14} className="text-green-400 animate-pulse"/> Máy chủ Online
                        </div>
                        <button 
                            onClick={togglePause}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-md ${isPaused ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
                        >
                            {isPaused ? <Play size={16} fill="currentColor"/> : <PauseCircle size={16} fill="currentColor"/>}
                            {isPaused ? 'Tiếp tục' : 'Tạm dừng'}
                        </button>
                        <button 
                            onClick={handleFinishGame}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg font-bold text-sm hover:bg-red-600 hover:text-white border border-white/20 transition-all shadow-md"
                        >
                            <StopCircle size={16}/> Kết thúc
                        </button>
                    </div>
                </div>

                {/* 2. MAIN CONTENT - SPLIT LAYOUT */}
                <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
                    
                    {/* LEFT: LEADERBOARD (DYNAMIC: INDIVIDUAL OR TEAM) */}
                    <div className="w-1/4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                            <Trophy size={18} className="text-yellow-500" />
                            <h3 className="font-bold text-gray-700">Bảng xếp hạng</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50">
                            {examMode === 'individual' ? (
                                // INDIVIDUAL LEADERBOARD
                                participants.sort((a,b) => b.score - a.score).map((p, index) => (
                                    <div key={p.id} className="bg-white p-3 rounded-lg border border-gray-100 flex items-center gap-3 shadow-sm">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-200 text-gray-600'}`}>
                                            {index + 1}
                                        </div>
                                        <img src={p.avatar} className="w-8 h-8 rounded-full border border-gray-100" />
                                        <div className="overflow-hidden min-w-0 flex-1">
                                            <p className="font-bold text-sm text-gray-800 truncate">{p.name}</p>
                                            <p className="text-[10px] text-green-600 italic">
                                                {p.status === 'finished' ? 'Đã nộp bài' : 'Đang làm bài...'}
                                            </p>
                                        </div>
                                        <div className="font-bold text-green-600 text-sm">{p.score}</div>
                                    </div>
                                ))
                            ) : (
                                // TEAM LEADERBOARD
                                teamStats.map((team, index) => (
                                    <div key={team.name} className="bg-white p-3 rounded-lg border border-gray-100 flex items-center gap-3 shadow-sm">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-200 text-gray-600'}`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-sm text-gray-800">{team.name}</span>
                                                <span className="font-black text-green-600">{team.score}</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-green-500" style={{ width: `${(team.finished / (team.members || 1)) * 100}%` }}></div>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">{team.finished}/{team.members} thành viên đã xong</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* RIGHT: REAL-TIME PROGRESS */}
                    <div className="w-3/4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-gray-700 uppercase text-sm tracking-wider">REAL-TIME PROGRESS ({participants.length})</h3>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span> Online
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
                            <div className="space-y-3">
                                {participants.map((p) => {
                                    const teamIdx = studentTeamMap[p.id];
                                    const teamColor = teamIdx !== undefined ? TEAM_COLORS[teamIdx % TEAM_COLORS.length] : null;

                                    return (
                                        <div key={p.id} className="relative group">
                                            {/* Row Layout */}
                                            <div className="flex items-center gap-4 mb-1">
                                                <div className="w-8 font-mono text-xs font-bold text-gray-400 shrink-0 text-right">{p.studentCode.split('').slice(-2).join('')}</div>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 border-2 border-white shadow-sm ${teamColor ? teamColor.bg : 'bg-gray-400'}`}>
                                                    {p.name.charAt(0)}
                                                </div>
                                                <div className="w-40 truncate font-bold text-sm text-gray-700">{p.name}</div>
                                                
                                                {/* Progress Bar Container */}
                                                <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden relative">
                                                    <div 
                                                        className={`h-full transition-all duration-700 ease-out ${p.status === 'finished' ? 'bg-green-600' : 'bg-green-400'}`} 
                                                        style={{ width: `${p.progress}%` }}
                                                    ></div>
                                                </div>
                                                
                                                <div className="w-8 text-xs font-bold text-gray-400 text-right">{p.progress}%</div>

                                                {/* Force Submit Button */}
                                                <button 
                                                    onClick={() => handleForceSubmit(p.id)}
                                                    disabled={p.status === 'finished'}
                                                    className={`p-1.5 rounded-lg transition-colors ${p.status === 'finished' ? 'text-green-500 bg-green-50 cursor-default' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                                                    title={p.status === 'finished' ? 'Đã nộp bài' : 'Thu bài ngay'}
                                                >
                                                    {p.status === 'finished' ? <CheckCircle size={18} /> : <FileInput size={18} />}
                                                </button>
                                            </div>
                                            
                                            {/* Thin separator */}
                                            <div className="h-px bg-gray-100 w-full ml-12"></div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Report Phase
    return (
        <div className="max-w-4xl mx-auto text-center space-y-8 py-10">
            <div className="space-y-2">
                <Trophy size={64} className="text-yellow-500 mx-auto animate-bounce" />
                <h2 className="text-4xl font-black text-gray-800">Kết thúc bài thi!</h2>
                <p className="text-gray-500">Dữ liệu đã được lưu vào lịch sử.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {participants.length > 1 && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 order-2 md:order-1 transform translate-y-4">
                        <div className="w-16 h-16 rounded-full border-4 border-gray-300 mx-auto mb-4 overflow-hidden">
                            <img src={participants[1].avatar} className="w-full h-full object-cover" />
                        </div>
                        <h3 className="font-bold text-gray-700 truncate">{participants[1].name}</h3>
                        <p className="text-2xl font-black text-gray-400">{participants[1].score}</p>
                        <span className="inline-block mt-2 px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">Hạng 2</span>
                    </div>
                )}
                
                {participants.length > 0 && (
                    <div className="bg-white p-8 rounded-3xl shadow-lg border-2 border-yellow-400 order-1 md:order-2 z-10">
                        <div className="w-24 h-24 rounded-full border-4 border-yellow-400 mx-auto mb-4 overflow-hidden shadow-lg relative">
                            <img src={participants[0].avatar} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 ring-4 ring-yellow-400 rounded-full"></div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 truncate">{participants[0].name}</h3>
                        <p className="text-4xl font-black text-yellow-500">{participants[0].score}</p>
                        <span className="inline-block mt-2 px-4 py-1 bg-yellow-400 text-white rounded-full text-sm font-bold shadow-md">Vô địch</span>
                    </div>
                )}

                {participants.length > 2 && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 order-3 transform translate-y-8">
                        <div className="w-16 h-16 rounded-full border-4 border-orange-200 mx-auto mb-4 overflow-hidden">
                            <img src={participants[2].avatar} className="w-full h-full object-cover" />
                        </div>
                        <h3 className="font-bold text-gray-700 truncate">{participants[2].name}</h3>
                        <p className="text-2xl font-black text-orange-600">{participants[2].score}</p>
                        <span className="inline-block mt-2 px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">Hạng 3</span>
                    </div>
                )}
            </div>

            <div className="flex justify-center gap-4 mt-8">
                <button onClick={() => setPhase('setup')} className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 flex items-center gap-2">
                    <RotateCcw size={18} /> Quay về trang chủ
                </button>
            </div>
        </div>
    );
};

export default LiveBattle;