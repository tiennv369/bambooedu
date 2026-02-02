import React, { useState, useEffect } from 'react';
import { 
  History, Search, Calendar, Users, Award, ChevronRight, 
  ArrowLeft, Download, FileSpreadsheet, Eye, Trash2 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ExamSession, Teacher, Student } from '../types';

const ExamHistory: React.FC = () => {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ExamSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load Data
  useEffect(() => {
    const storedTeacher = localStorage.getItem('bamboo_current_teacher');
    if (storedTeacher) {
      const teacher = JSON.parse(storedTeacher);
      setCurrentTeacher(teacher);
      
      const historyKey = `bamboo_${teacher.id}_exam_history`;
      const storedHistory = localStorage.getItem(historyKey);
      if (storedHistory) {
        try {
          const parsed = JSON.parse(storedHistory);
          // Sort by date descending
          parsed.sort((a: ExamSession, b: ExamSession) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setSessions(parsed);
          setFilteredSessions(parsed);
        } catch (e) {
          console.error("Error loading history", e);
        }
      }
    }
  }, []);

  // Filter Logic
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSessions(sessions);
    } else {
      const lower = searchTerm.toLowerCase();
      const filtered = sessions.filter(s => 
        s.examTitle.toLowerCase().includes(lower) || 
        new Date(s.date).toLocaleDateString('vi-VN').includes(lower)
      );
      setFilteredSessions(filtered);
    }
  }, [searchTerm, sessions]);

  // Export to Excel
  const handleExportExcel = (session: ExamSession) => {
    const data = session.participants.map((p, index) => ({
      "Hạng": index + 1,
      "Mã Học Sinh": p.studentCode || '--',
      "Họ và Tên": p.name,
      "Lớp": p.className || '--',
      "Điểm số": p.score,
      "Trạng thái": p.status === 'finished' ? 'Hoàn thành' : 'Chưa nộp',
      "Ngày thi": new Date(session.date).toLocaleDateString('vi-VN')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KetQuaThi");
    
    // Auto fit column width logic (basic)
    const wscols = [
      {wch: 10}, {wch: 15}, {wch: 30}, {wch: 10}, {wch: 10}, {wch: 15}, {wch: 15}
    ];
    ws['!cols'] = wscols;

    const safeName = session.examTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(wb, `KetQua_${safeName}_${new Date().getTime()}.xlsx`);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!currentTeacher) return;
    if (confirm("Bạn có chắc chắn muốn xóa lịch sử kỳ thi này không? Dữ liệu không thể khôi phục.")) {
      const updated = sessions.filter(s => s.id !== sessionId);
      setSessions(updated);
      setFilteredSessions(updated); // Update filtered list too
      if (selectedSession?.id === sessionId) setSelectedSession(null);
      localStorage.setItem(`bamboo_${currentTeacher.id}_exam_history`, JSON.stringify(updated));
    }
  };

  // --- RENDER DETAIL VIEW ---
  if (selectedSession) {
    // Sort participants by score descending
    const sortedParticipants = [...selectedSession.participants].sort((a, b) => b.score - a.score);
    const avgScore = sortedParticipants.length > 0 
      ? (sortedParticipants.reduce((acc, curr) => acc + curr.score, 0) / sortedParticipants.length).toFixed(1)
      : 0;

    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedSession(null)} 
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">Chi tiết kết quả</h2>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedSession.examTitle}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Calendar size={16} /> {new Date(selectedSession.date).toLocaleString('vi-VN')}</span>
                <span className="flex items-center gap-1"><Users size={16} /> {selectedSession.participants.length} thí sinh</span>
                <span className="flex items-center gap-1 text-orange-600 font-bold"><Award size={16} /> ĐTB: {avgScore}</span>
              </div>
            </div>
            <button 
              onClick={() => handleExportExcel(selectedSession)}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all active:scale-95"
            >
              <FileSpreadsheet size={20} /> Xuất Excel
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold text-center w-20">Hạng</th>
                  <th className="p-4 font-bold">Thí sinh</th>
                  <th className="p-4 font-bold">Mã HS / Lớp</th>
                  <th className="p-4 font-bold">Trạng thái</th>
                  <th className="p-4 font-bold text-right">Điểm số</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedParticipants.map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mx-auto ${
                        idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
                        idx === 1 ? 'bg-gray-200 text-gray-700' : 
                        idx === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-500'
                      }`}>
                        {idx + 1}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={p.avatar} className="w-10 h-10 rounded-full border border-gray-200" alt="" />
                        <span className="font-bold text-gray-800">{p.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold text-green-600">{p.studentCode}</span>
                        <span className="text-xs">{p.className}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {p.status === 'finished' ? (
                        <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">Hoàn thành</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">Chưa nộp</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-lg font-bold text-gray-900">{p.score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER LIST VIEW ---
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <History className="text-green-600" /> Lịch sử kỳ thi
          </h2>
          <p className="text-gray-500 mt-1">Quản lý và xem lại kết quả các kỳ thi đã tổ chức.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm kiếm kỳ thi..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 w-full md:w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <History size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Chưa có lịch sử thi nào được ghi nhận.</p>
          </div>
        ) : (
          filteredSessions.map((session) => {
            const participantCount = session.participants.length;
            const avg = participantCount > 0 
                ? (session.participants.reduce((a, b) => a + b.score, 0) / participantCount).toFixed(1) 
                : '0';

            return (
              <div key={session.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-green-200 transition-all flex flex-col md:flex-row items-center gap-6 group">
                <div className="p-4 bg-green-50 text-green-600 rounded-xl">
                  <Award size={24} />
                </div>
                
                <div className="flex-1 w-full text-center md:text-left">
                  <h3 className="text-lg font-bold text-gray-800 mb-1">{session.examTitle}</h3>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(session.date).toLocaleString('vi-VN')}</span>
                    <span className="flex items-center gap-1"><Users size={14} /> {participantCount} thí sinh</span>
                  </div>
                </div>

                <div className="text-center px-4 md:border-l border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-bold">Điểm TB</p>
                  <p className="text-2xl font-black text-green-600">{avg}</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => setSelectedSession(session)}
                    className="flex-1 md:flex-none px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={18} /> Chi tiết
                  </button>
                  <button 
                    onClick={() => handleDeleteSession(session.id)}
                    className="px-3 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                    title="Xóa lịch sử"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ExamHistory;