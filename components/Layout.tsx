import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  Gamepad2, 
  Store, 
  Users, 
  Settings, 
  LogOut,
  Bell,
  Search,
  UserCircle,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Menu,
  Library, // Added icon
  History // Added icon for Exam History
} from 'lucide-react';
import { Teacher } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [logoSrc, setLogoSrc] = useState('./logo.png');
  
  // State for collapsible sidebar sections
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    main: true,
    manage: true,
    resource: true
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Toggle sidebar width

  useEffect(() => {
    const stored = localStorage.getItem('bamboo_current_teacher');
    if (stored) {
        setCurrentTeacher(JSON.parse(stored));
    }

    // Function to load logo
    const loadLogo = () => {
        const storedLogo = localStorage.getItem('bamboo_system_logo');
        setLogoSrc(storedLogo || './logo.png');
    };

    // Initial load
    loadLogo();

    // Listen for global updates (from TeacherProfile)
    window.addEventListener('bamboo_logo_update', loadLogo);

    return () => {
        window.removeEventListener('bamboo_logo_update', loadLogo);
    };
  }, []);

  const handleLogout = () => {
      if (onLogout) {
          onLogout();
      } else {
          localStorage.removeItem('bamboo_current_teacher');
          navigate('/login');
          window.location.reload();
      }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Navigation Configuration
  const navGroups = [
    {
      id: 'main',
      title: 'TỔNG QUAN',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      ]
    },
    {
      id: 'manage',
      title: 'QUẢN LÝ ĐÀO TẠO',
      items: [
        { label: 'Ngân hàng câu hỏi', icon: Library, path: '/question-bank' },
        { label: 'Ngân hàng đề', icon: BookOpen, path: '/exams' },
        { label: 'Tổ chức thi', icon: Gamepad2, path: '/battle' },
        { label: 'Lịch sử kỳ thi', icon: History, path: '/history' }, // New Item
        { label: 'Lớp học & Học sinh', icon: Users, path: '/classes' },
        { label: 'Đội ngũ giáo viên', icon: Briefcase, path: '/teachers' },
      ]
    },
    {
      id: 'resource',
      title: 'TÀI NGUYÊN & CỘNG ĐỒNG',
      items: [
        { label: 'Chợ nội dung', icon: Store, path: '/marketplace' },
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`bg-slate-900 text-white flex flex-col shadow-xl z-20 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-72' : 'w-20'} overflow-hidden border-r border-slate-800 hidden md:flex`}
      >
        {/* Brand Area */}
        <div className="p-6 flex items-center gap-3 shrink-0 h-20 bg-slate-950">
          <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg p-0.5 overflow-hidden shrink-0">
            <img 
                src={logoSrc}
                alt="Logo" 
                className="w-full h-full object-contain bg-white rounded-lg"
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                        parent.innerHTML = '<span class="font-bold text-lg text-white">B</span>';
                    }
                }}
            />
          </div>
          <div className={`transition-opacity duration-200 overflow-hidden whitespace-nowrap ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
            <h1 className="font-bold text-lg tracking-wide text-white">Bamboo AI</h1>
            <p className="text-[10px] text-green-400 font-bold tracking-wider uppercase">Enterprise</p>
          </div>
        </div>

        {/* Navigation Area */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.id} className="mb-6">
              {/* Group Header */}
              {isSidebarOpen && (
                <div 
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center justify-between px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-slate-300 transition-colors select-none"
                >
                  <span>{group.title}</span>
                  {expandedGroups[group.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>
              )}

              {/* Group Separator when collapsed */}
              {!isSidebarOpen && (
                 <div className="h-px bg-slate-800 mx-2 my-3"></div>
              )}

              {/* Group Items */}
              <div className={`space-y-1 ${!expandedGroups[group.id] && isSidebarOpen ? 'hidden' : 'block'}`}>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      title={!isSidebarOpen ? item.label : ''}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative hover:scale-[1.02] hover:translate-x-1 hover:shadow-lg ${
                        isActive 
                          ? 'bg-green-600 text-white shadow-md shadow-green-900/20' 
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon size={20} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                      <span className={`font-medium text-sm whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute left-10 pointer-events-none'}`}>
                        {item.label}
                      </span>
                      
                      {/* Tooltip for collapsed state */}
                      {!isSidebarOpen && (
                        <div className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-lg border border-slate-700">
                          {item.label}
                        </div>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Area */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 shrink-0 space-y-1">
          <button 
            onClick={() => navigate('/profile')}
            className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-lg transition-all duration-200 group hover:scale-[1.02] hover:translate-x-1 hover:shadow-lg ${location.pathname === '/profile' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title={!isSidebarOpen ? "Cài đặt" : ""}
          >
            <Settings size={20} className="group-hover:rotate-45 transition-transform duration-300" />
            <span className={`${isSidebarOpen ? 'block' : 'hidden'} text-sm font-medium`}>Cài đặt</span>
          </button>
          <button 
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full rounded-lg transition-all duration-200 group hover:scale-[1.02] hover:translate-x-1 hover:shadow-lg`}
            title={!isSidebarOpen ? "Đăng xuất" : ""}
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className={`${isSidebarOpen ? 'block' : 'hidden'} text-sm font-medium`}>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 focus:outline-none hidden md:block"
            >
                <Menu size={20} />
            </button>
            {/* Mobile Menu Button - usually would trigger a drawer, simplified here to just toggle or show something */}
            <div className="md:hidden p-2 rounded-lg bg-green-50 text-green-700">
               <span className="font-bold">Bamboo AI</span>
            </div>

            <div className="hidden md:flex items-center bg-gray-100 rounded-full px-4 py-2 w-96 transition-all focus-within:ring-2 focus-within:ring-green-100 focus-within:bg-white border border-transparent focus-within:border-green-200">
              <Search size={18} className="text-gray-400" />
              <input 
                type="text" 
                placeholder="Tìm kiếm..." 
                className="bg-transparent border-none outline-none text-sm ml-2 w-full text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            <div className="relative cursor-pointer group">
              <div className="p-2 rounded-full group-hover:bg-gray-100 transition-colors">
                <Bell size={20} className="text-gray-600 group-hover:text-green-600 transition-colors" />
              </div>
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            </div>
            
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

            <div 
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 pl-3 rounded-full border border-transparent hover:border-gray-200 transition-all group"
                onClick={() => navigate('/profile')}
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800 leading-none group-hover:text-green-700 transition-colors">{currentTeacher?.fullName || 'Teacher'}</p>
                <p className="text-[10px] text-gray-500 font-medium uppercase mt-1 group-hover:text-green-600">{currentTeacher?.subject || 'Giáo viên'}</p>
              </div>
              {currentTeacher?.avatar ? (
                 <img 
                    src={currentTeacher.avatar} 
                    alt="User" 
                    className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover group-hover:border-green-200 transition-all"
                />
              ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                      <UserCircle size={20} />
                  </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/50 scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;