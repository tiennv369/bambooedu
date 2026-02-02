import React, { useState, useEffect } from 'react';
import { User, Lock, ArrowRight, AlertCircle, Sprout } from 'lucide-react';
import { Teacher, TeacherRole } from '../types';

interface TeacherLoginProps {
  onLogin: (teacher: Teacher) => void;
}

const TeacherLogin: React.FC<TeacherLoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [logoSrc, setLogoSrc] = useState('./logo.png');

  useEffect(() => {
    const storedLogo = localStorage.getItem('bamboo_system_logo');
    if (storedLogo) {
        setLogoSrc(storedLogo);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let storedTeachers: Teacher[] = JSON.parse(localStorage.getItem('bamboo_teachers') || '[]');
    
    // Check if system is empty, seed default user 'tiennv'
    if (storedTeachers.length === 0) {
       const superAdmin: Teacher = {
           id: 'tiennv',
           username: 'tiennv',
           password: '123456', 
           fullName: 'Tiến NV',
           avatar: 'https://ui-avatars.com/api/?name=Tien+NV&background=random',
           subject: 'Quản trị hệ thống',
           role: TeacherRole.ADMIN // Quyền cao nhất
       };
       storedTeachers = [superAdmin];
       localStorage.setItem('bamboo_teachers', JSON.stringify(storedTeachers));
    }

    const teacher = storedTeachers.find(t => t.username === username && t.password === password);
    
    if (teacher) {
      onLogin(teacher);
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không đúng!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Brand */}
        <div className="md:w-1/2 bg-green-50 p-12 flex flex-col justify-center items-center text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" 
                style={{ backgroundImage: 'radial-gradient(#059669 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
           </div>
           
           <div className="w-32 h-32 bg-white rounded-3xl flex items-center justify-center shadow-lg mb-6 p-4 rotate-3 transform hover:rotate-0 transition-all duration-500 overflow-hidden">
              {!logoError ? (
                <img 
                    src={logoSrc} 
                    alt="Bamboo AI" 
                    className="w-full h-full object-contain" 
                    onError={() => setLogoError(true)}
                />
              ) : (
                <Sprout size={64} className="text-green-600" />
              )}
           </div>
           <h1 className="text-3xl font-bold text-gray-800 mb-2">Bamboo AI</h1>
           <p className="text-green-600 font-medium">Nền tảng quản lý & khảo thí thông minh</p>
           <div className="mt-8 text-sm text-gray-500">
             Hệ thống nội bộ dành cho Giáo viên
           </div>
        </div>

        {/* Right Side: Form */}
        <div className="md:w-1/2 p-12 flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Đăng nhập hệ thống
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Tên đăng nhập</label>
                <div className="relative">
                    <User className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100 outline-none transition-all"
                        placeholder="Nhập tên đăng nhập"
                        required
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Mật khẩu</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100 outline-none transition-all"
                        placeholder="••••••••"
                        required
                    />
                </div>
            </div>

            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 mt-4">
               Đăng nhập <ArrowRight size={20} />
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-400">
              <p className="mt-2 text-xs">Vui lòng liên hệ quản trị viên nếu quên mật khẩu.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherLogin;