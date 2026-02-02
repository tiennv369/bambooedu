
export enum Difficulty {
  EASY = 'Nhận biết',
  MEDIUM = 'Thông hiểu',
  HARD = 'Vận dụng',
  EXPERT = 'Vận dụng cao'
}

export enum QuestionType {
  SINGLE = 'Một đáp án',
  MULTIPLE = 'Nhiều đáp án',
  SHORT = 'Trả lời ngắn',
  TRUE_FALSE = 'Đúng / Sai' // New Type
}

export enum TeacherRole {
  ADMIN = 'admin',
  TEACHER = 'teacher'
}

export interface Question {
  id: string;
  type: QuestionType;
  content: string;
  image?: string; // Base64 or URL
  options: string[]; // Options for choice questions
  correctAnswers: string[]; // Array of correct values (indices for choices, text for short answer)
  explanation: string;
  difficulty: Difficulty;
  tags: string[];
  points?: number; // Added points field
}

export interface ExamSettings {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  durationMinutes: number;
  questions: Question[];
  createdAt: string;
  status: 'Draft' | 'Published' | 'Archived';
  code: string; // Room code
  settings?: ExamSettings; // New settings field
}

export interface Student {
  id: string;
  studentCode?: string; // Mã học sinh
  password?: string; // Mật khẩu đăng nhập
  name: string;
  avatar: string;
  gender?: 'Nam' | 'Nữ' | 'Khác';
  dob?: string; // Ngày sinh
  grade?: string; // Khối lớp
  className?: string; // Tên lớp
  score: number;
  progress: number; // 0-100
  streak: number;
  status: 'online' | 'offline' | 'in-exam' | 'finished';
  violationCount?: number; // Số lần phát hiện gian lận (rời tab, mất focus)
  teamId?: string; // ID đội (nếu thi đấu theo team)
}

export interface Teacher {
  id: string;
  username: string;
  password: string;
  fullName: string;
  avatar: string;
  email?: string;
  phone?: string;
  subject?: string; // Môn giảng dạy chính
  school?: string; // Trường công tác
  role?: TeacherRole; // Phân quyền: admin được thêm user khác
}

export interface ExamSession {
  id: string;
  examId: string;
  examTitle: string;
  date: string; // ISO string
  durationPlayed: number; // seconds (optional tracking)
  participants: Student[];
}

export interface NavItem {
  label: string;
  icon: any;
  path: string;
}

export interface AnalysisResult {
  weakness: string;
  strength: string;
  recommendation: string;
}

// Configuration for AI Generation
export interface AIGenConfig {
  typeCounts: {
    single: number;
    multiple: number;
    trueFalse: number;
    short: number;
  };
  difficultyCounts: {
    easy: number;     // Nhan biet
    medium: number;   // Thong hieu
    hard: number;     // Van dung
    expert: number;   // Van dung cao
  };
}