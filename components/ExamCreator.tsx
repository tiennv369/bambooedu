import React, { useState, useRef, useEffect, useMemo } from 'react';
import { generateQuizQuestions, parseQuestionsFromDocument } from '../services/geminiService';
import { Question, Difficulty, QuestionType, Exam, Teacher, AIGenConfig } from '../types';
import { Sparkles, Upload, FileText, Plus, Trash2, Save, Loader2, Image as ImageIcon, CheckSquare, List, Type, FileSpreadsheet, Download, Clock, Book, Archive, Eye, Play, ArrowLeft, Calendar, Filter, Shuffle, Settings2, Printer, FileDown, Paperclip, X as XIcon, QrCode, Globe, Edit, Check, AlertTriangle, Layers, Percent, ScanLine, Microscope, Atom, Calculator, Sigma, Beaker, Zap, Wand2, Hash, Activity, ChevronDown, Music, Languages, Hourglass, FlaskConical, Wrench, Library, Square, Edit3, ImagePlus, RefreshCw, FolderInput, LayoutTemplate, Maximize2, Folder } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate, useLocation } from 'react-router-dom';
// @ts-ignore
import { extractRawText } from 'mammoth';
import QRCode from 'react-qr-code';
import LatexRenderer from './LatexRenderer';

// ... (Keep Helper Components: GraphGenerator, ChemicalStructureTool, Constants same as before) ...
// --- HELPER: Graph Generator Component ---
const GraphGenerator: React.FC<{ onSave: (imgData: string) => void, onClose: () => void }> = ({ onSave, onClose }) => {
    const [fn, setFn] = useState('x^2');
    const [xDomain, setXDomain] = useState([-5, 5]);
    const [yDomain, setYDomain] = useState([-5, 10]);
    const graphRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if ((window as any).functionPlot && graphRef.current) {
            try {
                (window as any).functionPlot({
                    target: graphRef.current,
                    width: 500,
                    height: 350,
                    yAxis: { domain: yDomain },
                    xAxis: { domain: xDomain },
                    grid: true,
                    data: [{ fn: fn, color: '#16a34a' }]
                });
            } catch (e) { console.error("Graph error", e); }
        }
    }, [fn, xDomain, yDomain]);

    const handleCapture = () => {
        const svgElement = graphRef.current?.querySelector('svg');
        if (!svgElement) return;
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 350;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const img = new Image();
        const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            const pngData = canvas.toDataURL('image/png');
            onSave(pngData);
            URL.revokeObjectURL(url);
            onClose();
        };
        img.src = url;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><Activity size={20} className="text-green-600"/> Vẽ đồ thị hàm số</h3>
                    <button onClick={onClose}><XIcon className="text-gray-400 hover:text-gray-600" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Hàm số y = f(x)</label>
                        <input type="text" value={fn} onChange={e => setFn(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:border-green-500 outline-none" placeholder="VD: x^2, sin(x), x^3 - 2x" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Trục X</label>
                            <div className="flex gap-2 mt-1">
                                <input type="number" value={xDomain[0]} onChange={e => setXDomain([Number(e.target.value), xDomain[1]])} className="w-full px-2 py-1 border rounded text-sm"/>
                                <input type="number" value={xDomain[1]} onChange={e => setXDomain([xDomain[0], Number(e.target.value)])} className="w-full px-2 py-1 border rounded text-sm"/>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Trục Y</label>
                            <div className="flex gap-2 mt-1">
                                <input type="number" value={yDomain[0]} onChange={e => setYDomain([Number(e.target.value), yDomain[1]])} className="w-full px-2 py-1 border rounded text-sm"/>
                                <input type="number" value={yDomain[1]} onChange={e => setYDomain([yDomain[0], Number(e.target.value)])} className="w-full px-2 py-1 border rounded text-sm"/>
                            </div>
                        </div>
                    </div>
                    <div ref={graphRef} className="w-full h-[350px] border border-gray-100 rounded-lg bg-white flex items-center justify-center overflow-hidden"></div>
                    <div className="flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Hủy</button>
                        <button onClick={handleCapture} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-lg">Chụp & Chèn ảnh</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- HELPER: Chemistry Structure Tool (SmilesDrawer & Kekule) ---
const ChemicalStructureTool: React.FC<{ onSave: (imgData: string) => void, onClose: () => void, mode: 'smiles' | 'kekule' }> = ({ onSave, onClose, mode }) => {
    const [smiles, setSmiles] = useState('CC(=O)OC1=CC=CC=C1C(=O)O'); // Aspirin default
    const containerRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<any>(null);

    useEffect(() => {
        if (mode === 'smiles' && containerRef.current && (window as any).SmilesDrawer) {
            const drawer = new (window as any).SmilesDrawer.Drawer({ width: 450, height: 300 });
            (window as any).SmilesDrawer.parse(smiles, (tree: any) => {
                drawer.draw(tree, 'smiles-canvas', 'light', false);
            });
        } else if (mode === 'kekule' && containerRef.current && (window as any).Kekule) {
            // Initialize Kekule Composer
            const Kekule = (window as any).Kekule;
            Kekule.ChemWidget.Composer.BrowserAdaptor.setIgnoreScroll(true); // Fix scrolling issues
            const composer = new Kekule.ChemWidget.Composer(containerRef.current);
            composer.setDimension('100%', '350px');
            composer.setEnableStyleToolbar(true);
            composer.setEnableOperHistory(true);
            composerRef.current = composer;
        }
    }, [mode, smiles]);

    const handleGenerateSmiles = () => {
        if (mode === 'smiles' && (window as any).SmilesDrawer) {
            const drawer = new (window as any).SmilesDrawer.Drawer({ width: 450, height: 300 });
            (window as any).SmilesDrawer.parse(smiles, (tree: any) => {
                drawer.draw(tree, 'smiles-canvas', 'light', false);
            }, (err: any) => console.log(err));
        }
    };

    const handleSave = () => {
        if (mode === 'smiles') {
            const canvas = document.getElementById('smiles-canvas') as HTMLCanvasElement;
            if (canvas) onSave(canvas.toDataURL());
        } else if (mode === 'kekule' && composerRef.current) {
            try {
                const Kekule = (window as any).Kekule;
                const chemObj = composerRef.current.getChemObj();
                // Render to Image
                const renderContext = Kekule.Render.RenderContext2D.Next;
                // Create a temporary canvas
                const canvas = document.createElement('canvas');
                canvas.width = 500;
                canvas.height = 400;
                const ctx = canvas.getContext('2d');
                if(ctx) {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0,0,500,400);
                    // Draw
                    const painter = new Kekule.Render.ChemObjPainter(Kekule.Render.RendererType.R2D, chemObj, renderContext);
                    painter.draw(ctx, { x: 250, y: 200 }); // Center roughly
                    onSave(canvas.toDataURL());
                }
            } catch(e) {
                console.error("Kekule Export Error", e);
                alert("Lỗi khi xuất ảnh từ Kekule. Vui lòng thử lại.");
            }
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        {mode === 'smiles' ? <Atom size={20} className="text-purple-600"/> : <FlaskConical size={20} className="text-orange-600"/>} 
                        {mode === 'smiles' ? 'Tạo cấu trúc từ SMILES' : 'Vẽ công thức hóa học (Kekule)'}
                    </h3>
                    <button onClick={onClose}><XIcon className="text-gray-400 hover:text-gray-600" /></button>
                </div>
                <div className="p-6 space-y-4">
                    {mode === 'smiles' ? (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Chuỗi SMILES</label>
                            <div className="flex gap-2 mt-1">
                                <input type="text" value={smiles} onChange={e => setSmiles(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm outline-none focus:border-purple-500" />
                                <button onClick={handleGenerateSmiles} className="px-3 bg-purple-100 text-purple-700 rounded-lg font-bold text-xs hover:bg-purple-200">Vẽ</button>
                            </div>
                            <div className="mt-4 border border-gray-100 rounded-lg flex justify-center bg-white p-2">
                                <canvas id="smiles-canvas" width="450" height="300"></canvas>
                            </div>
                        </div>
                    ) : (
                        <div ref={containerRef} className="w-full h-[350px] border border-gray-200 rounded-lg bg-gray-50"></div>
                    )}
                    <div className="flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Hủy</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-lg">Chèn vào câu hỏi</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- SUBJECT LIST CONFIGURATION ---
const SUBJECT_LIST = [
    "Toán", "Ngữ văn", "Ngoại ngữ", "GDCD", "Vật lý", "Hóa học", "Sinh học", "Lịch sử", "Địa lý", "Công nghệ", "Tin học", "GDTC", "Nghệ thuật"
];

// --- EXPANDED SYMBOL LIBRARY FOR ALL SUBJECTS ---
const SYMBOL_CATEGORIES = {
  MATH: [ 
      { label: 'x²', latex: '^{2}', desc: 'Bình phương' }, 
      { label: 'x³', latex: '^{3}', desc: 'Lập phương' },
      { label: '√', latex: '\\sqrt{}', desc: 'Căn bậc 2' }, 
      { label: 'Phân số', latex: '\\frac{a}{b}', desc: 'Phân số' }, 
      { label: 'Hệ PT', latex: '\\begin{cases} x+y=1 \\\\ x-y=0 \\end{cases}', desc: 'Hệ phương trình' }, 
      { label: '∞', latex: '\\infty', desc: 'Vô cực' }, 
      { label: '∫', latex: '\\int_{a}^{b}', desc: 'Tích phân' }, 
      { label: 'lim', latex: '\\lim_{x \\to \\infty}', desc: 'Giới hạn' }, 
      { label: '∑', latex: '\\sum', desc: 'Tổng' }, 
      { label: 'vectơ', latex: '\\vec{u}', desc: 'Vectơ' }, 
      { label: 'độ', latex: '^\\circ', desc: 'Độ' },
      { label: 'π', latex: '\\pi', desc: 'Pi' },
      { label: '≠', latex: '\\neq', desc: 'Khác' },
      { label: '≤', latex: '\\leq', desc: 'Nhỏ hơn bằng' },
      { label: '≥', latex: '\\geq', desc: 'Lớn hơn bằng' }
  ],
  CHEMISTRY: [ 
      { label: '→', latex: '\\rightarrow', desc: 'Phản ứng' }, 
      { label: '⇌', latex: '\\rightleftharpoons', desc: 'Thuận nghịch' }, 
      { label: 't⁰', latex: '\\xrightarrow{t^o}', desc: 'Nhiệt độ' },
      { label: 'xt', latex: '\\xrightarrow{xt}', desc: 'Xúc tác' },
      { label: '↓', latex: '\\downarrow', desc: 'Kết tủa' }, 
      { label: '↑', latex: '\\uparrow', desc: 'Bay hơi' }, 
      { label: 'Ion+', latex: '^{2+}', desc: 'Điện tích dương' },
      { label: 'Ion-', latex: '^{2-}', desc: 'Điện tích âm' },
      { label: 'H₂O', latex: '\\text{H}_2\\text{O}', desc: 'Nước' }, 
      { label: 'CO₂', latex: '\\text{CO}_2', desc: 'CO2' },
      { label: 'H₂SO₄', latex: '\\text{H}_2\\text{SO}_4', desc: 'Axit Sulfuric' },
      { label: 'Mol/l', latex: 'M', desc: 'Nồng độ Mol' },
      { label: 'ΔH', latex: '\\Delta H', desc: 'Enthalpy' },
      { label: 'mhchem', latex: '\\ce{H2O}', desc: 'Format Hóa Học' }
  ],
  PHYSICS: [ 
      { label: 'Phân số', latex: '\\frac{a}{b}', desc: 'Phân số' },
      { label: 'Lực hướng tâm', latex: 'F = \\frac{mv^2}{r}', desc: 'F hướng tâm' },
      { label: 'Động năng', latex: 'W_d = \\frac{1}{2}mv^2', desc: 'Động năng' },
      { label: 'Vector F', latex: '\\vec{F}', desc: 'Vector lực' },
      { label: 'Vector v', latex: '\\vec{v}', desc: 'Vector vận tốc' },
      { label: 'Ω', latex: '\\Omega', desc: 'Ohm' }, 
      { label: 'λ', latex: '\\lambda', desc: 'Bước sóng' }, 
      { label: 'Δ', latex: '\\Delta', desc: 'Biến thiên' }, 
      { label: 'μ', latex: '\\mu', desc: 'Micro/Hệ số ma sát' }, 
      { label: 'ρ', latex: '\\rho', desc: 'Điện trở suất' },
      { label: 'ω', latex: '\\omega', desc: 'Tần số góc' },
      { label: 'α', latex: '\\alpha', desc: 'Alpha' }, 
      { label: 'β', latex: '\\beta', desc: 'Beta' }, 
      { label: 'Đạo hàm', latex: '\\dv{x}{t}', desc: 'Đạo hàm' },
      { label: 'Vectơ đậm', latex: '\\vb{u}', desc: 'Vectơ đậm' }
  ],
  BIOLOGY: [
      { label: '♂', latex: '\\text{♂}', desc: 'Đực' },
      { label: '♀', latex: '\\text{♀}', desc: 'Cái' },
      { label: 'La mã I', latex: '\\text{I}', desc: 'I' },
      { label: 'La mã II', latex: '\\text{II}', desc: 'II' },
      { label: 'X^A', latex: 'X^A', desc: 'Nhiễm sắc thể X' },
      { label: 'I^O', latex: 'I^O', desc: 'Nhóm máu O' },
      { label: 'P:', latex: 'P:', desc: 'Thế hệ P' },
      { label: 'F1:', latex: 'F_1:', desc: 'Thế hệ F1' },
      { label: 'AA', latex: '\\text{AA}', desc: 'Đồng hợp trội' }
  ],
  IT: [
      { label: 'AND', latex: '\\land', desc: 'Và' },
      { label: 'OR', latex: '\\lor', desc: 'Hoặc' },
      { label: 'NOT', latex: '\\neg', desc: 'Phủ định' },
      { label: 'XOR', latex: '\\oplus', desc: 'XOR' },
      { label: '≤', latex: '\\leq', desc: 'Nhỏ hơn bằng' },
      { label: '≠', latex: '\\neq', desc: 'Khác' },
      { label: '≡', latex: '\\equiv', desc: 'Tương đương' },
      { label: '→', latex: '\\rightarrow', desc: 'Suy ra' }
  ],
  GEO: [
      { label: '°', latex: '^\\circ', desc: 'Độ' },
      { label: "'", latex: "'", desc: 'Phút' },
      { label: '"', latex: "''", desc: 'Giây' },
      { label: '℃', latex: '^\\circ\\text{C}', desc: 'Độ C' },
      { label: '%', latex: '\\%', desc: 'Phần trăm' }
  ],
  ENGLISH: [
      { label: '/ə/', latex: '\\text{/ə/}', desc: 'Schwa' },
      { label: '/θ/', latex: '\\text{/θ/}', desc: 'Theta' }, 
      { label: '/ð/', latex: '\\text{/ð/}', desc: 'Eth' }, 
      { label: '/ʃ/', latex: '\\text{/ʃ/}', desc: 'Esh' },
      { label: '/ʒ/', latex: '\\text{/ʒ/}', desc: 'Yogh' },
      { label: '/ŋ/', latex: '\\text{/ŋ/}', desc: 'Eng' },
      { label: '/ː/', latex: '\\text{/ː/}', desc: 'Long vowel' },
      { label: 'Nhấn', latex: "ˈ", desc: 'Trọng âm' }
  ],
  HISTORY: [
      { label: 'I', latex: '\\text{I}', desc: 'Thế kỷ I' },
      { label: 'XIX', latex: '\\text{XIX}', desc: 'Thế kỷ 19' },
      { label: 'XX', latex: '\\text{XX}', desc: 'Thế kỷ 20' },
      { label: '→', latex: '\\rightarrow', desc: 'Dẫn đến' },
      { label: '⇒', latex: '\\Rightarrow', desc: 'Kết quả' }
  ],
  ARTS: [
      { label: '♯', latex: '\\sharp', desc: 'Thăng' },
      { label: '♭', latex: '\\flat', desc: 'Giáng' },
      { label: '♮', latex: '\\natural', desc: 'Bình' },
      { label: '♪', latex: '\\text{♪}', desc: 'Nốt đơn' },
      { label: '♫', latex: '\\text{♫}', desc: 'Nốt đôi' }
  ]
};

const ExamCreator: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'create' | 'bank'>('create');
  const [savedExams, setSavedExams] = useState<Exam[]>([]);
  const [viewingExam, setViewingExam] = useState<Exam | null>(null);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  
  // Filter State
  const [filterSubject, setFilterSubject] = useState('All');
  const [symbolTab, setSymbolTab] = useState<keyof typeof SYMBOL_CATEGORIES>('MATH'); // Type safe key
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [showChemTool, setShowChemTool] = useState<'smiles' | 'kekule' | null>(null); // New State

  // EDIT STATE
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [showEditorModal, setShowEditorModal] = useState(false); // NEW: Full screen edit modal
  
  // BANK IMPORT STATE
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [bankFolders, setBankFolders] = useState<any[]>([]); // Added for folder filtering
  const [filterFolderId, setFilterFolderId] = useState<string>('all'); // Added for filtering
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [randomCount, setRandomCount] = useState<number>(5); // Random select count

  // SAVE TO BANK STATE
  const [showSaveToBankModal, setShowSaveToBankModal] = useState(false);
  const [targetFolderForSave, setTargetFolderForSave] = useState<string>('general');

  useEffect(() => {
    const storedTeacher = localStorage.getItem('bamboo_current_teacher');
    if (storedTeacher) {
        const teacher = JSON.parse(storedTeacher);
        setCurrentTeacher(teacher);
        const storageKey = `bamboo_${teacher.id}_exams`;
        const storedExams = localStorage.getItem(storageKey);
        if (storedExams) { try { setSavedExams(JSON.parse(storedExams)); } catch (e) {} }
        
        // Load folders immediately for Save To Bank feature
        const folderKey = `bamboo_${teacher.id}_folders`;
        const storedFolders = localStorage.getItem(folderKey);
        if (storedFolders) {
            try { setBankFolders(JSON.parse(storedFolders)); } catch(e) { setBankFolders([]); }
        } else {
            // Default Folder
            const defaultFolders = [{ id: 'general', name: 'Chung', createdAt: new Date().toISOString() }];
            localStorage.setItem(folderKey, JSON.stringify(defaultFolders));
            setBankFolders(defaultFolders);
        }
    }
  }, []);

  useEffect(() => {
    if (location.state?.activeTab) {
        setActiveTab(location.state.activeTab);
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  // --- CREATE MODE STATE ---
  const [mode, setMode] = useState<'ai' | 'manual' | 'excel'>('ai');
  const [examTitle, setExamTitle] = useState('');
  const [examDuration, setExamDuration] = useState(45);
  const [examSubject, setExamSubject] = useState(SUBJECT_LIST[0]); // Default to Toán
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // AI Config
  const [additionalReq, setAdditionalReq] = useState('');
  const [aiConfig, setAiConfig] = useState<AIGenConfig>({
      typeCounts: { single: 5, multiple: 0, trueFalse: 0, short: 0 },
      difficultyCounts: { easy: 2, medium: 2, hard: 1, expert: 0 }
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [uploadFile, setUploadFile] = useState<{ name: string; type: string; data: string } | null>(null);

  // Manual Input State
  const [manualQ, setManualQ] = useState<{ 
      content: string; 
      type: QuestionType; 
      difficulty: Difficulty;
      options: string[]; 
      correctAnswers: string[]; 
      explanation: string; 
      image: string | null; 
  }>({ 
      content: '', 
      type: QuestionType.SINGLE, 
      difficulty: Difficulty.MEDIUM,
      options: ['', '', '', ''], 
      correctAnswers: [], 
      explanation: '', 
      image: null 
  });
  // Track active input for inserting symbols
  const [focusedInput, setFocusedInput] = useState<{ type: 'content' | 'option' | 'explanation', index?: number }>({ type: 'content' });
  const contentAreaRef = useRef<HTMLTextAreaElement>(null);

  // --- LOGIC VALIDATION: STRUCTURE VS DIFFICULTY ---
  const totalQuestionsFromTypes = (Object.values(aiConfig.typeCounts) as number[]).reduce((a, b) => a + b, 0);
  const totalQuestionsFromDiff = (Object.values(aiConfig.difficultyCounts) as number[]).reduce((a, b) => a + b, 0);
  const isLogicValid = totalQuestionsFromTypes === totalQuestionsFromDiff && totalQuestionsFromTypes > 0;

  // Helper to calculate percentage for better UX
  const getPercentage = (val: number) => {
      if (totalQuestionsFromDiff === 0) return 0;
      return Math.round((val / totalQuestionsFromDiff) * 100);
  };

  // --- AUTO SWITCH SYMBOL TAB BASED ON SUBJECT ---
  useEffect(() => {
      switch (examSubject) {
          case "Hóa học": setSymbolTab('CHEMISTRY'); break;
          case "Vật lý": case "Công nghệ": setSymbolTab('PHYSICS'); break;
          case "Sinh học": setSymbolTab('BIOLOGY'); break;
          case "Tin học": setSymbolTab('IT'); break;
          case "Địa lý": setSymbolTab('GEO'); break;
          case "Ngoại ngữ": setSymbolTab('ENGLISH'); break;
          case "Lịch sử": case "GDCD": setSymbolTab('HISTORY'); break;
          case "Nghệ thuật": setSymbolTab('ARTS'); break;
          case "Toán": default: setSymbolTab('MATH'); break;
      }
  }, [examSubject]);

  const uniqueSubjects = ['All', ...Array.from(new Set(savedExams.map(e => e.subject).filter(Boolean)))];
  const filteredExams = filterSubject === 'All' ? savedExams : savedExams.filter(exam => exam.subject === filterSubject);

  const handleOpenSaveBankModal = () => {
      if (!currentTeacher || questions.length === 0) return alert("Danh sách câu hỏi trống!");
      // Reload folders to ensure freshness
      const folderKey = `bamboo_${currentTeacher.id}_folders`;
      try {
          const stored = localStorage.getItem(folderKey);
          if (stored) setBankFolders(JSON.parse(stored));
      } catch(e) {}
      setShowSaveToBankModal(true);
  };

  const confirmSaveToBank = () => {
      if (!currentTeacher) return;
      const bankKey = `bamboo_${currentTeacher.id}_question_bank`;
      const existingBank = JSON.parse(localStorage.getItem(bankKey) || '[]');
      
      const newBankItems = questions.map(q => ({ 
          ...q, 
          id: Math.random().toString(36).substr(2, 9), 
          folderId: targetFolderForSave, 
          createdAt: new Date().toISOString() 
      }));
      
      const updatedBank = [...existingBank, ...newBankItems];
      localStorage.setItem(bankKey, JSON.stringify(updatedBank));
      
      const folderName = bankFolders.find(f => f.id === targetFolderForSave)?.name || 'Chung';
      alert(`Đã lưu thành công ${newBankItems.length} câu hỏi vào thư mục "${folderName}"!`);
      setShowSaveToBankModal(false);
  };

  const handleSaveExam = () => {
    if (!currentTeacher) return;
    if (!examTitle.trim()) return alert("Vui lòng nhập tên đề thi!");
    if (questions.length === 0) return alert("Đề thi phải có ít nhất 1 câu hỏi!");
    const newExam: Exam = {
      id: Math.random().toString(36).substr(2, 9),
      title: examTitle,
      subject: examSubject || 'Tổng hợp',
      durationMinutes: examDuration,
      questions: questions,
      createdAt: new Date().toISOString(),
      status: 'Published',
      code: Math.floor(100000 + Math.random() * 900000).toString(),
      settings: { shuffleQuestions, shuffleOptions }
    };
    const updatedExams = [newExam, ...savedExams];
    setSavedExams(updatedExams);
    localStorage.setItem(`bamboo_${currentTeacher.id}_exams`, JSON.stringify(updatedExams));
    alert(`Đã lưu đề thi "${newExam.title}"! Mã phòng thi: ${newExam.code}`);
    setQuestions([]);
    setExamTitle('');
    setActiveTab('bank');
  };

  const deleteExam = (id: string) => {
    if (!currentTeacher) return;
    if (confirm('Bạn có chắc chắn muốn xóa đề thi này?')) {
      const updated = savedExams.filter(e => e.id !== id);
      setSavedExams(updated);
      localStorage.setItem(`bamboo_${currentTeacher.id}_exams`, JSON.stringify(updated));
      if (viewingExam?.id === id) setViewingExam(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return alert("File quá lớn (Max 10MB)!");
    setUploadFile(null); setUploadText('');
    if (file.type.includes("word") || file.name.endsWith(".docx")) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const res = await extractRawText({ arrayBuffer: event.target?.result as ArrayBuffer });
                if (res.value.trim()) { setUploadText(`[DOC: ${file.name}]\n${res.value}`); alert(`Đã tải nội dung từ ${file.name}`); }
            } catch (err) { alert("Lỗi khi đọc file Word."); }
        };
        reader.readAsArrayBuffer(file);
    } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
         const reader = new FileReader();
         reader.onload = (event) => { setUploadText(`[TXT: ${file.name}]\n${event.target?.result as string}`); alert(`Đã tải nội dung từ ${file.name}`); };
         reader.readAsText(file);
    } else if (file.type === "application/pdf" || file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => setUploadFile({ name: file.name, type: file.type, data: (reader.result as string).split(',')[1] });
        reader.readAsDataURL(file);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!isLogicValid) return alert("Vui lòng cân bằng số lượng câu hỏi giữa Cấu trúc và Độ khó!");
    if (!uploadFile && !uploadText && !additionalReq) return alert("Vui lòng tải tài liệu hoặc nhập yêu cầu bổ sung!");
    setIsGenerating(true);
    let contextTopic = `Môn học: ${examSubject}.`;
    if (additionalReq.trim()) {
        contextTopic += `\nYÊU CẦU BỔ SUNG CỦA NGƯỜI DÙNG: "${additionalReq}".\nHãy tuân thủ nghiêm ngặt yêu cầu này khi tạo câu hỏi từ tài liệu.`;
    }
    if (examSubject === 'Hóa học') {
        contextTopic += `\nSystem Instruction: "Khi viết công thức hóa học: dùng lệnh \\ce{...} của mhchem. Bao quanh bằng dấu $...$ hoặc \\(...\\)."`;
    } else if (examSubject === 'Vật lý') {
        contextTopic += `\nSystem Instruction: "Vật lý: Dùng gói 'physics'. Vectơ: \\vb{}, Đạo hàm \\dv{}{}. Luôn bao quanh bằng $...$."`;
    }
    const newQuestions = await generateQuizQuestions(
        contextTopic, aiConfig, uploadText, uploadFile ? { mimeType: uploadFile.type, data: uploadFile.data } : undefined
    );
    if (newQuestions.length === 0) {
        alert("Không thể tạo câu hỏi. Vui lòng kiểm tra lại đầu vào hoặc API Key.");
    } else {
        setQuestions(prev => [...prev, ...newQuestions]);
    }
    setIsGenerating(false);
  };

  const insertMathSymbol = (latex: string) => {
      // Basic insert into currently focused field
      if (focusedInput.type === 'content') {
          setManualQ(prev => ({...prev, content: prev.content + ` $${latex}$ `}));
      } else if (focusedInput.type === 'option' && focusedInput.index !== undefined) {
          const newOpts = [...manualQ.options];
          newOpts[focusedInput.index] = newOpts[focusedInput.index] + ` $${latex}$ `;
          setManualQ(prev => ({...prev, options: newOpts}));
      } else if (focusedInput.type === 'explanation') {
          setManualQ(prev => ({...prev, explanation: prev.explanation + ` $${latex}$ `}));
      }
  };

  const handleOptionImageUpload = (e: React.ChangeEvent<HTMLInputElement>, optionIndex: number) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64 = reader.result as string;
              const newOptions = [...manualQ.options];
              newOptions[optionIndex] = `${newOptions[optionIndex]} ![img](${base64})`;
              setManualQ(prev => ({ ...prev, options: newOptions }));
          };
          reader.readAsDataURL(file);
      }
  };

  const addManualQuestion = () => {
    if (!manualQ.content) return alert("Vui lòng nhập nội dung");
    if (manualQ.type === QuestionType.SHORT && manualQ.correctAnswers.length === 0) return alert("Vui lòng nhập đáp án đúng!");
    if (manualQ.type !== QuestionType.SHORT && manualQ.correctAnswers.length === 0) return alert("Vui lòng chọn đáp án đúng!");

    // Clean up options for Short Answer
    let finalOptions = manualQ.options;
    if (manualQ.type === QuestionType.SHORT) {
        finalOptions = []; // Short Answer doesn't use standard options
    } else if (manualQ.type === QuestionType.TRUE_FALSE) {
        finalOptions = ['Đúng', 'Sai'];
    }

    if (editingQuestionId) {
        setQuestions(prev => prev.map(q => q.id === editingQuestionId ? { ...manualQ, id: q.id, options: finalOptions, tags: q.tags } as Question : q));
        setEditingQuestionId(null);
        alert("Đã cập nhật câu hỏi!");
    } else {
        setQuestions(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), ...manualQ, options: finalOptions, tags: ['Thủ công'], image: manualQ.image || undefined }]);
    }
    // Reset defaults
    setManualQ({ content: '', type: QuestionType.SINGLE, difficulty: Difficulty.MEDIUM, options: ['', '', '', ''], correctAnswers: [], explanation: '', image: null });
    setShowEditorModal(false);
  };

  const handleEditQuestion = (q: Question) => {
      setManualQ({ content: q.content, type: q.type, difficulty: q.difficulty, options: [...q.options], correctAnswers: [...q.correctAnswers], explanation: q.explanation || '', image: q.image || null });
      setEditingQuestionId(q.id);
      setShowEditorModal(true);
  };

  const handleOpenManualModal = () => {
      setEditingQuestionId(null);
      setManualQ({ content: '', type: QuestionType.SINGLE, difficulty: Difficulty.MEDIUM, options: ['', '', '', ''], correctAnswers: [], explanation: '', image: null });
      setShowEditorModal(true);
  }

  // --- Change Question Type Logic ---
  const changeQuestionType = (newType: QuestionType) => {
      let newOptions = [...manualQ.options];
      let newCorrect = []; // Reset correct answers on type change for safety

      if (newType === QuestionType.TRUE_FALSE) {
          newOptions = ['Đúng', 'Sai'];
          newCorrect = ['0']; // Default to True
      } else if (newType === QuestionType.SHORT) {
          newOptions = [];
      } else if (manualQ.type === QuestionType.TRUE_FALSE || manualQ.type === QuestionType.SHORT) {
          // Revert to 4 options when switching back to Choice
          newOptions = ['', '', '', ''];
      }

      setManualQ(prev => ({ ...prev, type: newType, options: newOptions, correctAnswers: newCorrect }));
  };

  const handleOpenBank = () => {
      if (!currentTeacher) return;
      
      // Load Questions
      const storedQuestions = localStorage.getItem(`bamboo_${currentTeacher.id}_question_bank`);
      if (storedQuestions) { 
          try { setBankQuestions(JSON.parse(storedQuestions)); } catch(e) { setBankQuestions([]); } 
      } else { 
          setBankQuestions([]); 
      }
      
      // Load Folders for Filtering
      const storedFolders = localStorage.getItem(`bamboo_${currentTeacher.id}_folders`);
      if (storedFolders) {
          try { setBankFolders(JSON.parse(storedFolders)); } catch(e) { setBankFolders([]); }
      } else {
          setBankFolders([]);
      }

      setSelectedBankIds([]);
      setFilterFolderId('all'); // Reset filter
      setShowBankModal(true);
  };

  const handleImportFromBank = () => {
      const selectedQs = bankQuestions.filter(q => selectedBankIds.includes(q.id));
      const clonedQs = selectedQs.map(q => ({ ...q, id: Math.random().toString(36).substr(2, 9) }));
      setQuestions(prev => [...prev, ...clonedQs]);
      setShowBankModal(false);
      alert(`Đã thêm ${clonedQs.length} câu hỏi từ ngân hàng!`);
  };

  // --- NEW: Random Select Feature ---
  const handleAutoSelect = () => {
      // 1. Filter candidates based on current folder filter
      const candidates = bankQuestions.filter(q => 
          filterFolderId === 'all' ? true : (q as any).folderId === filterFolderId
      );

      if (candidates.length === 0) return alert("Không có câu hỏi nào trong thư mục này để chọn!");

      // 2. Shuffle
      const shuffled = [...candidates].sort(() => 0.5 - Math.random());

      // 3. Slice N
      const count = Math.min(randomCount, shuffled.length);
      const selected = shuffled.slice(0, count);
      
      // 4. Update Selection (Replace or Add? Let's Replace for clarity in "Auto Select" context)
      setSelectedBankIds(selected.map(q => q.id));
  };

  // Filter displayed questions in modal
  const displayedBankQuestions = bankQuestions.filter(q => 
      filterFolderId === 'all' ? true : (q as any).folderId === filterFolderId
  );

  const generateExamHTML = (exam: Exam, forWord: boolean = false) => {
    return `<!DOCTYPE html><html><head><title>${exam.title}</title><meta charset="utf-8"><style>body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; line-height: 1.4; } .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; } .header h1 { font-size: 18pt; margin: 0; text-transform: uppercase; } .header p { margin: 5px 0; font-size: 12pt; } .student-info { border: 1px dashed #000; padding: 15px; margin-bottom: 30px; display: flex; justify-content: space-between; flex-wrap: wrap; } .info-field { width: 48%; margin-bottom: 10px; font-weight: bold; } .question-container { margin-bottom: 15px; page-break-inside: avoid; } .question-content { font-weight: bold; margin-bottom: 8px; } .question-image { max-width: 300px; max-height: 200px; display: block; margin: 10px 0; border: 1px solid #ccc; } .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-left: 20px; } .option { display: flex; align-items: flex-start; gap: 8px; } .footer { margin-top: 50px; text-align: center; font-style: italic; font-size: 10pt; border-top: 1px solid #ccc; padding-top: 10px; } ${forWord ? '.options-grid { display: block; } .option { margin-bottom: 5px; }' : ''}</style></head><body><div class="header"><p>${currentTeacher?.school || 'TRƯỜNG THPT BAMBOO'}</p><h1>${exam.title}</h1><p>Môn: ${exam.subject} | Thời gian: ${exam.durationMinutes} phút | Mã đề: ${exam.code}</p></div><div class="student-info"><div class="info-field">Họ và tên: ................................................................</div><div class="info-field">Lớp: ........................ SBD: .............................</div><div class="info-field">Điểm: ...................... Giám thị: ........................</div></div><div class="content">${exam.questions.map((q, idx) => `<div class="question-container"><div class="question-content">Câu ${idx + 1}: ${q.content}</div>${q.image ? `<img src="${q.image}" class="question-image" />` : ''}<div class="options-grid">${q.options.map((opt, optIdx) => `<div class="option"><span>${String.fromCharCode(65 + optIdx)}.</span><span>${opt}</span></div>`).join('')}</div></div>`).join('')}</div><div class="footer">--- HẾT ---<br/>Học sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm.</div></body></html>`;
  };

  const handlePrintExam = () => { if (!viewingExam) return; const printWindow = window.open('', '_blank'); if (printWindow) { printWindow.document.write(generateExamHTML(viewingExam)); printWindow.document.close(); printWindow.focus(); setTimeout(() => { printWindow.print(); printWindow.close(); }, 500); } };
  const handleExportWord = () => { if (!viewingExam) return; const blob = new Blob(['\ufeff', generateExamHTML(viewingExam, true)], { type: 'application/msword' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${viewingExam.title.replace(/\s+/g, '_')}.doc`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };

  if (viewingExam) {
     return (
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        <div className="flex items-center gap-4"><button onClick={() => setViewingExam(null)} className="p-2 rounded-lg hover:bg-gray-200"><ArrowLeft size={24} /></button><h2 className="text-2xl font-bold">Chi tiết đề thi</h2></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-8 text-white">
            <h1 className="text-3xl font-bold mb-2">{viewingExam.title}</h1>
            <p>{viewingExam.subject} • {viewingExam.durationMinutes} phút • {viewingExam.code}</p>
            <div className="mt-6 flex flex-wrap gap-3">
               <button onClick={() => navigate('/battle')} className="px-6 py-2 bg-white text-green-700 font-bold rounded-lg shadow-lg">Tổ chức thi</button>
               <button onClick={handlePrintExam} className="px-6 py-2 bg-green-700/50 text-white font-bold rounded-lg">In đề</button>
               <button onClick={handleExportWord} className="px-6 py-2 bg-blue-600/80 text-white font-bold rounded-lg">Xuất Word</button>
               <button onClick={() => deleteExam(viewingExam.id)} className="px-6 py-2 bg-red-500/80 text-white font-bold rounded-lg ml-auto">Xóa</button>
            </div>
          </div>
          <div className="p-8 space-y-8">
            {viewingExam.questions.map((q, idx) => (
              <div key={q.id} className="border-b border-gray-100 pb-8 last:border-0 last:pb-0">
                <div className="flex gap-4">
                  <span className="w-8 h-8 rounded-full bg-green-50 text-green-700 font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1">
                    <LatexRenderer text={q.content} className="text-lg font-medium text-gray-900 mb-2" />
                    {q.image && <img src={q.image} className="mt-2 mb-4 max-h-60 rounded-lg border border-gray-200" />}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">{q.options.map((opt, i) => (<div key={i} className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${q.correctAnswers.includes(String(i)) ? 'bg-green-50 border-green-200 text-green-800 font-bold' : 'bg-white border-gray-200'}`}><span className="w-6 h-6 flex items-center justify-center rounded-full text-xs border mr-1">{String.fromCharCode(65 + i)}</span><LatexRenderer text={opt} /></div>))}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Tab Navigation */}
      <div className="flex items-center gap-4 border-b border-gray-200 pb-2">
        <button onClick={() => { setActiveTab('create'); setViewingExam(null); }} className={`pb-2 px-4 font-bold text-sm transition-colors ${activeTab === 'create' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'}`}>Tạo đề mới</button>
        <button onClick={() => { setActiveTab('bank'); setViewingExam(null); }} className={`pb-2 px-4 font-bold text-sm transition-colors ${activeTab === 'bank' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'}`}>Kho đề thi ({savedExams.length})</button>
      </div>

      {activeTab === 'bank' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam) => (
                <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden group">
                  <div className="h-32 bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white relative">
                    <h3 className="font-bold text-lg leading-tight mb-1 line-clamp-2">{exam.title}</h3>
                    <p className="text-green-100 text-sm">{exam.subject} • {exam.durationMinutes} phút</p>
                  </div>
                  <div className="p-4 flex gap-2">
                      <button onClick={() => setViewingExam(exam)} className="flex-1 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium">Xem</button>
                  </div>
                </div>
            ))}
        </div>
      ) : (
        <>
          {/* HEADER SETTINGS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                  <div className="md:col-span-5">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên đề thi</label>
                      <div className="relative">
                          <FileText className="absolute left-3 top-2.5 text-gray-400" size={16} />
                          <input type="text" value={examTitle} onChange={e => setExamTitle(e.target.value)} className="w-full pl-10 p-2 border border-gray-200 rounded-lg outline-none focus:border-green-500" placeholder="VD: Kiểm tra 15 phút Toán" />
                      </div>
                  </div>
                  <div className="md:col-span-4">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Môn học</label>
                      <div className="relative">
                          <Type className="absolute left-3 top-2.5 text-gray-400 z-10" size={16} />
                          <select value={examSubject} onChange={e => setExamSubject(e.target.value)} className="w-full pl-10 p-2 border border-gray-200 rounded-lg outline-none focus:border-green-500 appearance-none bg-white font-medium text-gray-800">
                              {SUBJECT_LIST.map(subject => (<option key={subject} value={subject}>{subject}</option>))}
                          </select>
                          <ChevronDown className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
                      </div>
                  </div>
                  <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Thời gian (phút)</label>
                      <div className="relative">
                          <Clock className="absolute left-3 top-2.5 text-gray-400" size={16} />
                          <input type="number" value={examDuration} onChange={e => setExamDuration(Number(e.target.value))} className="w-full pl-10 p-2 border border-gray-200 rounded-lg outline-none focus:border-green-500" placeholder="45" />
                      </div>
                  </div>
              </div>
              
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-100">
                  <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-600"><div className={`w-10 h-6 rounded-full p-1 transition-colors ${shuffleQuestions ? 'bg-green-500' : 'bg-gray-200'}`} onClick={() => setShuffleQuestions(!shuffleQuestions)}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${shuffleQuestions ? 'translate-x-4' : 'translate-x-0'}`}></div></div>Trộn câu hỏi</label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-600"><div className={`w-10 h-6 rounded-full p-1 transition-colors ${shuffleOptions ? 'bg-green-500' : 'bg-gray-200'}`} onClick={() => setShuffleOptions(!shuffleOptions)}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${shuffleOptions ? 'translate-x-4' : 'translate-x-0'}`}></div></div>Trộn đáp án</label>
                  </div>
                  <button onClick={handleSaveExam} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95"><Save size={18} /> Lưu đề thi</button>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT SIDEBAR: GENERATION TOOLS */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex overflow-x-auto">
                <button onClick={() => setMode('ai')} className={`flex-1 py-2 text-sm font-bold rounded-lg capitalize flex items-center justify-center gap-2 ${mode === 'ai' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-gray-500'}`}><Sparkles size={16}/> AI Gen</button>
                <button onClick={() => handleOpenManualModal()} className={`flex-1 py-2 text-sm font-bold rounded-lg capitalize flex items-center justify-center gap-2 ${mode === 'manual' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-gray-500'}`}><Edit size={16}/> Thủ công</button>
              </div>
              
              <button onClick={handleOpenBank} className="w-full py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-sm border border-indigo-200 hover:bg-indigo-100 flex items-center justify-center gap-2"><Library size={16} /> Chọn từ Ngân hàng câu hỏi</button>

              {/* AI GEN PANEL (Only shown when mode is AI) */}
              {mode === 'ai' && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 animate-in fade-in slide-in-from-left-4">
                        {/* File Context */}
                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-green-300 transition-colors relative bg-gray-50">
                            {uploadFile ? (<div className="flex flex-col items-center"><div className="p-2 bg-white rounded-lg shadow-sm mb-2"><CheckSquare size={24} className="text-green-600"/></div><p className="text-xs font-bold text-gray-700 truncate w-full">{uploadFile.name}</p><button onClick={() => { setUploadFile(null); setUploadText(''); }} className="text-[10px] text-red-500 mt-1 hover:underline">Xóa file</button></div>) : (<label className="cursor-pointer block"><Upload className="mx-auto text-gray-400 mb-2" size={24} /><p className="text-xs font-bold text-gray-500">Tải lên tài liệu (PDF, Ảnh, Text, Word)</p><input type="file" className="hidden" accept=".pdf, .txt, image/*, .docx" onChange={handleFileUpload} /></label>)}
                        </div>
                        {/* Subject Selection inside AI Gen */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Môn học (Ngữ cảnh AI)</label>
                            <div className="relative"><select value={examSubject} onChange={e => setExamSubject(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-green-500 outline-none appearance-none bg-white font-medium text-gray-800">{SUBJECT_LIST.map(subject => (<option key={subject} value={subject}>{subject}</option>))}</select><ChevronDown className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} /></div>
                            {examSubject === 'Hóa học' && (<div className="mt-2 p-2 bg-purple-50 border border-purple-100 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1"><Wrench size={14} className="text-purple-600" /><span className="text-[10px] text-purple-700 font-bold">Đã kích hoạt: MathJax, mhchem, SmilesDrawer</span></div>)}
                            {examSubject === 'Vật lý' && (<div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1"><Atom size={14} className="text-blue-600" /><span className="text-[10px] text-blue-700 font-bold">Đã kích hoạt: MathJax Physics Extension (\vb, \dv, \qty...)</span></div>)}
                        </div>
                        <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Yêu cầu bổ sung (AI Directive)</label><input type="text" value={additionalReq} onChange={e => setAdditionalReq(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-green-500 outline-none" placeholder="VD: Tập trung vào chương 1, mức độ vận dụng cao..." /></div>
                        {/* Structure Config */}
                        <div className="space-y-3"><label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Layers size={14} /> Cấu trúc đề ({totalQuestionsFromTypes} câu)</label><div className="grid grid-cols-2 gap-3"><div className="p-2 border rounded-lg bg-gray-50"><span className="text-[10px] text-gray-500 block mb-1">Trắc nghiệm</span><input type="number" min="0" value={aiConfig.typeCounts.single} onChange={e => setAiConfig({...aiConfig, typeCounts: {...aiConfig.typeCounts, single: parseInt(e.target.value) || 0}})} className="w-full font-bold text-gray-800 bg-transparent outline-none" /></div><div className="p-2 border rounded-lg bg-gray-50"><span className="text-[10px] text-gray-500 block mb-1">Nhiều đáp án</span><input type="number" min="0" value={aiConfig.typeCounts.multiple} onChange={e => setAiConfig({...aiConfig, typeCounts: {...aiConfig.typeCounts, multiple: parseInt(e.target.value) || 0}})} className="w-full font-bold text-gray-800 bg-transparent outline-none" /></div><div className="p-2 border rounded-lg bg-gray-50"><span className="text-[10px] text-gray-500 block mb-1">Đúng / Sai</span><input type="number" min="0" value={aiConfig.typeCounts.trueFalse} onChange={e => setAiConfig({...aiConfig, typeCounts: {...aiConfig.typeCounts, trueFalse: parseInt(e.target.value) || 0}})} className="w-full font-bold text-gray-800 bg-transparent outline-none" /></div><div className="p-2 border rounded-lg bg-gray-50"><span className="text-[10px] text-gray-500 block mb-1">Điền từ</span><input type="number" min="0" value={aiConfig.typeCounts.short} onChange={e => setAiConfig({...aiConfig, typeCounts: {...aiConfig.typeCounts, short: parseInt(e.target.value) || 0}})} className="w-full font-bold text-gray-800 bg-transparent outline-none" /></div></div></div>
                        {/* Difficulty Config */}
                        <div className="space-y-3"><label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Percent size={14} /> Phân bổ độ khó ({totalQuestionsFromDiff} câu)</label><div className="grid grid-cols-4 gap-2"><div className="text-center group relative"><input type="number" min="0" value={aiConfig.difficultyCounts.easy} onChange={e => setAiConfig({...aiConfig, difficultyCounts: {...aiConfig.difficultyCounts, easy: parseInt(e.target.value) || 0}})} className="w-full p-1 border rounded text-center font-bold text-sm bg-green-50 text-green-700 outline-none focus:ring-1 focus:ring-green-500" /><span className="text-[10px] text-gray-400 mt-1 block">NB ({getPercentage(aiConfig.difficultyCounts.easy)}%)</span></div><div className="text-center group relative"><input type="number" min="0" value={aiConfig.difficultyCounts.medium} onChange={e => setAiConfig({...aiConfig, difficultyCounts: {...aiConfig.difficultyCounts, medium: parseInt(e.target.value) || 0}})} className="w-full p-1 border rounded text-center font-bold text-sm bg-blue-50 text-blue-700 outline-none focus:ring-1 focus:ring-blue-500" /><span className="text-[10px] text-gray-400 mt-1 block">TH ({getPercentage(aiConfig.difficultyCounts.medium)}%)</span></div><div className="text-center group relative"><input type="number" min="0" value={aiConfig.difficultyCounts.hard} onChange={e => setAiConfig({...aiConfig, difficultyCounts: {...aiConfig.difficultyCounts, hard: parseInt(e.target.value) || 0}})} className="w-full p-1 border rounded text-center font-bold text-sm bg-orange-50 text-orange-700 outline-none focus:ring-1 focus:ring-orange-500" /><span className="text-[10px] text-gray-400 mt-1 block">VD ({getPercentage(aiConfig.difficultyCounts.hard)}%)</span></div><div className="text-center group relative"><input type="number" min="0" value={aiConfig.difficultyCounts.expert} onChange={e => setAiConfig({...aiConfig, difficultyCounts: {...aiConfig.difficultyCounts, expert: parseInt(e.target.value) || 0}})} className="w-full p-1 border rounded text-center font-bold text-sm bg-red-50 text-red-700 outline-none focus:ring-1 focus:ring-red-500" /><span className="text-[10px] text-gray-400 mt-1 block">VDC ({getPercentage(aiConfig.difficultyCounts.expert)}%)</span></div></div></div>
                        {!isLogicValid && (<div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex gap-2 items-start"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>Tổng số câu hỏi theo Cấu trúc ({totalQuestionsFromTypes}) không khớp với Độ khó ({totalQuestionsFromDiff}). Vui lòng điều chỉnh lại.</span></div>)}
                        <button onClick={handleGenerateQuestions} disabled={isGenerating || !isLogicValid} className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all ${isGenerating || !isLogicValid ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-purple-200'}`}>{isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 size={20} />} {isGenerating ? 'Đang tạo câu hỏi...' : 'Tạo câu hỏi'}</button>
                  </div>
              )}
            </div>

            {/* RIGHT COLUMN: QUESTION LIST */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-gray-700">Danh sách câu hỏi ({questions.length})</h3>
                  {questions.length > 0 && (<button onClick={handleOpenSaveBankModal} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors"><Library size={14} /> Lưu vào Ngân hàng</button>)}
              </div>
              
              {questions.length === 0 ? (
                  <div className="h-[400px] flex flex-col items-center justify-center bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400">
                      <FileText size={64} className="opacity-20 mb-4" />
                      <p>Chưa có câu hỏi nào. Hãy tạo từ cột bên trái!</p>
                  </div>
              ) : (
                  questions.map((q, index) => (
                    <div key={q.id} className={`bg-white p-6 rounded-2xl shadow-sm border group relative transition-all ${editingQuestionId === q.id ? 'border-yellow-400 ring-2 ring-yellow-100 bg-yellow-50/10' : 'border-gray-100'}`}>
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditQuestion(q)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded bg-white border border-gray-200 shadow-sm" title="Sửa"><Edit3 size={16} /></button>
                            <button onClick={() => setQuestions(questions.filter(qi => qi.id !== q.id))} className="p-1.5 text-red-500 hover:bg-red-50 rounded bg-white border border-gray-200 shadow-sm" title="Xóa"><Trash2 size={16} /></button>
                        </div>
                        <div className="flex gap-4">
                            <span className="font-bold text-green-700 shrink-0 mt-1">#{index + 1}</span>
                            <div className="flex-1">
                                <LatexRenderer text={q.content} className="text-gray-800 font-medium text-lg leading-snug mb-3" />
                                {q.image && <img src={q.image} alt="Question" className="mt-2 mb-4 max-h-40 rounded-lg border border-gray-200" />}
                                {q.type !== QuestionType.SHORT && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                                        {q.options.map((opt, i) => (<div key={i} className={`text-sm p-2 rounded border flex items-start gap-2 ${q.correctAnswers.includes(String(i)) ? 'bg-green-50 border-green-200 text-green-800 font-medium' : 'bg-white border-gray-100 text-gray-600'}`}><span className="w-5 h-5 flex items-center justify-center border rounded-full text-xs shrink-0">{String.fromCharCode(65+i)}</span><LatexRenderer text={opt} /></div>))}
                                    </div>
                                )}
                                {q.type === QuestionType.SHORT && (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 mb-3 font-medium">
                                        <strong>Đáp án đúng:</strong> {q.correctAnswers.join('; ')}
                                    </div>
                                )}
                                <div className="flex gap-2"><span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-bold uppercase">{q.type}</span><span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-bold uppercase">{q.difficulty}</span></div>
                            </div>
                        </div>
                    </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
      {showGraphModal && <GraphGenerator onSave={(img) => setManualQ({...manualQ, image: img})} onClose={() => setShowGraphModal(false)} />}
      {showChemTool && (<ChemicalStructureTool mode={showChemTool} onSave={(img) => setManualQ({...manualQ, image: img})} onClose={() => setShowChemTool(null)} />)}

      {/* --- SAVE TO BANK MODAL (NEW) --- */}
      {showSaveToBankModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl animate-in zoom-in-95">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800">Chọn thư mục lưu trữ</h3>
                      <button onClick={() => setShowSaveToBankModal(false)}><XIcon size={20} className="text-gray-400 hover:text-gray-600"/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-sm text-gray-600 mb-3">Bạn muốn lưu {questions.length} câu hỏi vào thư mục nào?</p>
                      <select 
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 bg-white"
                          value={targetFolderForSave}
                          onChange={(e) => setTargetFolderForSave(e.target.value)}
                      >
                          {bankFolders.map((f:any) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                      </select>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
                      <button onClick={() => setShowSaveToBankModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold">Hủy</button>
                      <button onClick={confirmSaveToBank} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Lưu ngay</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- QUESTION BANK PICKER MODAL --- */}
      {showBankModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl"><h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><Library size={20} className="text-indigo-600"/> Chọn câu hỏi từ Ngân hàng</h3><button onClick={() => setShowBankModal(false)} className="text-gray-400 hover:text-gray-600"><XIcon size={24} /></button></div>
                  
                  {/* FILTER & RANDOM BAR */}
                  <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-gray-500"/>
                            <select 
                                value={filterFolderId}
                                onChange={(e) => setFilterFolderId(e.target.value)}
                                className="p-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-indigo-500 w-48"
                            >
                                <option value="all">Tất cả thư mục</option>
                                {bankFolders.map((f:any) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 uppercase hidden md:inline">Chọn ngẫu nhiên:</span>
                            <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden">
                                <input 
                                    type="number" 
                                    min="1" 
                                    max={bankQuestions.length}
                                    value={randomCount} 
                                    onChange={(e) => setRandomCount(parseInt(e.target.value) || 1)} 
                                    className="w-16 p-1.5 text-center text-sm outline-none"
                                />
                                <button 
                                    onClick={handleAutoSelect} 
                                    className="bg-indigo-50 text-indigo-700 px-3 py-1.5 text-xs font-bold border-l border-gray-200 hover:bg-indigo-100 flex items-center gap-1"
                                >
                                    <Shuffle size={12}/> Auto
                                </button>
                            </div>
                        </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                      {displayedBankQuestions.length === 0 ? (
                          <div className="text-center py-10 text-gray-400"><Library size={48} className="mx-auto mb-3 opacity-30" /><p>Không tìm thấy câu hỏi nào trong thư mục này.</p></div>
                      ) : (
                          <div className="space-y-3">
                              {displayedBankQuestions.map((q) => (
                                  <div key={q.id} className={`p-4 bg-white rounded-xl border cursor-pointer transition-all ${selectedBankIds.includes(q.id) ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/30' : 'border-gray-200 hover:border-indigo-300'}`} onClick={() => setSelectedBankIds(prev => prev.includes(q.id) ? prev.filter(id => id !== q.id) : [...prev, q.id])}>
                                      <div className="flex items-start gap-3">
                                          <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${selectedBankIds.includes(q.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 text-white'}`}><Check size={14} /></div>
                                          <div className="flex-1">
                                              <LatexRenderer text={q.content} className="text-gray-800 text-sm font-medium mb-2 line-clamp-2" />
                                              <div className="flex gap-2"><span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded">{q.type}</span><span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded">{q.difficulty}</span></div>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-white rounded-b-2xl"><span className="text-sm text-gray-500">Đã chọn: <strong>{selectedBankIds.length}</strong> câu</span><div className="flex gap-2"><button onClick={() => setShowBankModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Hủy</button><button onClick={handleImportFromBank} disabled={selectedBankIds.length === 0} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Thêm vào đề thi</button></div></div>
              </div>
          </div>
      )}

      {/* --- NEW SPLIT-VIEW EDITOR MODAL --- */}
      {showEditorModal && (
          <div className="fixed inset-0 z-[50] flex flex-col bg-gray-100">
              {/* MODAL HEADER */}
              <div className="bg-white h-14 border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-10">
                  <div className="flex items-center gap-3">
                      <button onClick={() => setShowEditorModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><XIcon size={20} /></button>
                      <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                          <Edit3 size={18} className="text-blue-600"/> 
                          {editingQuestionId ? `Chỉnh sửa câu hỏi` : 'Soạn thảo câu hỏi mới'}
                      </h3>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={addManualQuestion} className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md">
                          <Save size={16} /> Lưu câu hỏi
                      </button>
                  </div>
              </div>

              {/* MODAL BODY - SPLIT VIEW */}
              <div className="flex-1 flex overflow-hidden">
                  
                  {/* LEFT PANEL: EDITOR */}
                  <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white">
                      {/* TOOLBAR */}
                      <div className="h-12 border-b border-gray-100 flex items-center px-4 gap-2 overflow-x-auto bg-gray-50/50">
                          {Object.keys(SYMBOL_CATEGORIES).map(key => (
                              <button key={key} onClick={() => setSymbolTab(key as keyof typeof SYMBOL_CATEGORIES)} className={`px-2 py-1 text-[10px] font-bold rounded hover:bg-gray-200 ${symbolTab===key ? 'bg-blue-100 text-blue-700': 'text-gray-500'}`}>{key}</button>
                          ))}
                          <div className="h-6 w-px bg-gray-300 mx-2"></div>
                          {SYMBOL_CATEGORIES[symbolTab].map((sym, idx) => (
                              <button key={idx} onClick={() => insertMathSymbol(sym.latex)} className="p-1 min-w-[28px] h-7 hover:bg-blue-50 rounded text-center border border-transparent hover:border-blue-100 flex items-center justify-center" title={sym.desc}>
                                  <LatexRenderer text={`$${sym.latex}$`} className="text-sm pointer-events-none" />
                              </button>
                          ))}
                          {symbolTab === 'CHEMISTRY' && (
                              <button onClick={() => setShowChemTool('kekule')} className="ml-2 p-1.5 bg-orange-100 text-orange-700 rounded text-xs font-bold whitespace-nowrap"><FlaskConical size={12} className="inline"/> Vẽ CT</button>
                          )}
                          {symbolTab === 'MATH' && (
                              <button onClick={() => setShowGraphModal(true)} className="ml-2 p-1.5 bg-green-100 text-green-700 rounded text-xs font-bold whitespace-nowrap"><Activity size={12} className="inline"/> Đồ thị</button>
                          )}
                      </div>

                      {/* INPUTS SCROLLABLE AREA */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-6">
                          {/* META INFO ROW */}
                          <div className="flex gap-4">
                              <div className="w-1/2">
                                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Loại câu hỏi</label>
                                  <select 
                                      className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                                      value={manualQ.type}
                                      onChange={(e) => changeQuestionType(e.target.value as QuestionType)}
                                  >
                                      <option value={QuestionType.SINGLE}>Trắc nghiệm (1 đáp án)</option>
                                      <option value={QuestionType.MULTIPLE}>Trắc nghiệm (Nhiều đáp án)</option>
                                      <option value={QuestionType.TRUE_FALSE}>Đúng / Sai</option>
                                      <option value={QuestionType.SHORT}>Điền từ (Trả lời ngắn)</option>
                                  </select>
                              </div>
                              <div className="w-1/2">
                                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Mức độ</label>
                                  <select 
                                      className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                                      value={manualQ.difficulty}
                                      onChange={(e) => setManualQ({...manualQ, difficulty: e.target.value as Difficulty})}
                                  >
                                      <option value={Difficulty.EASY}>Nhận biết</option>
                                      <option value={Difficulty.MEDIUM}>Thông hiểu</option>
                                      <option value={Difficulty.HARD}>Vận dụng</option>
                                      <option value={Difficulty.EXPERT}>Vận dụng cao</option>
                                  </select>
                              </div>
                          </div>

                          {/* Question Content */}
                          <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
                                  <span>Nội dung câu hỏi</span>
                                  <span className="text-blue-600 cursor-pointer hover:underline flex items-center gap-1"><ImageIcon size={12}/> {manualQ.image ? 'Đổi ảnh' : 'Thêm ảnh'} 
                                      <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                              const reader = new FileReader();
                                              reader.onload = () => setManualQ(prev => ({...prev, image: reader.result as string}));
                                              reader.readAsDataURL(file);
                                          }
                                      }} />
                                  </span>
                              </label>
                              <div className="relative">
                                  <textarea 
                                      ref={contentAreaRef}
                                      value={manualQ.content} 
                                      onChange={e => setManualQ({...manualQ, content: e.target.value})} 
                                      onFocus={() => setFocusedInput({type: 'content'})}
                                      className="w-full p-4 border border-gray-300 rounded-xl min-h-[120px] focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none text-base font-medium" 
                                      placeholder="Nhập nội dung câu hỏi..."
                                  ></textarea>
                                  {manualQ.image && (
                                      <div className="mt-2 relative inline-block group">
                                          <img src={manualQ.image} className="h-32 rounded-lg border border-gray-200" />
                                          <button onClick={() => setManualQ({...manualQ, image: null})} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><XIcon size={12}/></button>
                                      </div>
                                  )}
                              </div>
                          </div>

                          {/* Conditional Options Rendering */}
                          {manualQ.type === QuestionType.SHORT ? (
                              // SHORT ANSWER INPUT
                              <div className="space-y-3">
                                  <label className="text-xs font-bold text-gray-500 uppercase">Đáp án đúng</label>
                                  <input 
                                      type="text" 
                                      value={manualQ.correctAnswers[0] || ''}
                                      onChange={(e) => setManualQ({...manualQ, correctAnswers: [e.target.value]})}
                                      className="w-full p-3 border-2 border-green-200 bg-green-50 rounded-xl outline-none focus:border-green-500 text-green-800 font-bold"
                                      placeholder="Nhập từ hoặc số chính xác..."
                                  />
                                  <p className="text-[10px] text-gray-400">Hệ thống sẽ so sánh chính xác (không phân biệt hoa thường) với nội dung học sinh nhập.</p>
                              </div>
                          ) : (
                              // CHOICE / TRUE-FALSE OPTIONS
                              <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                      <label className="text-xs font-bold text-gray-500 uppercase">Các lựa chọn</label>
                                      {manualQ.type !== QuestionType.TRUE_FALSE && (
                                          <button onClick={() => setManualQ({...manualQ, options: [...manualQ.options, '']})} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-600 font-bold">+ Thêm lựa chọn</button>
                                      )}
                                  </div>
                                  
                                  {manualQ.options.map((opt, idx) => (
                                      <div key={idx} className="flex gap-3 items-start group">
                                          <button 
                                              onClick={() => {
                                                  if (manualQ.type === QuestionType.SINGLE || manualQ.type === QuestionType.TRUE_FALSE) {
                                                      setManualQ({...manualQ, correctAnswers: [String(idx)]});
                                                  } else {
                                                      const exists = manualQ.correctAnswers.includes(String(idx));
                                                      setManualQ({...manualQ, correctAnswers: exists ? manualQ.correctAnswers.filter(c => c !== String(idx)) : [...manualQ.correctAnswers, String(idx)]});
                                                  }
                                              }}
                                              className={`mt-2 w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-sm border-2 font-bold transition-all ${manualQ.correctAnswers.includes(String(idx)) ? 'bg-green-600 text-white border-green-600 shadow-green-200 shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'}`}
                                          >
                                              {manualQ.type === QuestionType.TRUE_FALSE 
                                                  ? (idx === 0 ? 'Đ' : 'S')
                                                  : String.fromCharCode(65 + idx)
                                              }
                                          </button>
                                          <div className="flex-1 relative">
                                              <input 
                                                  type="text" 
                                                  value={opt} 
                                                  readOnly={manualQ.type === QuestionType.TRUE_FALSE} // Read-only for T/F
                                                  onFocus={() => setFocusedInput({type: 'option', index: idx})}
                                                  onChange={e => {
                                                      const newOpts = [...manualQ.options];
                                                      newOpts[idx] = e.target.value;
                                                      setManualQ({...manualQ, options: newOpts});
                                                  }}
                                                  className={`w-full p-3 pr-10 border rounded-xl outline-none focus:ring-1 transition-all ${manualQ.correctAnswers.includes(String(idx)) ? 'border-green-500 ring-green-200 bg-green-50/20' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} ${manualQ.type === QuestionType.TRUE_FALSE ? 'cursor-default' : ''}`}
                                                  placeholder={`Lựa chọn ${String.fromCharCode(65 + idx)}`}
                                              />
                                              {manualQ.type !== QuestionType.TRUE_FALSE && (
                                                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <label className="p-1 hover:text-blue-600 cursor-pointer">
                                                          <ImageIcon size={16} />
                                                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleOptionImageUpload(e, idx)} />
                                                      </label>
                                                      {manualQ.options.length > 2 && (
                                                          <button onClick={() => {
                                                              const newOpts = manualQ.options.filter((_, i) => i !== idx);
                                                              // Also adjust correct answers if we delete an option
                                                              // This is tricky, simpler to just clear correct answers or let user re-select
                                                              setManualQ({...manualQ, options: newOpts, correctAnswers: []});
                                                          }} className="p-1 hover:text-red-600"><Trash2 size={16} /></button>
                                                      )}
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}

                          {/* Explanation */}
                          <div className="pt-4 border-t border-gray-100">
                              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Giải thích (Hiện sau khi nộp bài)</label>
                              <textarea 
                                  value={manualQ.explanation} 
                                  onChange={e => setManualQ({...manualQ, explanation: e.target.value})}
                                  onFocus={() => setFocusedInput({type: 'explanation'})}
                                  className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:border-yellow-500 outline-none h-20 bg-yellow-50/30"
                                  placeholder="Nhập lời giải chi tiết..."
                              ></textarea>
                          </div>
                      </div>
                  </div>

                  {/* RIGHT PANEL: LIVE PREVIEW */}
                  <div className="w-1/2 bg-gray-50 flex flex-col h-full">
                      <div className="h-12 border-b border-gray-200 flex items-center px-6 bg-white shrink-0">
                          <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Eye size={14}/> Xem trước (Live Preview)</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
                          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                              <div className="p-6 md:p-8">
                                  <div className="flex justify-between items-start mb-4">
                                      <div className="flex gap-2">
                                          <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-1 rounded uppercase font-sans">{manualQ.type}</span>
                                          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded uppercase font-sans">{manualQ.difficulty}</span>
                                      </div>
                                  </div>
                                  
                                  {/* Question Text Render */}
                                  <div className="text-xl md:text-2xl font-medium text-gray-900 leading-relaxed mb-6 font-serif">
                                      {manualQ.content ? <LatexRenderer text={manualQ.content} /> : <span className="text-gray-300 italic">Nội dung câu hỏi sẽ hiển thị ở đây...</span>}
                                  </div>
                                  
                                  {manualQ.image && <img src={manualQ.image} className="w-full max-h-80 object-contain rounded-xl border border-gray-100 bg-gray-50 mb-6" />}

                                  {/* Options Render */}
                                  <div className="space-y-3 font-sans"> 
                                      {manualQ.type === QuestionType.SHORT ? (
                                          <div className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-400 italic">
                                              Học sinh sẽ nhập câu trả lời vào đây...
                                              {manualQ.correctAnswers[0] && <div className="mt-2 text-green-600 text-sm font-bold not-italic">Đáp án mẫu: {manualQ.correctAnswers[0]}</div>}
                                          </div>
                                      ) : (
                                          <div className="grid grid-cols-1 gap-3">
                                              {manualQ.options.map((opt, i) => {
                                                  const isSelected = manualQ.correctAnswers.includes(String(i));
                                                  return (
                                                      <div key={i} className={`relative w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${isSelected ? 'bg-green-50 border-green-500 shadow-sm' : 'bg-white border-gray-100'}`}>
                                                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 font-bold text-sm ${isSelected ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 text-gray-400'}`}>
                                                              {isSelected ? <Check size={16} strokeWidth={4} /> : String.fromCharCode(65 + i)}
                                                          </div>
                                                          <span className="text-lg font-medium flex-1 font-serif text-gray-800">
                                                              {opt ? <LatexRenderer text={opt} /> : <span className="text-gray-300 text-sm">Trống</span>}
                                                          </span>
                                                      </div>
                                                  )
                                              })}
                                          </div>
                                      )}
                                  </div>

                                  {/* Explanation Preview */}
                                  {manualQ.explanation && (
                                      <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200 text-yellow-800 text-sm">
                                          <div className="font-bold flex items-center gap-2 mb-2"><CheckSquare size={16}/> Giải thích:</div>
                                          <LatexRenderer text={manualQ.explanation} />
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ExamCreator;