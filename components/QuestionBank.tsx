import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Folder, FolderPlus, Trash2, Plus, FileText, Search, 
    MoreVertical, Microscope, Upload, X, Loader2, CheckSquare, List, Type, Check, Wand2, Image as ImageIcon, Save, Edit3, ArrowLeft, ChevronLeft, ChevronRight, Square, FolderInput, ArrowRight, FileSpreadsheet, Download, Calculator, Zap, Eye, PieChart as PieChartIcon, BarChart3
} from 'lucide-react';
import { Question, Teacher, QuestionType, Difficulty } from '../types';
import { parseQuestionsFromDocument } from '../services/geminiService';
// @ts-ignore
import { extractRawText } from 'mammoth';
import * as XLSX from 'xlsx';
import LatexRenderer from './LatexRenderer';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend, CartesianGrid 
} from 'recharts';

interface QuestionFolder {
    id: string;
    name: string;
    createdAt: string;
}

interface QuestionBankItem extends Question {
    folderId: string;
    createdAt: string;
}

// --- UTILS: DEBOUNCE HOOK ---
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
        return () => { clearTimeout(handler); };
    }, [value, delay]);
    return debouncedValue;
}

const QuestionBank: React.FC = () => {
    const [folders, setFolders] = useState<QuestionFolder[]>([]);
    const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');
    const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
    
    // UI State
    const [isAddingFolder, setIsAddingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300); // Wait 300ms before searching
    const [showStats, setShowStats] = useState(false); // Toggle Stats Panel

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Bulk & Move Action State
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [targetFolderId, setTargetFolderId] = useState('');
    const [movingQuestion, setMovingQuestion] = useState<QuestionBankItem | null>(null); // Track single question move

    // SCORE MANAGEMENT STATE
    const [showScoreModal, setShowScoreModal] = useState(false);
    const [scoreConfig, setScoreConfig] = useState({ totalScore: 10 });
    const [tempScores, setTempScores] = useState<Record<string, number>>({});

    // Editing State (For existing questions)
    const [editingQuestion, setEditingQuestion] = useState<QuestionBankItem | null>(null);

    // Import State
    const [importStep, setImportStep] = useState<'upload' | 'review'>('upload');
    const [importMethod, setImportMethod] = useState<'ai' | 'excel'>('ai'); // Switch between AI and Excel
    const [isImporting, setIsImporting] = useState(false);
    const [uploadText, setUploadText] = useState('');
    const [uploadFile, setUploadFile] = useState<{ name: string; type: string; data: string } | null>(null);
    const [previewQuestions, setPreviewQuestions] = useState<QuestionBankItem[]>([]);
    
    const excelInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const storedTeacher = localStorage.getItem('bamboo_current_teacher');
        if (storedTeacher) {
            const teacher = JSON.parse(storedTeacher);
            setCurrentTeacher(teacher);
            loadData(teacher.id);
        }
    }, []);

    const loadData = (teacherId: string) => {
        const storedFolders = localStorage.getItem(`bamboo_${teacherId}_folders`);
        const storedQuestions = localStorage.getItem(`bamboo_${teacherId}_question_bank`);
        
        let loadedFolders: QuestionFolder[] = [];
        if (storedFolders) {
            try { loadedFolders = JSON.parse(storedFolders); } catch(e) {}
        }
        
        // Ensure "General" folder exists
        if (loadedFolders.length === 0) {
            const general: QuestionFolder = { id: 'general', name: 'Chung', createdAt: new Date().toISOString() };
            loadedFolders = [general];
            localStorage.setItem(`bamboo_${teacherId}_folders`, JSON.stringify(loadedFolders));
        }

        setFolders(loadedFolders);
        if (loadedFolders.length > 0 && !selectedFolderId) {
            setSelectedFolderId(loadedFolders[0].id);
        }

        if (storedQuestions) {
            try { setQuestions(JSON.parse(storedQuestions)); } catch(e) {}
        }
    };

    const saveData = (newFolders: QuestionFolder[], newQuestions: QuestionBankItem[]) => {
        if (!currentTeacher) return;
        setFolders(newFolders);
        setQuestions(newQuestions);
        localStorage.setItem(`bamboo_${currentTeacher.id}_folders`, JSON.stringify(newFolders));
        localStorage.setItem(`bamboo_${currentTeacher.id}_question_bank`, JSON.stringify(newQuestions));
    };

    // --- FOLDER OPERATIONS ---
    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;
        const newFolder: QuestionFolder = {
            id: `folder_${Date.now()}`,
            name: newFolderName,
            createdAt: new Date().toISOString()
        };
        const updatedFolders = [...folders, newFolder];
        saveData(updatedFolders, questions);
        setNewFolderName('');
        setIsAddingFolder(false);
        setSelectedFolderId(newFolder.id);
    };

    const handleDeleteFolder = (id: string) => {
        if (id === 'general') return alert("Không thể xóa thư mục mặc định.");
        if (confirm("Bạn có chắc chắn xóa thư mục này? Tất cả câu hỏi trong thư mục sẽ bị xóa.")) {
            const updatedFolders = folders.filter(f => f.id !== id);
            const updatedQuestions = questions.filter(q => q.folderId !== id);
            saveData(updatedFolders, updatedQuestions);
            setSelectedFolderId('general');
        }
    };

    // --- QUESTION OPERATIONS ---
    const handleDeleteQuestion = (id: string) => {
        if (confirm("Xóa câu hỏi này?")) {
            const updatedQuestions = questions.filter(q => q.id !== id);
            saveData(folders, updatedQuestions);
            setSelectedQuestionIds(prev => prev.filter(qid => qid !== id));
        }
    };

    const handleBulkDelete = () => {
        if (confirm(`Bạn có chắc chắn muốn xóa ${selectedQuestionIds.length} câu hỏi đã chọn?`)) {
            const updatedQuestions = questions.filter(q => !selectedQuestionIds.includes(q.id));
            saveData(folders, updatedQuestions);
            setSelectedQuestionIds([]);
        }
    };

    // --- SCORE MANAGEMENT LOGIC ---
    const handleOpenScoreModal = () => {
        const initScores: Record<string, number> = {};
        selectedQuestionIds.forEach(id => {
            const q = questions.find(q => q.id === id);
            if (q) initScores[id] = q.points || 0;
        });
        setTempScores(initScores);
        setShowScoreModal(true);
    };

    const handleDistributeScore = () => {
        const count = selectedQuestionIds.length;
        if (count === 0) return;
        const scorePerQ = parseFloat((scoreConfig.totalScore / count).toFixed(2));
        
        const newScores: Record<string, number> = {};
        selectedQuestionIds.forEach(id => {
            newScores[id] = scorePerQ;
        });
        setTempScores(newScores);
    };

    const handleSaveScores = () => {
        const updatedQuestions = questions.map(q => {
            if (selectedQuestionIds.includes(q.id) && tempScores[q.id] !== undefined) {
                return { ...q, points: tempScores[q.id] };
            }
            return q;
        });
        saveData(folders, updatedQuestions);
        setShowScoreModal(false);
        alert("Đã cập nhật điểm số thành công!");
    };

    // Trigger single move
    const handleMoveSingle = (q: QuestionBankItem) => {
        setMovingQuestion(q);
        setShowMoveModal(true);
    };

    const handleConfirmMove = () => {
        if (!targetFolderId) return alert("Vui lòng chọn thư mục đích");
        
        let updatedQuestions = [...questions];

        if (movingQuestion) {
            // Move single question
            updatedQuestions = updatedQuestions.map(q => 
                q.id === movingQuestion.id ? { ...q, folderId: targetFolderId } : q
            );
        } else {
            // Bulk move
            updatedQuestions = updatedQuestions.map(q => 
                selectedQuestionIds.includes(q.id) ? { ...q, folderId: targetFolderId } : q
            );
            setSelectedQuestionIds([]);
        }

        saveData(folders, updatedQuestions);
        setShowMoveModal(false);
        setMovingQuestion(null);
        setTargetFolderId('');
        alert("Đã di chuyển thành công!");
    };

    const handleSaveEditedQuestion = () => {
        if (!editingQuestion) return;
        const updatedQuestions = questions.map(q => q.id === editingQuestion.id ? editingQuestion : q);
        saveData(folders, updatedQuestions);
        setEditingQuestion(null);
    };

    // --- STATISTICS DATA ---
    const statsData = useMemo(() => {
        const folderQuestions = questions.filter(q => q.folderId === selectedFolderId);
        
        // 1. Difficulty Stats
        const diffCounts = {
            [Difficulty.EASY]: 0,
            [Difficulty.MEDIUM]: 0,
            [Difficulty.HARD]: 0,
            [Difficulty.EXPERT]: 0
        };
        // 2. Type Stats
        const typeCounts = {
            [QuestionType.SINGLE]: 0,
            [QuestionType.MULTIPLE]: 0,
            [QuestionType.TRUE_FALSE]: 0,
            [QuestionType.SHORT]: 0
        };

        folderQuestions.forEach(q => {
            if (diffCounts[q.difficulty] !== undefined) diffCounts[q.difficulty]++;
            else diffCounts[Difficulty.MEDIUM]++; // Fallback

            if (typeCounts[q.type] !== undefined) typeCounts[q.type]++;
            else typeCounts[QuestionType.SINGLE]++; // Fallback
        });

        const difficultyData = [
            { name: 'Nhận biết', short: 'NB', value: diffCounts[Difficulty.EASY], fill: '#4ade80' },
            { name: 'Thông hiểu', short: 'TH', value: diffCounts[Difficulty.MEDIUM], fill: '#60a5fa' },
            { name: 'Vận dụng', short: 'VD', value: diffCounts[Difficulty.HARD], fill: '#facc15' },
            { name: 'Vận dụng cao', short: 'VDC', value: diffCounts[Difficulty.EXPERT], fill: '#f87171' },
        ];

        const typeData = [
            { name: '1 Đáp án', value: typeCounts[QuestionType.SINGLE] },
            { name: 'Nhiều ĐA', value: typeCounts[QuestionType.MULTIPLE] },
            { name: 'Đúng/Sai', value: typeCounts[QuestionType.TRUE_FALSE] },
            { name: 'Điền từ', value: typeCounts[QuestionType.SHORT] },
        ];

        return { difficultyData, typeData, total: folderQuestions.length };
    }, [questions, selectedFolderId]);

    const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    // --- IMPORT LOGIC ---
    // ... (Keep existing import logic) ...
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadFile(null); setUploadText('');

        if (file.type.includes("word") || file.name.endsWith(".docx")) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const res = await extractRawText({ arrayBuffer: event.target?.result as ArrayBuffer });
                    if (res.value.trim()) { setUploadText(res.value); }
                } catch (err) { alert("Lỗi đọc file Word."); }
            };
            reader.readAsArrayBuffer(file);
        } else if (file.type === "application/pdf" || file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onloadend = () => setUploadFile({ name: file.name, type: file.type, data: (reader.result as string).split(',')[1] });
            reader.readAsDataURL(file);
        } else if (file.type === "text/plain") {
             const reader = new FileReader();
             reader.onload = (event) => { setUploadText(event.target?.result as string); };
             reader.readAsText(file);
        }
    };

    const downloadExcelTemplate = () => {
        const headers = [
            "Nội dung câu hỏi",
            "Loại câu hỏi (SINGLE/MULTIPLE/TRUE_FALSE/SHORT)",
            "Độ khó (EASY/MEDIUM/HARD/EXPERT)",
            "Điểm số",
            "Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D",
            "Đáp án đúng (Nhập ký tự A,B,C,D hoặc Nội dung trả lời ngắn)",
            "Giải thích"
        ];
        const sampleData = [
            {
                "Nội dung câu hỏi": "Công thức tính diện tích hình tròn bán kính R là?",
                "Loại câu hỏi (SINGLE/MULTIPLE/TRUE_FALSE/SHORT)": "SINGLE",
                "Độ khó (EASY/MEDIUM/HARD/EXPERT)": "EASY",
                "Điểm số": 1,
                "Đáp án A": "2πR", "Đáp án B": "πR²", "Đáp án C": "π²R", "Đáp án D": "4πR²",
                "Đáp án đúng (Nhập ký tự A,B,C,D hoặc Nội dung trả lời ngắn)": "B",
                "Giải thích": "Diện tích hình tròn là pi nhân bình phương bán kính."
            }
        ];

        const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
        ws['!cols'] = [{wch: 50}, {wch: 20}, {wch: 15}, {wch: 10}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 30}];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Mau_Cau_Hoi");
        XLSX.writeFile(wb, "Bamboo_Mau_Nhap_Cau_Hoi.xlsx");
    };

    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            if (data.length === 0) return alert("File Excel trống hoặc không đúng định dạng!");

            const parsedQuestions: QuestionBankItem[] = data.map((row: any, index) => {
                const content = row["Nội dung câu hỏi"] || `Câu hỏi ${index + 1}`;
                let typeStr = (row["Loại câu hỏi (SINGLE/MULTIPLE/TRUE_FALSE/SHORT)"] || "SINGLE").toUpperCase().trim();
                let diffStr = (row["Độ khó (EASY/MEDIUM/HARD/EXPERT)"] || "MEDIUM").toUpperCase().trim();
                const explanation = row["Giải thích"] || "";
                const points = parseFloat(row["Điểm số"]) || 0;
                
                // Map Type
                let type = QuestionType.SINGLE;
                if (typeStr.includes("MULTIPLE")) type = QuestionType.MULTIPLE;
                else if (typeStr.includes("TRUE") || typeStr.includes("FALSE")) type = QuestionType.TRUE_FALSE;
                else if (typeStr.includes("SHORT")) type = QuestionType.SHORT;

                // Map Difficulty
                let difficulty = Difficulty.MEDIUM;
                if (diffStr.includes("EASY")) difficulty = Difficulty.EASY;
                else if (diffStr.includes("HARD")) difficulty = Difficulty.HARD;
                else if (diffStr.includes("EXPERT")) difficulty = Difficulty.EXPERT;

                // Map Options
                const options = [
                    String(row["Đáp án A"] || ""),
                    String(row["Đáp án B"] || ""),
                    String(row["Đáp án C"] || ""),
                    String(row["Đáp án D"] || "")
                ].filter(o => o.trim() !== "");

                // Map Correct Answers
                let correctAnswers: string[] = [];
                const rawCorrect = String(row["Đáp án đúng (Nhập ký tự A,B,C,D hoặc Nội dung trả lời ngắn)"] || "").trim();

                if (type === QuestionType.SHORT) {
                    correctAnswers = [rawCorrect];
                } else {
                    const parts = rawCorrect.toUpperCase().split(/[,;\s]+/).filter(s => s.length > 0);
                    correctAnswers = parts.map(p => {
                        if (p === 'A') return "0";
                        if (p === 'B') return "1";
                        if (p === 'C') return "2";
                        if (p === 'D') return "3";
                        return "";
                    }).filter(s => s !== "");
                }

                return {
                    id: `excel_${Date.now()}_${index}`,
                    folderId: selectedFolderId,
                    content,
                    type,
                    difficulty,
                    options: type === QuestionType.TRUE_FALSE ? ["Đúng", "Sai"] : options,
                    correctAnswers,
                    explanation,
                    points,
                    tags: ['Excel Import'],
                    createdAt: new Date().toISOString()
                };
            });

            setPreviewQuestions(parsedQuestions);
            setImportStep('review');
            if (excelInputRef.current) excelInputRef.current.value = '';
        };
        reader.readAsBinaryString(file);
    };

    const handleRunAIImport = async () => {
        if (!uploadFile && !uploadText) return alert("Vui lòng tải lên file đề hoặc văn bản!");
        if (!selectedFolderId) return alert("Vui lòng chọn thư mục lưu trữ!");
        
        setIsImporting(true);
        const safeBtoa = (str: string) => {
            try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { return ""; }
        };

        const parsedQuestions = await parseQuestionsFromDocument(
            uploadFile 
              ? { mimeType: uploadFile.type, data: uploadFile.data } 
              : { mimeType: 'text/plain', data: safeBtoa(uploadText) },
            uploadText
        );

        if (parsedQuestions.length === 0) {
            alert("Không thể đọc câu hỏi. Vui lòng kiểm tra API Key hoặc định dạng file.");
            setIsImporting(false);
        } else {
            const bankItems: QuestionBankItem[] = parsedQuestions.map(q => ({
                ...q,
                folderId: selectedFolderId,
                createdAt: new Date().toISOString()
            }));
            
            setPreviewQuestions(bankItems);
            setImportStep('review');
            setIsImporting(false);
        }
    };

    const updateQuestionField = (source: 'preview' | 'editing', qIndex: number, field: keyof QuestionBankItem, value: any) => {
        if (source === 'preview') {
            const updated = [...previewQuestions];
            updated[qIndex] = { ...updated[qIndex], [field]: value };
            setPreviewQuestions(updated);
        } else {
            if (editingQuestion) setEditingQuestion({ ...editingQuestion, [field]: value });
        }
    };

    const updateOption = (source: 'preview' | 'editing', qIndex: number, optIndex: number, value: string) => {
        if (source === 'preview') {
            const updated = [...previewQuestions];
            const newOptions = [...updated[qIndex].options];
            newOptions[optIndex] = value;
            updated[qIndex].options = newOptions;
            setPreviewQuestions(updated);
        } else {
            if (editingQuestion) {
                const newOptions = [...editingQuestion.options];
                newOptions[optIndex] = value;
                setEditingQuestion({ ...editingQuestion, options: newOptions });
            }
        }
    };

    const handleImageUploadToQuestion = (source: 'preview' | 'editing', qIndex: number, e: React.ChangeEvent<HTMLInputElement>, isOption: boolean = false, optIndex: number = -1) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                if (source === 'preview') {
                    const updated = [...previewQuestions];
                    if (isOption && optIndex >= 0) {
                        updated[qIndex].options[optIndex] = `${updated[qIndex].options[optIndex].trim()} \n![img](${base64})`;
                    } else {
                        updated[qIndex].image = base64;
                    }
                    setPreviewQuestions(updated);
                } else {
                    if (editingQuestion) {
                        const updated = { ...editingQuestion };
                        if (isOption && optIndex >= 0) {
                            updated.options[optIndex] = `${updated.options[optIndex].trim()} \n![img](${base64})`;
                        } else {
                            updated.image = base64;
                        }
                        setEditingQuestion(updated);
                    }
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFinalizeImport = () => {
        const updatedQuestions = [...questions, ...previewQuestions];
        saveData(folders, updatedQuestions);
        alert(`Đã lưu ${previewQuestions.length} câu hỏi vào thư mục!`);
        setShowImportModal(false);
        setImportStep('upload');
        setUploadFile(null);
        setUploadText('');
        setPreviewQuestions([]);
    };

    // --- FILTERING & PAGINATION ---
    const filteredQuestions = useMemo(() => {
        return questions.filter(q => 
            q.folderId === selectedFolderId && 
            q.content.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );
    }, [questions, selectedFolderId, debouncedSearchTerm]);

    const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
    const paginatedQuestions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredQuestions.slice(start, start + itemsPerPage);
    }, [filteredQuestions, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [selectedFolderId, debouncedSearchTerm]);

    const selectedFolder = folders.find(f => f.id === selectedFolderId);

    const renderQuestionEditor = (q: QuestionBankItem, idx: number, source: 'preview' | 'editing') => (
        <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
            <div className="absolute top-2 right-2 text-xs font-bold text-gray-300">#{idx + 1}</div>
            
            <div className="mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nội dung câu hỏi</label>
                <div className="flex gap-2 items-start">
                    <textarea 
                        className="flex-1 w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-green-500 outline-none h-24 font-mono"
                        value={q.content}
                        onChange={e => updateQuestionField(source, idx, 'content', e.target.value)}
                        placeholder="Nhập nội dung câu hỏi (Hỗ trợ LaTeX: $...$)"
                    />
                    <label className="p-2 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer flex flex-col items-center justify-center w-24 h-24 shrink-0 text-gray-400 hover:text-green-600 transition-colors">
                        {q.image ? (
                            <img src={q.image} className="w-full h-full object-contain" />
                        ) : (
                            <>
                                <ImageIcon size={20} />
                                <span className="text-[10px] mt-1 text-center">Thêm ảnh</span>
                            </>
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUploadToQuestion(source, idx, e)} />
                    </label>
                </div>
            </div>

            <div className="mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Điểm số</label>
                <input 
                    type="number" step="0.1"
                    className="w-24 p-2 border border-gray-200 rounded-lg text-sm focus:border-green-500 outline-none"
                    value={q.points || 0}
                    onChange={e => updateQuestionField(source, idx, 'points', parseFloat(e.target.value) || 0)}
                />
            </div>

            {q.type !== QuestionType.SHORT && (
                <div className="mb-4">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Lựa chọn đáp án</label>
                    <div className="space-y-2">
                        {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex gap-2 items-center">
                                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border cursor-pointer ${q.correctAnswers.includes(String(optIdx)) ? 'bg-green-600 text-white border-green-600' : 'bg-white border-gray-300 text-gray-500'}`}
                                    onClick={() => {
                                        let newCorrect = [...q.correctAnswers];
                                        const val = String(optIdx);
                                        if (q.type === QuestionType.SINGLE || q.type === QuestionType.TRUE_FALSE) {
                                            newCorrect = [val];
                                        } else {
                                            if (newCorrect.includes(val)) newCorrect = newCorrect.filter(c => c !== val);
                                            else newCorrect.push(val);
                                        }
                                        updateQuestionField(source, idx, 'correctAnswers', newCorrect);
                                    }}
                                >
                                    {String.fromCharCode(65 + optIdx)}
                                </span>
                                <div className="flex-1 relative">
                                    <input 
                                        type="text" 
                                        className="w-full p-2 pr-8 border border-gray-200 rounded-lg text-sm focus:border-green-500 outline-none font-mono"
                                        value={opt}
                                        onChange={(e) => updateOption(source, idx, optIdx, e.target.value)}
                                        placeholder={`Lựa chọn ${String.fromCharCode(65 + optIdx)}`}
                                    />
                                    <label className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600 cursor-pointer p-1">
                                        <ImageIcon size={14} />
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUploadToQuestion(source, idx, e, true, optIdx)} />
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Giải thích</label>
                <textarea 
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-green-500 outline-none h-16 font-mono"
                    value={q.explanation}
                    onChange={e => updateQuestionField(source, idx, 'explanation', e.target.value)}
                    placeholder="Giải thích đáp án (tùy chọn)"
                />
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6">
            
            {/* LEFT SIDEBAR: FOLDERS */}
            <div className="w-full md:w-64 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden shrink-0">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700">Thư mục</h3>
                    <button onClick={() => setIsAddingFolder(true)} className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                        <FolderPlus size={18} />
                    </button>
                </div>
                
                {isAddingFolder && (
                    <div className="p-2 border-b border-gray-100 bg-green-50 animate-in slide-in-from-top-2">
                        <input 
                            autoFocus
                            type="text" 
                            className="w-full px-2 py-1.5 text-sm border rounded outline-none mb-2"
                            placeholder="Tên thư mục..."
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                        />
                        <div className="flex gap-2">
                            <button onClick={handleCreateFolder} className="flex-1 text-xs bg-green-600 text-white py-1 rounded">Lưu</button>
                            <button onClick={() => setIsAddingFolder(false)} className="flex-1 text-xs bg-gray-200 text-gray-600 py-1 rounded">Hủy</button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {folders.map(folder => (
                        <div 
                            key={folder.id}
                            onClick={() => setSelectedFolderId(folder.id)}
                            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors group ${selectedFolderId === folder.id ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <Folder size={18} className={selectedFolderId === folder.id ? 'fill-green-200' : ''} />
                                <span className="truncate text-sm">{folder.name}</span>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs bg-gray-200 px-1.5 rounded-full">{questions.filter(q => q.folderId === folder.id).length}</span>
                                {folder.id !== 'general' && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="text-gray-400 hover:text-red-500">
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT CONTENT: QUESTIONS */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Folder size={24} className="text-green-600" /> {selectedFolder?.name}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">{filteredQuestions.length} câu hỏi trong thư mục</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setShowStats(!showStats)} 
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${showStats ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            title="Thống kê phân bố"
                        >
                            <PieChartIcon size={18} /> <span className="hidden md:inline">Thống kê</span>
                        </button>
                        {selectedQuestionIds.length > 0 ? (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                <button onClick={handleOpenScoreModal} className="flex items-center gap-1 px-3 py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-bold border border-yellow-200 hover:bg-yellow-100">
                                    <Calculator size={16} /> <span className="hidden lg:inline">Điểm</span>
                                </button>
                                <button onClick={handleBulkDelete} className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold border border-red-100 hover:bg-red-100">
                                    <Trash2 size={16} /> <span className="hidden lg:inline">Xóa</span> ({selectedQuestionIds.length})
                                </button>
                                <button onClick={() => setShowMoveModal(true)} className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold border border-blue-100 hover:bg-blue-100">
                                    <FolderInput size={16} /> <span className="hidden lg:inline">Di chuyển</span>
                                </button>
                                <button onClick={() => setSelectedQuestionIds([])} className="px-2 py-2 text-gray-400 hover:text-gray-600"><X size={18}/></button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Tìm câu hỏi..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 w-48 transition-all"
                                />
                            </div>
                        )}
                        <button 
                            onClick={() => { setShowImportModal(true); setImportStep('upload'); setImportMethod('ai'); }}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                        >
                            <Microscope size={18} /> <span className="hidden md:inline">Nhập đề</span>
                        </button>
                    </div>
                </div>

                {/* STATS PANEL */}
                {showStats && statsData.total > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 border-b border-gray-200 animate-in slide-in-from-top-4">
                        {/* Difficulty Chart */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-64 flex flex-col">
                            <h4 className="font-bold text-gray-700 text-sm mb-4 flex items-center gap-2">
                                <BarChart3 size={16} className="text-blue-500"/> Phân bố độ khó
                            </h4>
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={statsData.difficultyData} layout="vertical" margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis dataKey="short" type="category" width={40} style={{fontSize: '12px', fontWeight: 'bold'}} />
                                        <Tooltip 
                                            cursor={{fill: 'transparent'}}
                                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                                            formatter={(value: any) => [`${value} câu`, 'Số lượng']}
                                            labelFormatter={(label) => statsData.difficultyData.find(d => d.short === label)?.name || label}
                                        />
                                        <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]}>
                                            {statsData.difficultyData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Question Type Chart */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-64 flex flex-col">
                            <h4 className="font-bold text-gray-700 text-sm mb-4 flex items-center gap-2">
                                <PieChartIcon size={16} className="text-purple-500"/> Phân loại câu hỏi
                            </h4>
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statsData.typeData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={60}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {statsData.typeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                        <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    <div className="space-y-4">
                        {paginatedQuestions.map((q, index) => {
                            const isSelected = selectedQuestionIds.includes(q.id);
                            return (
                                <div key={q.id} className={`bg-white p-5 rounded-xl border shadow-sm transition-all group relative ${isSelected ? 'border-green-500 ring-1 ring-green-500 bg-green-50/50' : 'border-gray-200 hover:border-green-300'}`}>
                                    <div className="absolute top-4 left-4 z-10">
                                        <button 
                                            onClick={() => {
                                                setSelectedQuestionIds(prev => isSelected ? prev.filter(id => id !== q.id) : [...prev, q.id]);
                                            }}
                                            className={`text-gray-300 hover:text-green-600 ${isSelected ? 'text-green-600' : ''}`}
                                        >
                                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                        </button>
                                    </div>

                                    <div className="flex gap-4 pl-8">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-500 font-bold text-xs">
                                                        {(currentPage - 1) * itemsPerPage + index + 1}
                                                    </span>
                                                    <span className="text-[10px] uppercase font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded">{q.type}</span>
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{q.difficulty}</span>
                                                    {q.points !== undefined && q.points > 0 && (
                                                        <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 border border-yellow-200 px-2 py-0.5 rounded flex items-center gap-1">
                                                            <Zap size={10} fill="currentColor" /> {q.points} điểm
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditingQuestion(q)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Sửa"><Edit3 size={16}/></button>
                                                    <button onClick={() => handleMoveSingle(q)} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded" title="Di chuyển"><FolderInput size={16}/></button>
                                                    <button onClick={() => handleDeleteQuestion(q.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={16}/></button>
                                                </div>
                                            </div>

                                            <LatexRenderer text={q.content} className="text-gray-800 font-medium mb-3" />
                                            {q.image && <img src={q.image} className="max-h-40 rounded-lg border border-gray-200 mb-3" />}
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                                                {q.options.map((opt, i) => (
                                                    <div key={i} className={`text-sm p-2 rounded border flex items-start gap-2 ${q.correctAnswers.includes(String(i)) ? 'bg-green-50 border-green-200 text-green-800 font-medium' : 'bg-white border-gray-100 text-gray-600'}`}>
                                                        <span className="w-5 h-5 flex items-center justify-center border rounded-full text-xs shrink-0">{String.fromCharCode(65+i)}</span>
                                                        <LatexRenderer text={opt} />
                                                    </div>
                                                ))}
                                            </div>
                                            {q.explanation && (
                                                <span className="text-xs text-gray-500 flex items-center gap-1 mt-2"><Check size={12}/> Có giải thích</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredQuestions.length === 0 && (
                            <div className="h-40 flex flex-col items-center justify-center text-gray-400">
                                <FileText size={40} className="opacity-50 mb-2" />
                                <p>Không tìm thấy câu hỏi.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pagination Footer */}
                {filteredQuestions.length > 0 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white">
                        <span className="text-xs text-gray-500">Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredQuestions.length)} trong {filteredQuestions.length} câu</span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            ><ChevronLeft size={16} /></button>
                            <span className="px-4 py-2 bg-gray-50 rounded-lg text-sm font-bold text-gray-700">{currentPage} / {totalPages}</span>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            ><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* SCORE SETTING MODAL */}
            {showScoreModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <Calculator size={20} className="text-yellow-600"/> Thiết lập điểm số ({selectedQuestionIds.length} câu)
                            </h3>
                            <button onClick={() => setShowScoreModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto bg-gray-50/50">
                            {/* Auto Distribute Section */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6 shadow-sm">
                                <h4 className="font-bold text-gray-700 text-sm mb-3">Tự động chia điểm</h4>
                                <div className="flex gap-3 items-end">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Tổng điểm toàn bài</label>
                                        <input 
                                            type="number" 
                                            value={scoreConfig.totalScore} 
                                            onChange={e => setScoreConfig({...scoreConfig, totalScore: parseFloat(e.target.value) || 0})}
                                            className="w-full mt-1 p-2 border rounded-lg focus:border-yellow-500 outline-none font-bold text-gray-800"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleDistributeScore}
                                        className="px-4 py-2.5 bg-yellow-100 text-yellow-700 font-bold rounded-lg hover:bg-yellow-200 transition-colors"
                                    >
                                        Chia đều ({scoreConfig.totalScore}/{selectedQuestionIds.length})
                                    </button>
                                </div>
                            </div>

                            {/* Manual List Section */}
                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-700 text-sm mb-2">Chi tiết từng câu</h4>
                                {selectedQuestionIds.map((id, index) => {
                                    const q = questions.find(q => q.id === id);
                                    if (!q) return null;
                                    return (
                                        <div key={id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200">
                                            <span className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-500 rounded-full text-xs font-bold shrink-0">
                                                {index + 1}
                                            </span>
                                            <div className="flex-1 truncate">
                                                <LatexRenderer text={q.content} className="text-sm text-gray-700 truncate block" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number" 
                                                    step="0.1"
                                                    value={tempScores[id] ?? 0} 
                                                    onChange={(e) => setTempScores({...tempScores, [id]: parseFloat(e.target.value) || 0})}
                                                    className="w-20 p-1.5 border rounded text-right font-bold text-sm focus:border-green-500 outline-none"
                                                />
                                                <span className="text-xs text-gray-500">điểm</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-white rounded-b-2xl">
                            <button onClick={() => setShowScoreModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Hủy</button>
                            <button onClick={handleSaveScores} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">
                                Lưu điểm số
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* IMPORT MODAL */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className={`bg-white w-full ${importStep === 'review' ? 'max-w-4xl' : 'max-w-lg'} rounded-2xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]`}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                {importMethod === 'ai' ? <Microscope size={20} className="text-purple-600"/> : <FileSpreadsheet size={20} className="text-green-600"/>}
                                {importStep === 'upload' ? (importMethod === 'ai' ? 'Quét AI từ tài liệu' : 'Nhập từ file Excel') : 'Kiểm tra & Chỉnh sửa'}
                            </h3>
                            <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                            {importStep === 'upload' ? (
                                <div className="space-y-4">
                                    {/* Import Method Switcher */}
                                    <div className="flex p-1 bg-white border border-gray-200 rounded-xl mb-4">
                                        <button 
                                            onClick={() => setImportMethod('ai')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${importMethod === 'ai' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            <Microscope size={16} /> AI Scan (PDF/Word)
                                        </button>
                                        <button 
                                            onClick={() => setImportMethod('excel')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${importMethod === 'excel' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            <FileSpreadsheet size={16} /> Excel Template
                                        </button>
                                    </div>

                                    {importMethod === 'ai' ? (
                                        <div className="border-2 border-dashed border-purple-200 bg-purple-50 rounded-xl p-8 text-center hover:border-purple-400 transition-colors cursor-pointer relative">
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".docx, .pdf, image/*, .txt" onChange={handleFileUpload} />
                                            {uploadFile || uploadText ? (
                                                <div className="flex flex-col items-center gap-2 text-purple-700">
                                                    <CheckSquare size={32} />
                                                    <p className="font-bold">{uploadFile ? uploadFile.name : 'Đã nhận diện văn bản'}</p>
                                                    <p className="text-xs">Nhấn nút bên dưới để AI phân tích</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-gray-500">
                                                    <Upload size={32} className="text-purple-300" />
                                                    <p className="font-medium">Kéo thả file hoặc click để chọn</p>
                                                    <p className="text-xs text-gray-400">Hỗ trợ PDF, Word, Ảnh chụp đề thi</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-blue-800 text-sm">Chưa có file mẫu?</p>
                                                    <p className="text-xs text-blue-600">Tải file mẫu chuẩn định dạng Excel để nhập liệu chính xác.</p>
                                                </div>
                                                <button onClick={downloadExcelTemplate} className="px-3 py-2 bg-white text-blue-700 text-xs font-bold rounded-lg border border-blue-100 hover:bg-blue-100 flex items-center gap-1">
                                                    <Download size={14} /> Tải mẫu
                                                </button>
                                            </div>
                                            
                                            <div className="border-2 border-dashed border-green-200 bg-green-50 rounded-xl p-8 text-center hover:border-green-400 transition-colors cursor-pointer relative">
                                                <input type="file" ref={excelInputRef} className="absolute inset-0 opacity-0 cursor-pointer" accept=".xlsx, .xls" onChange={handleExcelUpload} />
                                                <div className="flex flex-col items-center gap-2 text-gray-500">
                                                    <FileSpreadsheet size={32} className="text-green-500" />
                                                    <p className="font-medium">Tải lên file Excel đã nhập liệu</p>
                                                    <p className="text-xs text-gray-400">Hỗ trợ .xlsx, .xls</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {previewQuestions.map((q, idx) => renderQuestionEditor(q, idx, 'preview'))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-between gap-3 bg-gray-50 rounded-b-2xl shrink-0">
                            {importStep === 'review' ? (
                                <>
                                    <button onClick={() => setImportStep('upload')} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg flex items-center gap-2"><ArrowLeft size={18} /> Quay lại</button>
                                    <button onClick={handleFinalizeImport} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-green-700 shadow-lg"><Save size={18} /> Lưu {previewQuestions.length} câu hỏi</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Hủy bỏ</button>
                                    {importMethod === 'ai' ? (
                                        <button onClick={handleRunAIImport} disabled={isImporting || (!uploadFile && !uploadText)} className={`px-6 py-2 bg-purple-600 text-white font-bold rounded-lg flex items-center gap-2 ${isImporting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700 shadow-lg'}`}>{isImporting ? <Loader2 className="animate-spin" size={18} /> : <Microscope size={18} />} {isImporting ? 'Đang phân tích...' : 'Bắt đầu quét'}</button>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT MODAL WITH SPLIT VIEW */}
            {editingQuestion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-7xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Edit3 size={18} className="text-blue-600"/> Chỉnh sửa câu hỏi
                            </h3>
                            <button onClick={() => setEditingQuestion(null)}><X size={20}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-hidden bg-gray-50 flex flex-col lg:flex-row">
                            {/* Editor Panel */}
                            <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">Chỉnh sửa nội dung</h4>
                                {renderQuestionEditor(editingQuestion, 0, 'editing')}
                            </div>

                            {/* Preview Panel */}
                            <div className="flex-1 overflow-y-auto p-6 bg-gray-100/50">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                    <Eye size={14}/> Xem trước (Live Preview)
                                </h4>
                                {/* Preview Container */}
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                    {/* Content */}
                                    <div className="text-lg font-medium text-gray-900 mb-4" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                        <LatexRenderer text={editingQuestion.content} />
                                    </div>
                                    {/* Image */}
                                    {editingQuestion.image && (
                                         <img src={editingQuestion.image} className="max-h-60 rounded-lg border border-gray-100 mb-4 bg-gray-50" />
                                    )}
                                    {/* Options */}
                                    <div className="space-y-2">
                                        {editingQuestion.options.map((opt, i) => (
                                            <div key={i} className={`p-3 rounded-lg border flex items-start gap-3 ${editingQuestion.correctAnswers.includes(String(i)) ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${editingQuestion.correctAnswers.includes(String(i)) ? 'bg-green-600 text-white border-green-600' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                    {String.fromCharCode(65+i)}
                                                </div>
                                                <div className="text-sm font-medium text-gray-700" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                                    <LatexRenderer text={opt} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Explanation */}
                                    {editingQuestion.explanation && (
                                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-gray-700">
                                            <span className="font-bold text-yellow-700 block mb-1">Giải thích:</span>
                                            <LatexRenderer text={editingQuestion.explanation} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-2">
                            <button onClick={() => setEditingQuestion(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">Hủy</button>
                            <button onClick={handleSaveEditedQuestion} className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Lưu thay đổi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MOVE FOLDER MODAL */}
            {showMoveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6">
                        <h3 className="font-bold text-lg mb-4">
                            {movingQuestion ? 'Di chuyển câu hỏi' : `Di chuyển ${selectedQuestionIds.length} câu hỏi`}
                        </h3>
                        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                            {folders.map(f => (
                                <button 
                                    key={f.id} 
                                    onClick={() => setTargetFolderId(f.id)}
                                    className={`w-full text-left p-3 rounded-lg flex items-center gap-2 ${targetFolderId === f.id ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}
                                >
                                    <Folder size={18} /> {f.name}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setShowMoveModal(false); setMovingQuestion(null); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                            <button onClick={handleConfirmMove} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Xác nhận</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuestionBank;