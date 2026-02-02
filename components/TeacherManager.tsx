import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Trash2, Edit, Key, Shield, Mail, Phone, Save, X, Briefcase, CheckCircle } from 'lucide-react';
import { Teacher, TeacherRole } from '../types';

const TeacherManager: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null); // Logged in user
  
  // Form State
  const [formData, setFormData] = useState<Partial<Teacher>>({});

  useEffect(() => {
    loadTeachers();
    const storedCurrent = localStorage.getItem('bamboo_current_teacher');
    if (storedCurrent) setCurrentTeacher(JSON.parse(storedCurrent));
  }, []);

  const loadTeachers = () => {
    const stored = localStorage.getItem('bamboo_teachers');
    if (stored) {
      setTeachers(JSON.parse(stored));
    }
  };

  const saveTeachers = (newList: Teacher[]) => {
    setTeachers(newList);
    localStorage.setItem('bamboo_teachers', JSON.stringify(newList));
  };

  const handleAddNew = () => {
    setFormData({
      username: '',
      password: '',
      fullName: '',
      subject: '',
      school: '',
      email: '',
      phone: '',
      role: TeacherRole.TEACHER // Default role
    });
    setIsEditing(true);
  };

  const handleEdit = (teacher: Teacher) => {
    setFormData({ ...teacher });
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (id === currentTeacher?.id) {
      alert("Bạn không thể xóa tài khoản đang đăng nhập!");
      return;
    }
    if (id === 'tiennv') {
        alert("Không thể xóa tài khoản Super Admin mặc định!");
        return;
    }
    if (confirm("Bạn có chắc chắn muốn xóa giáo viên này? Hành động này không thể hoàn tác.")) {
      const newList = teachers.filter(t => t.id !== id);
      saveTeachers(newList);
    }
  };

  const handleResetPassword = (id: string) => {
    const newPass = prompt("Nhập mật khẩu mới cho giáo viên này:", "123456");
    if (newPass) {
      const newList = teachers.map(t => t.id === id ? { ...t, password: newPass } : t);
      saveTeachers(newList);
      alert("Đã đổi mật khẩu thành công!");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.fullName) {
      alert("Vui lòng điền tên đăng nhập và họ tên!");
      return;
    }

    // Check duplicate username if creating new
    if (!formData.id && teachers.some(t => t.username === formData.username)) {
      alert("Tên đăng nhập đã tồn tại!");
      return;
    }

    if (formData.id) {
      // Update
      const newList = teachers.map(t => t.id === formData.id ? { ...t, ...formData } as Teacher : t);
      
      // If updating self, update session storage too
      if (formData.id === currentTeacher?.id) {
         localStorage.setItem('bamboo_current_teacher', JSON.stringify({ ...currentTeacher, ...formData }));
      }
      
      saveTeachers(newList);
    } else {
      // Create
      const newTeacher: Teacher = {
        id: `teacher_${Date.now()}`,
        username: formData.username!,
        password: formData.password || '123456',
        fullName: formData.fullName!,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.fullName!)}&background=random`,
        subject: formData.subject || 'Giáo viên',
        school: formData.school || 'Bamboo School',
        email: formData.email,
        phone: formData.phone,
        role: formData.role || TeacherRole.TEACHER
      };
      saveTeachers([...teachers, newTeacher]);
    }
    setIsEditing(false);
  };

  const filteredTeachers = teachers.filter(t => 
    t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAdmin = currentTeacher?.role === TeacherRole.ADMIN;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="text-green-600" /> Quản lý Giáo viên
          </h2>
          <p className="text-gray-500 mt-1">Danh sách tài khoản và phân quyền truy cập hệ thống.</p>
        </div>
        {isAdmin && (
            <button 
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium"
            >
            <Plus size={18} /> Thêm giáo viên
            </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative">
         <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
         <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo tên, tài khoản hoặc môn học..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-200"
         />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                     <th className="p-4 font-semibold">Giáo viên</th>
                     <th className="p-4 font-semibold">Tài khoản</th>
                     <th className="p-4 font-semibold">Vai trò</th>
                     <th className="p-4 font-semibold">Công tác</th>
                     {isAdmin && <th className="p-4 font-semibold text-center">Hành động</th>}
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {filteredTeachers.map(teacher => (
                     <tr key={teacher.id} className="hover:bg-green-50/30 transition-colors">
                        <td className="p-4">
                           <div className="flex items-center gap-3">
                              <img src={teacher.avatar} alt="avt" className="w-10 h-10 rounded-full border border-gray-200 object-cover" />
                              <div>
                                 <p className="font-bold text-gray-800 flex items-center gap-1">
                                    {teacher.fullName}
                                    {teacher.id === currentTeacher?.id && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">You</span>}
                                 </p>
                                 <p className="text-xs text-gray-500">{teacher.subject}</p>
                              </div>
                           </div>
                        </td>
                        <td className="p-4 font-mono text-sm text-green-600 font-medium">
                           {teacher.username}
                        </td>
                        <td className="p-4 text-sm">
                           {teacher.role === TeacherRole.ADMIN ? (
                               <span className="flex items-center gap-1 text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded w-fit">
                                   <Shield size={12} fill="currentColor" /> Admin
                               </span>
                           ) : (
                               <span className="text-gray-600 bg-gray-100 px-2 py-1 rounded w-fit">Giáo viên</span>
                           )}
                        </td>
                        <td className="p-4 text-sm">
                           {teacher.school ? (
                               <span className="px-2 py-1 bg-gray-100 rounded text-gray-600 text-xs font-medium">{teacher.school}</span>
                           ) : <span className="text-gray-400">--</span>}
                        </td>
                        {isAdmin && (
                            <td className="p-4 text-center">
                            <div className="flex justify-center gap-2">
                                <button onClick={() => handleEdit(teacher)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Sửa thông tin">
                                    <Edit size={16} />
                                </button>
                                <button onClick={() => handleResetPassword(teacher.id)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg" title="Đổi mật khẩu">
                                    <Key size={16} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(teacher.id)} 
                                    className={`p-2 rounded-lg ${teacher.id === currentTeacher?.id || teacher.id === 'tiennv' ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`} 
                                    title="Xóa tài khoản"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            </td>
                        )}
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Modal / Slide-over for Add/Edit */}
      {isEditing && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-lg text-gray-800">
                     {formData.id ? 'Chỉnh sửa thông tin' : 'Thêm giáo viên mới'}
                  </h3>
                  <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600">
                     <X size={24} />
                  </button>
               </div>
               
               <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2 md:col-span-1 space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Họ và tên <span className="text-red-500">*</span></label>
                        <input 
                           type="text" 
                           value={formData.fullName || ''} 
                           onChange={e => setFormData({...formData, fullName: e.target.value})}
                           className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-green-500 outline-none"
                           required
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên đăng nhập <span className="text-red-500">*</span></label>
                        <input 
                           type="text" 
                           value={formData.username || ''} 
                           onChange={e => setFormData({...formData, username: e.target.value})}
                           className={`w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-green-500 outline-none ${formData.id ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                           readOnly={!!formData.id}
                           required
                        />
                     </div>
                     {!formData.id && (
                        <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mật khẩu khởi tạo</label>
                           <input 
                              type="text" 
                              value={formData.password || ''} 
                              onChange={e => setFormData({...formData, password: e.target.value})}
                              placeholder="Mặc định: 123456"
                              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-green-500 outline-none"
                           />
                        </div>
                     )}
                  </div>

                  <div className="col-span-2 md:col-span-1 space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Môn giảng dạy</label>
                        <div className="relative">
                            <Briefcase size={16} className="absolute left-3 top-2.5 text-gray-400" />
                            <input 
                               type="text" 
                               value={formData.subject || ''} 
                               onChange={e => setFormData({...formData, subject: e.target.value})}
                               className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-green-500 outline-none"
                            />
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Trường công tác</label>
                        <input 
                           type="text" 
                           value={formData.school || ''} 
                           onChange={e => setFormData({...formData, school: e.target.value})}
                           className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-green-500 outline-none"
                        />
                     </div>
                     {isAdmin && (
                         <div className="pt-2">
                             <label className="flex items-center gap-2 cursor-pointer p-3 border border-green-200 rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
                                 <input 
                                     type="checkbox" 
                                     checked={formData.role === TeacherRole.ADMIN}
                                     onChange={(e) => setFormData({...formData, role: e.target.checked ? TeacherRole.ADMIN : TeacherRole.TEACHER})}
                                     className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                     disabled={formData.id === 'tiennv'} // Cannot downgrade tiennv
                                 />
                                 <span className="text-sm font-bold text-green-900">Uỷ quyền Admin (Thêm giáo viên)</span>
                             </label>
                         </div>
                     )}
                  </div>

                  <div className="col-span-2 pt-4 border-t border-gray-100 flex justify-end gap-3">
                     <button 
                        type="button" 
                        onClick={() => setIsEditing(false)}
                        className="px-6 py-2 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
                     >
                        Hủy bỏ
                     </button>
                     <button 
                        type="submit" 
                        className="px-6 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-200"
                     >
                        <Save size={18} className="inline mr-2" />
                        Lưu thông tin
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
};

export default TeacherManager;