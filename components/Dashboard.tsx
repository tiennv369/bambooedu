import React, { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, Users, FileText, Award, History, AlertTriangle } from 'lucide-react';
import { Student, Exam, ExamSession, Teacher } from '../types';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const StatCard: React.FC<{ label: string; value: string; subValue?: string; icon: any; color: string; onClick?: () => void }> = ({ label, value, subValue, icon: Icon, color, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] hover:border-green-200' : ''}`}
  >
    <div>
      <p className="text-sm text-gray-500 font-medium mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
      {subValue && (
        <p className={`text-xs font-semibold mt-2 text-gray-400`}>
          {subValue}
        </p>
      )}
    </div>
    <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
      <Icon className={color.replace('bg-', 'text-')} size={24} />
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  // State for metrics
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalExams: 0,
    totalSessions: 0,
    avgScore: 0
  });

  // State for Charts
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [subjectData, setSubjectData] = useState<any[]>([]);
  const [suggestion, setSuggestion] = useState({ subject: '', message: '' });

  useEffect(() => {
    // 0. Get Current Teacher
    const storedTeacherStr = localStorage.getItem('bamboo_current_teacher');
    if (!storedTeacherStr) return;
    const currentTeacher: Teacher = JSON.parse(storedTeacherStr);
    const tid = currentTeacher.id;

    // 1. Fetch Data specific to teacher
    const storedStudents: Student[] = JSON.parse(localStorage.getItem(`bamboo_${tid}_students`) || '[]');
    const storedExams: Exam[] = JSON.parse(localStorage.getItem(`bamboo_${tid}_exams`) || '[]');
    const storedHistory: ExamSession[] = JSON.parse(localStorage.getItem(`bamboo_${tid}_exam_history`) || '[]');

    // 2. Calculate Basic Stats
    let globalTotalScore = 0;
    let globalTotalParticipants = 0;

    storedHistory.forEach(session => {
        const sessionTotal = session.participants.reduce((sum, p) => sum + p.score, 0);
        globalTotalScore += sessionTotal;
        globalTotalParticipants += session.participants.length;
    });

    const calculatedAvgScore = globalTotalParticipants > 0 
        ? (globalTotalScore / globalTotalParticipants).toFixed(1) 
        : '0';

    setStats({
        totalStudents: storedStudents.length,
        totalExams: storedExams.length,
        totalSessions: storedHistory.length,
        avgScore: Number(calculatedAvgScore)
    });

    // 3. Process Chart Data: Performance (Last 5 sessions)
    // Sort history by date ascending for the chart
    const sortedHistory = [...storedHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const recentSessions = sortedHistory.slice(-5); // Take last 5

    const chartData = recentSessions.map(session => {
        const sessionAvg = session.participants.length > 0
            ? Math.round(session.participants.reduce((sum, p) => sum + p.score, 0) / session.participants.length)
            : 0;
        // Truncate title for X-Axis
        const shortTitle = session.examTitle.length > 15 ? session.examTitle.substring(0, 15) + '...' : session.examTitle;
        return {
            name: shortTitle,
            fullName: session.examTitle,
            date: new Date(session.date).toLocaleDateString('vi-VN'),
            score: sessionAvg
        };
    });
    setPerformanceData(chartData);

    // 4. Process Chart Data: Subject Distribution
    const subjectCounts: Record<string, number> = {};
    storedExams.forEach(exam => {
        const sub = exam.subject || 'Khác';
        subjectCounts[sub] = (subjectCounts[sub] || 0) + 1;
    });

    const pieData = Object.keys(subjectCounts).map(subject => ({
        name: subject,
        value: subjectCounts[subject]
    }));
    setSubjectData(pieData);

    // 5. Generate Suggestion
    if (storedExams.length === 0) {
        setSuggestion({ subject: 'Ngân hàng đề', message: 'Bạn chưa có đề thi nào. Hãy tạo đề thi đầu tiên ngay!' });
    } else {
        const subjects = Object.keys(subjectCounts);
        if (subjects.length > 0) {
            // Find subject with fewest exams to recommend creating more
            const minSubject = subjects.reduce((a, b) => subjectCounts[a] < subjectCounts[b] ? a : b);
            setSuggestion({ 
                subject: minSubject, 
                message: `Môn ${minSubject} hiện có ít đề thi nhất (${subjectCounts[minSubject]}). Hãy bổ sung thêm ngân hàng câu hỏi.` 
            });
        }
    }

  }, []);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tổng quan</h2>
          <p className="text-gray-500 mt-1">Số liệu thực tế từ hệ thống Bamboo AI.</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-1 flex gap-2 text-sm font-medium">
          <button className="px-3 py-1 bg-green-50 text-green-600 rounded-md">Real-time</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            label="Tổng học sinh" 
            value={stats.totalStudents.toString()} 
            subValue="Xem danh sách lớp"
            icon={Users} 
            color="bg-blue-500" 
            onClick={() => navigate('/classes')}
        />
        <StatCard 
            label="Ngân hàng đề" 
            value={stats.totalExams.toString()} 
            subValue="Quản lý kho đề"
            icon={FileText} 
            color="bg-purple-500" 
            onClick={() => navigate('/exams', { state: { activeTab: 'bank' } })}
        />
        <StatCard 
            label="Kỳ thi đã tổ chức" 
            value={stats.totalSessions.toString()} 
            subValue="Xem lịch sử thi"
            icon={History} 
            color="bg-green-500" 
            onClick={() => navigate('/battle', { state: { initialPhase: 'history' } })}
        />
        <StatCard 
            label="Điểm trung bình" 
            value={stats.avgScore.toString()} 
            subValue="Phân tích chi tiết"
            icon={Award} 
            color="bg-orange-500" 
            onClick={() => navigate('/classes')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Điểm trung bình các kỳ thi gần nhất</h3>
          <div className="h-72">
            {performanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: any) => [`${value} điểm`, 'Điểm TB']}
                    labelFormatter={(label, payload) => payload[0]?.payload.fullName || label}
                    />
                    <Line type="monotone" dataKey="score" stroke="#10B981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <History size={48} className="mb-2 opacity-50" />
                    <p>Chưa có dữ liệu thi đấu</p>
                </div>
            )}
          </div>
        </div>

        {/* Knowledge Analysis */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Phân bổ ngân hàng đề</h3>
          <div className="h-48 mb-4 flex-1">
             {subjectData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                        data={subjectData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        >
                        {subjectData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <FileText size={48} className="mb-2 opacity-50" />
                    <p>Chưa có đề thi</p>
                </div>
             )}
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-2 justify-center mb-4">
              {subjectData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1 text-xs text-gray-600">
                      <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></span>
                      {entry.name}
                  </div>
              ))}
          </div>

          <div className="mt-auto space-y-3">
             <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex items-start gap-3">
                <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                <div>
                    <p className="text-xs text-orange-600 font-bold uppercase tracking-wider mb-1">Gợi ý AI</p>
                    <p className="text-sm text-gray-700">
                        {suggestion.message || "Hệ thống đang phân tích dữ liệu..."}
                    </p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;