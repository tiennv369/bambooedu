import React, { useState, useRef, useEffect } from 'react';
import { Users, Upload, Download, Search, FileSpreadsheet, Plus, Filter, Trash2, Key, CheckSquare, Square, X, Save, Edit } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, Teacher } from '../types';

const ClassManager: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // Track ID for editing
  const [newStudent, setNewStudent] = useState<Partial<Student>>({
      studentCode: '',
      name: '',
      password: '123456',
      gender: 'Nam',
      grade: '12',
      className: ''
  });

  // Load teacher first, then their students
  useEffect(() => {
    const storedTeacher = localStorage.getItem('bamboo_current_teacher');
    if (storedTeacher) {
        const teacher = JSON.parse(storedTeacher);
        setCurrentTeacher(teacher);
        
        // Load Students specific to this teacher
        const storageKey = `bamboo_${teacher.id}_students`;
        const storedStudents = localStorage.getItem(storageKey);
        
        if (storedStudents) {
            try {
                setStudents(JSON.parse(storedStudents));
            } catch (e) { console.error(e); }
        } else {
            setStudents([]); 
        }
    }
  }, []);

  // Save to scoped LocalStorage whenever students change
  useEffect(() => {
      if (currentTeacher && students.length >= 0) { // Allow saving empty array
        const storageKey = `bamboo_${currentTeacher.id}_students`;
        localStorage.setItem(storageKey, JSON.stringify(students));
      }
  }, [students, currentTeacher]);

  const [filterClass, setFilterClass] = useState('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to create and download template
  const downloadTemplate = () => {
    const templateData = [
      {
        "Mã học sinh": "HS001",
        "Mật khẩu": "123456",
        "Họ tên": "Nguyễn Văn A",
        "Giới tính": "Nam",
        "Ngày sinh": "15/05/2006",
        "Khối lớp": "12",
        "Lớp học": "12A1"
      },
      {
        "Mã học sinh": "HS002",
        "Mật khẩu": "123456",
        "Họ tên": "Trần Thị B",
        "Giới tính": "Nữ",
        "Ngày sinh": "20/10/2006",
        "Khối lớp": "12",
        "Lớp học": "12A2"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Danh_Sach");
    XLSX.writeFile(wb, "Mau_Nhap_Hoc_Sinh.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      processImportedData(data);
    };
    reader.readAsBinaryString(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processImportedData = (data: any[]) => {
    const newStudents: Student[] = data.map((row: any, index) => ({
      id: `imported_${Date.now()}_${index}`,
      studentCode: String(row['Mã học sinh'] || `UNKNOWN_${index}`).toUpperCase().trim(),
      password: String(row['Mật khẩu'] || '123456'), // Default password
      name: row['Họ tên'] || 'Chưa có tên',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(row['Họ tên'] || 'User')}&background=random`,
      gender: row['Giới tính'],
      dob: row['Ngày sinh'],
      grade: row['Khối lớp'] ? String(row['Khối lớp']) : '',
      className: row['Lớp học'] || 'Chưa phân lớp',
      score: 0,
      progress: 0,
      streak: 0,
      status: 'offline'
    }));

    const updatedList = [...students, ...newStudents];
    setStudents(updatedList);
    // Logic inside useEffect handles saving
    alert(`Đã nhập thành công ${newStudents.length} học sinh!`);
  };

  const handleSaveStudent = () => {
      if (!newStudent.studentCode || !newStudent.name) {
          alert("Vui lòng nhập Mã học sinh và Họ tên!");
          return;
      }
      
      const cleanCode = newStudent.studentCode.trim().toUpperCase();

      // Check duplicate
      const isDuplicate = students.some(s => 
          s.studentCode === cleanCode && s.id !== editingId
      );

      if (isDuplicate) {
          alert("Mã học sinh này đã tồn tại!");
          return;
      }

      if (editingId) {
          // UPDATE EXISTING
          const updatedList = students.map(s => {
              if (s.id === editingId) {
                  return {
                      ...s,
                      ...newStudent,
                      studentCode: cleanCode,
                      gender: newStudent.gender as any, // Cast for safety
                      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newStudent.name || '')}&background=random`,
                  };
              }
              return s;
          });
          setStudents(updatedList);
          setEditingId(null);
      } else {
          // CREATE NEW
          const s: Student = {
              id: `manual_${Date.now()}`,
              studentCode: cleanCode,
              name: newStudent.name,
              password: newStudent.password || '123456',
              gender: newStudent.gender as any,
              grade: newStudent.grade,
              className: newStudent.className || 'Chưa phân lớp',
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newStudent.name)}&background=random`,
              score: 0,
              progress: 0,
              streak: 0,
              status: 'offline'
          };
          setStudents([s, ...students]);
      }

      setIsAdding(false);
      setNewStudent({
          studentCode: '',
          name: '',
          password: '123456',
          gender: 'Nam',
          grade: '12',
          className: ''
      });
  };

  const handleEdit = (student: Student) => {
      setNewStudent({
          studentCode: student.studentCode,
          name: student.name,
          password: student.password,
          gender: student.gender,
          grade: student.grade,
          className: student.className
      });
      setEditingId(student.id);
      setIsAdding(true);
  };

  const removeStudent = (id: string) => {
      if(confirm("Bạn có chắc chắn muốn xóa học sinh này?")) {
        const updated = students.filter(s => s.id !== id);
        setStudents(updated);
        setSelectedIds(prev => prev.filter(sid => sid !== id));
      }
  };

  // --- Bulk Selection Logic ---
  const handleSelectAll = (filteredData: Student[]) => {
      if (isAllSelected) {
          // Deselect currently filtered items
          const idsToDeselect = filteredData.map(s => s.id);
          setSelectedIds(prev => prev.filter(id => !idsToDeselect.includes(id)));
      } else {
          // Select all filtered items (merge with existing selection)
          const newIds = filteredData.map(s => s.id);
          const uniqueIds = Array.from(new Set([...selectedIds, ...newIds]));
          setSelectedIds(uniqueIds);
      }
  };

  const handleSelectOne = (id: string) => {
      if (selectedIds.includes(id)) {
          setSelectedIds(prev => prev.filter(sid => sid !== id));
      } else {
          setSelectedIds(prev => [...prev, id]);
      }
  };

  const handleBulkDelete = () => {
      if (selectedIds.length === 0) return;
      
      if (confirm(`CẢNH BÁO: Bạn sắp xóa ${selectedIds.length} học sinh.\nHành động này không thể hoàn tác!`)) {
          const updated = students.filter(s => !selectedIds.includes(s.id));
          setStudents(updated);
          setSelectedIds([]);
      }
  };

  const resetModal = () => {
      setIsAdding(false);
      setEditingId(null);
      setNewStudent({
          studentCode: '',
          name: '',
          password: '123456',
          gender: 'Nam',
          grade: '12',
          className: ''
      });
  };

  const uniqueClasses = ['All', ...Array.from(new Set(students.map(s => s.className).filter(Boolean)))];

  const filteredStudents = filterClass === 'All' 
    ? students 
    : students.filter(s => s.className === filterClass);

  const isAllSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedIds.includes(s.id));

  if (!currentTeacher) return null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-green-600" /> Quản lý Lớp & Học sinh
          </h2>
          <p className="text-gray-500 mt-1">Quản lý danh sách, mật khẩu truy cập và phân lớp.</p>
        </div>
        
        <div className="flex gap-2">
           <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm"
          >
            <Download size={16} />
            Tải mẫu
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium text-sm"
          >
            <FileSpreadsheet size={16} />
            Nhập Excel
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />

          <button 
            onClick={() => { resetModal(); setIsAdding(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium text-sm"
          >
            <Plus size={16} />
            Thêm mới
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
             <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Tìm kiếm theo tên hoặc mã học sinh..." 
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-200"
                />
            </div>
            {/* Bulk Delete Button */}
            {selectedIds.length > 0 && (
                <button 
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors animate-in fade-in zoom-in font-bold text-sm"
                >
                    <Trash2 size={16} /> Xóa {selectedIds.length} đã chọn
                </button>
            )}
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter size={18} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Lọc theo lớp:</span>
          <select 
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-green-500 bg-white"
          >
            {uniqueClasses.map(c => (
              <option key={c} value={c as string}>{c === 'All' ? 'Tất cả lớp' : c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-4 w-12 text-center">
                    <button 
                        onClick={() => handleSelectAll(filteredStudents)}
                        className="text-gray-400 hover:text-green-600 transition-colors"
                        title="Chọn tất cả trong danh sách này"
                    >
                        {isAllSelected ? <CheckSquare className="text-green-600" size={20} /> : <Square size={20} />}
                    </button>
                </th>
                <th className="p-4 font-semibold">Học sinh</th>
                <th className="p-4 font-semibold">Mã HS / Mật khẩu</th>
                <th className="p-4 font-semibold">Thông tin</th>
                <th className="p-4 font-semibold">Lớp</th>
                <th className="p-4 font-semibold">Điểm tích lũy</th>
                <th className="p-4 font-semibold text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                 <tr>
                   <td colSpan={7} className="p-8 text-center text-gray-400">
                     Không tìm thấy học sinh nào trong cơ sở dữ liệu của bạn.
                   </td>
                 </tr>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedIds.includes(student.id);
                  return (
                    <tr key={student.id} className={`transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-green-50/30'}`}>
                      <td className="p-4 text-center">
                          <button 
                              onClick={() => handleSelectOne(student.id)}
                              className="text-gray-400 hover:text-green-600 transition-colors"
                          >
                              {isSelected ? <CheckSquare className="text-green-600" size={20} /> : <Square size={20} />}
                          </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img src={student.avatar} alt={student.name} className="w-10 h-10 rounded-full border border-gray-200" />
                          <div>
                            <p className="font-bold text-gray-800">{student.name}</p>
                            <p className={`text-xs ${student.status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>● {student.status}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm">
                          <div className="font-mono text-green-600 font-bold">{student.studentCode}</div>
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                              <Key size={12} /> {student.password || '123456'}
                          </div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        <div className="flex flex-col">
                          <span><span className="text-gray-400 text-xs">Giới tính:</span> {student.gender}</span>
                          <span><span className="text-gray-400 text-xs">Ngày sinh:</span> {student.dob || '--'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                          {student.className} (K{student.grade})
                        </span>
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-800">{student.score} pts</td>
                      <td className="p-4 text-center">
                         <div className="flex justify-center gap-1">
                             <button onClick={() => handleEdit(student)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Sửa thông tin">
                                <Edit size={18} />
                             </button>
                             <button onClick={() => removeStudent(student.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Xóa học sinh">
                                <Trash2 size={18} />
                             </button>
                         </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Student Modal */}
      {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                      <h3 className="font-bold text-lg text-gray-800">
                          {editingId ? 'Cập nhật thông tin học sinh' : 'Thêm học sinh mới'}
                      </h3>
                      <button onClick={resetModal} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                  </div>
                  
                  <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                              <label className="text-xs font-bold text-gray-500 uppercase">Họ và tên</label>
                              <input 
                                  type="text" 
                                  value={newStudent.name} 
                                  onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                                  className="w-full px-4 py-2 mt-1 border border-gray-200 rounded-lg outline-none focus:border-green-500"
                                  placeholder="Nguyễn Văn A"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase">Mã học sinh</label>
                              <input 
                                  type="text" 
                                  value={newStudent.studentCode} 
                                  onChange={e => setNewStudent({...newStudent, studentCode: e.target.value.toUpperCase()})}
                                  className={`w-full px-4 py-2 mt-1 border border-gray-200 rounded-lg outline-none focus:border-green-500 font-mono`}
                                  placeholder="HS001"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase">Mật khẩu</label>
                              <input 
                                  type="text" 
                                  value={newStudent.password} 
                                  onChange={e => setNewStudent({...newStudent, password: e.target.value})}
                                  className="w-full px-4 py-2 mt-1 border border-gray-200 rounded-lg outline-none focus:border-green-500 font-mono"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase">Lớp học</label>
                              <input 
                                  type="text" 
                                  value={newStudent.className} 
                                  onChange={e => setNewStudent({...newStudent, className: e.target.value.toUpperCase()})}
                                  className="w-full px-4 py-2 mt-1 border border-gray-200 rounded-lg outline-none focus:border-green-500"
                                  placeholder="12A1"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase">Khối lớp</label>
                              <select 
                                  value={newStudent.grade} 
                                  onChange={e => setNewStudent({...newStudent, grade: e.target.value})}
                                  className="w-full px-4 py-2 mt-1 border border-gray-200 rounded-lg outline-none focus:border-green-500 bg-white"
                              >
                                  <option value="10">10</option>
                                  <option value="11">11</option>
                                  <option value="12">12</option>
                              </select>
                          </div>
                      </div>
                  </div>

                  <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                      <button 
                          onClick={resetModal} 
                          className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                      >
                          Hủy bỏ
                      </button>
                      <button 
                          onClick={handleSaveStudent} 
                          className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                      >
                          <Save size={18} /> {editingId ? 'Cập nhật' : 'Lưu học sinh'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ClassManager;