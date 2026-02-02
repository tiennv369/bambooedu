import React, { useState, useEffect, useRef } from 'react';
import { Teacher } from '../types';
import { Save, User, Mail, Phone, Book, Briefcase, Camera, AlertTriangle, Lock, Key, CheckCircle, Database, Download, Upload, Image as ImageIcon, Globe, Cpu, Eye, EyeOff, Cloud, RefreshCw, LogIn, Trash2 } from 'lucide-react';
import { initGapi, initGis, requestAccessToken, backupToSheet, restoreFromSheet } from '../services/googleCloudService';

interface TeacherProfileProps {
    currentTeacher: Teacher;
    onUpdate: (updated: Teacher) => void;
}

const TeacherProfile: React.FC<TeacherProfileProps> = ({ currentTeacher, onUpdate }) => {
    // Profile Form State
    const [formData, setFormData] = useState<Teacher>(currentTeacher);
    const [systemLogo, setSystemLogo] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [googleClientId, setGoogleClientId] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    
    // Cloud State
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    
    // Password Form State
    const [passwordData, setPasswordData] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const restoreInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setFormData(currentTeacher);
        // Load system logo
        const storedLogo = localStorage.getItem('bamboo_system_logo');
        if (storedLogo) {
            setSystemLogo(storedLogo);
        }
        // Load Keys
        const storedKey = localStorage.getItem('bamboo_ai_api_key');
        if (storedKey) setApiKey(storedKey);
        
        const storedClientId = localStorage.getItem('bamboo_google_client_id');
        if (storedClientId) setGoogleClientId(storedClientId);

    }, [currentTeacher]);

    // Initialize Google Services on component mount if keys exist
    useEffect(() => {
        if (apiKey) initGapi(apiKey);
        if (googleClientId) {
            // Check if GSI is loaded
            const interval = setInterval(() => {
                // @ts-ignore
                if (typeof google !== 'undefined') {
                    clearInterval(interval);
                    initGis((token) => {
                        if (token && token.access_token) {
                            setIsGoogleConnected(true);
                        }
                    });
                }
            }, 500);
            return () => clearInterval(interval);
        }
    }, [apiKey, googleClientId]);

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 500 * 1024) {
                alert("File ảnh quá lớn! Vui lòng chọn ảnh có dung lượng dưới 500KB.");
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, avatar: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSystemLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 800 * 1024) { // 800KB limit
                alert("File logo quá lớn! Vui lòng chọn ảnh có dung lượng dưới 800KB để đảm bảo tốc độ.");
                if (logoInputRef.current) logoInputRef.current.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setSystemLogo(base64);
                localStorage.setItem('bamboo_system_logo', base64);
                
                // Dispatch event to update Layout immediately
                window.dispatchEvent(new Event('bamboo_logo_update'));
                
                alert("Đã cập nhật logo hệ thống thành công!");
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveSystemLogo = () => {
        if(confirm("Bạn có chắc chắn muốn xóa logo tùy chỉnh và quay về mặc định?")) {
            localStorage.removeItem('bamboo_system_logo');
            setSystemLogo(null);
            
            // Dispatch event to update Layout immediately
            window.dispatchEvent(new Event('bamboo_logo_update'));
            
            alert("Đã khôi phục logo mặc định.");
        }
    };

    const handleSaveKeys = () => {
        localStorage.setItem('bamboo_ai_api_key', apiKey.trim());
        localStorage.setItem('bamboo_google_client_id', googleClientId.trim());
        
        // Re-init services
        initGapi(apiKey.trim());
        if (googleClientId.trim()) {
             initGis((token) => {
                if (token && token.access_token) setIsGoogleConnected(true);
            });
        }
        
        alert("Đã lưu cấu hình API thành công!");
    };

    const handleGoogleConnect = () => {
        if (!googleClientId) return alert("Vui lòng nhập Google Client ID trước.");
        try {
            requestAccessToken();
            // We assume success will trigger the callback in initGis which sets isGoogleConnected
            // For better UX, we can set it to true after a short timeout if no error, 
            // but relying on the callback is safer.
            // Since requestAccessToken is async in UI flow but returns void, we wait for user interaction.
            setIsGoogleConnected(true); // Optimistic update or handled by callback
        } catch (e) {
            console.error(e);
            alert("Lỗi kết nối. Vui lòng kiểm tra Client ID và thử lại.");
        }
    };

    const handleCloudBackup = async () => {
        setIsSyncing(true);
        try {
            const res = await backupToSheet();
            alert(`Đã sao lưu ${res.count} mục dữ liệu lên Google Sheets (ID: ${res.spreadsheetId}) thành công!`);
        } catch (e) {
            console.error(e);
            alert("Sao lưu thất bại. Vui lòng kiểm tra quyền truy cập, API Console, hoặc kết nối lại.");
        }
        setIsSyncing(false);
    };

    const handleCloudRestore = async () => {
        if (!confirm("CẢNH BÁO: Dữ liệu trên máy hiện tại sẽ bị GHI ĐÈ bởi dữ liệu từ Google Sheets. Bạn có chắc chắn muốn tiếp tục?")) return;
        
        setIsSyncing(true);
        try {
            const res = await restoreFromSheet();
            if (res.success) {
                alert(`Đã khôi phục ${res.count} mục dữ liệu. Hệ thống sẽ tự tải lại để cập nhật.`);
                window.location.reload();
            } else {
                alert("Không tìm thấy dữ liệu backup hoặc file trống.");
            }
        } catch (e) {
            console.error(e);
            alert("Khôi phục thất bại. Đảm bảo file 'Bamboo_AI_Data_Backup' tồn tại trong Drive của bạn và bạn có quyền truy cập.");
        }
        setIsSyncing(false);
    };

    const handleProfileSave = () => {
        try {
            onUpdate({
                ...formData,
                password: currentTeacher.password 
            });
            alert('Cập nhật hồ sơ thành công!');
        } catch (error) {
            console.error("Save error:", error);
            alert('Không thể lưu thay đổi! Có thể dung lượng lưu trữ của trình duyệt đã đầy.');
        }
    };

    const handlePasswordUpdate = () => {
        if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
            alert("Vui lòng nhập đầy đủ thông tin mật khẩu!");
            return;
        }

        if (passwordData.current !== currentTeacher.password) {
            alert("Mật khẩu hiện tại không chính xác!");
            return;
        }

        if (passwordData.new !== passwordData.confirm) {
            alert("Mật khẩu mới không trùng khớp!");
            return;
        }

        if (passwordData.new.length < 6) {
            alert("Mật khẩu mới phải có ít nhất 6 ký tự!");
            return;
        }

        try {
            onUpdate({
                ...currentTeacher,
                password: passwordData.new
            });
            setPasswordData({ current: '', new: '', confirm: '' });
            alert("Đổi mật khẩu thành công!");
        } catch (e) {
            alert("Lỗi khi cập nhật mật khẩu.");
        }
    };

    // --- SYSTEM LOCAL BACKUP & RESTORE LOGIC ---
    const handleBackupData = () => {
        try {
            const dataToBackup: Record<string, any> = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('bamboo_')) {
                    dataToBackup[key] = localStorage.getItem(key);
                }
            }
            const blob = new Blob([JSON.stringify(dataToBackup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Bamboo_Backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            alert("Có lỗi khi tạo bản sao lưu.");
        }
    };

    const handleRestoreData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm("CẢNH BÁO: Hành động này sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại bằng dữ liệu trong file backup. Bạn có chắc chắn muốn tiếp tục?")) {
            if (restoreInputRef.current) restoreInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = event.target?.result as string;
                const parsedData = JSON.parse(json);
                if (typeof parsedData !== 'object') throw new Error("File backup không hợp lệ");

                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('bamboo_')) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));

                Object.keys(parsedData).forEach(key => {
                   if (key.startsWith('bamboo_') && parsedData[key]) {
                       localStorage.setItem(key, parsedData[key]);
                   }
                });

                alert("Phục hồi dữ liệu thành công! Hệ thống sẽ tự tải lại.");
                window.location.reload();
            } catch (err) {
                console.error(err);
                alert("File backup bị lỗi hoặc không đúng định dạng.");
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <User className="text-indigo-600" /> Hồ sơ Giáo viên & Hệ thống
            </h2>

            {/* AI & Cloud Configuration Section */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-sm border border-green-200 p-6 mb-8">
                 <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                     <div>
                        <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                            <Cpu size={20} /> Cấu hình API & Cloud
                        </h3>
                        <p className="text-sm text-green-700 mt-1">
                            Kết nối Gemini AI để tạo đề thi và Google Cloud để đồng bộ dữ liệu.
                        </p>
                     </div>
                     <div className="flex flex-col gap-2 text-right">
                         <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs font-bold text-green-600 hover:underline bg-white px-3 py-1 rounded-full shadow-sm">
                             Lấy Gemini API Key ↗
                         </a>
                         <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline bg-white px-3 py-1 rounded-full shadow-sm">
                             Lấy Google Client ID ↗
                         </a>
                     </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* Gemini Key */}
                     <div className="relative">
                         <label className="text-xs font-bold text-green-800 uppercase mb-1 block">Gemini API Key</label>
                         <div className="relative">
                            <input 
                                type={showApiKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Bắt đầu bằng AIza..."
                                className="w-full pl-3 pr-10 py-2 rounded-lg border border-green-300 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                            />
                            <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                         </div>
                     </div>

                     {/* Google Client ID */}
                     <div>
                         <label className="text-xs font-bold text-green-800 uppercase mb-1 block">Google Client ID (OAuth 2.0)</label>
                         <input 
                            type="text"
                            value={googleClientId}
                            onChange={(e) => setGoogleClientId(e.target.value)}
                            placeholder="...apps.googleusercontent.com"
                            className="w-full px-3 py-2 rounded-lg border border-green-300 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                         />
                     </div>
                 </div>
                 
                 <div className="mt-4 flex justify-end">
                     <button onClick={handleSaveKeys} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-all active:scale-95 text-sm">
                         Lưu cấu hình
                     </button>
                 </div>
            </div>

            {/* GOOGLE SHEETS SYNC SECTION */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden mb-8 p-6 relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Cloud size={100} className="text-blue-500"/>
                </div>
                <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2 mb-4 relative z-10">
                    <Database size={20} /> Đồng bộ dữ liệu Google Sheets
                </h3>
                
                <div className="relative z-10">
                    {!isGoogleConnected ? (
                        <div className="text-center py-6">
                            <p className="text-gray-600 mb-4 text-sm">Kết nối tài khoản Google để sao lưu toàn bộ dữ liệu (Câu hỏi, Lịch sử thi, Học sinh) lên Google Sheets.</p>
                            <button onClick={handleGoogleConnect} disabled={!googleClientId} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2 mx-auto transition-all disabled:opacity-50">
                                <LogIn className="w-5 h-5"/> Kết nối với Google
                            </button>
                            {!googleClientId && <p className="text-xs text-red-500 mt-2">Cần nhập Client ID ở trên trước.</p>}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <h4 className="font-bold text-blue-700 mb-2">Sao lưu (Backup)</h4>
                                <p className="text-xs text-blue-600 mb-3">Đẩy toàn bộ dữ liệu hiện tại lên file 'Bamboo_AI_Data_Backup'.</p>
                                <button onClick={handleCloudBackup} disabled={isSyncing} className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                                    {isSyncing ? <RefreshCw className="animate-spin" size={16}/> : <Upload size={16}/>} Sao lưu ngay
                                </button>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                <h4 className="font-bold text-orange-700 mb-2">Khôi phục (Restore)</h4>
                                <p className="text-xs text-orange-600 mb-3">Tải dữ liệu từ Sheets về máy. (Lưu ý: Sẽ ghi đè dữ liệu cũ).</p>
                                <button onClick={handleCloudRestore} disabled={isSyncing} className="w-full py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 flex items-center justify-center gap-2">
                                    {isSyncing ? <RefreshCw className="animate-spin" size={16}/> : <Download size={16}/>} Khôi phục
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Profile Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                {/* Cover / Header */}
                <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600 relative"></div>
                
                <div className="px-8 pb-8">
                    <div className="relative flex justify-between items-end -mt-12 mb-8">
                        <div className="flex items-end gap-6">
                            <div className="relative group">
                                <img 
                                    src={formData.avatar} 
                                    alt="Avatar" 
                                    className="w-32 h-32 rounded-full border-4 border-white shadow-md object-cover bg-white"
                                />
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                                >
                                    <Camera size={24} />
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                            </div>
                            <div className="mb-2">
                                <h1 className="text-2xl font-bold text-gray-800">{formData.fullName}</h1>
                                <p className="text-indigo-600 font-medium">@{formData.username}</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleProfileSave}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Save size={18} /> Lưu hồ sơ
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Basic Info */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Thông tin cơ bản</h3>
                            
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Họ và tên</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <User size={18} className="text-gray-400" />
                                    <input 
                                        type="text" 
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                                        className="bg-transparent outline-none w-full text-gray-700 font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Tên đăng nhập</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg border border-gray-200">
                                    <Lock size={18} className="text-gray-400" />
                                    <input 
                                        type="text" 
                                        value={formData.username}
                                        disabled
                                        className="bg-transparent outline-none w-full text-gray-500 font-medium cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Môn giảng dạy</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <Book size={18} className="text-gray-400" />
                                    <input 
                                        type="text" 
                                        value={formData.subject}
                                        onChange={(e) => setFormData({...formData, subject: e.target.value})}
                                        className="bg-transparent outline-none w-full text-gray-700 font-medium"
                                        placeholder="Ví dụ: Toán học"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Trường / Tổ chức</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <Briefcase size={18} className="text-gray-400" />
                                    <input 
                                        type="text" 
                                        value={formData.school}
                                        onChange={(e) => setFormData({...formData, school: e.target.value})}
                                        className="bg-transparent outline-none w-full text-gray-700 font-medium"
                                        placeholder="Ví dụ: THPT Bamboo"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Contact & Security */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Liên hệ & Bảo mật</h3>

                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <Mail size={18} className="text-gray-400" />
                                    <input 
                                        type="email" 
                                        value={formData.email || ''}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        className="bg-transparent outline-none w-full text-gray-700 font-medium"
                                        placeholder="email@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Số điện thoại</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <Phone size={18} className="text-gray-400" />
                                    <input 
                                        type="tel" 
                                        value={formData.phone || ''}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                        className="bg-transparent outline-none w-full text-gray-700 font-medium"
                                        placeholder="0912..."
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Key size={18} className="text-orange-500" /> Đổi mật khẩu
                                </h4>
                                <div className="space-y-3">
                                    <input 
                                        type="password" 
                                        value={passwordData.current}
                                        onChange={e => setPasswordData({...passwordData, current: e.target.value})}
                                        placeholder="Mật khẩu hiện tại"
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-300 transition-colors"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input 
                                            type="password" 
                                            value={passwordData.new}
                                            onChange={e => setPasswordData({...passwordData, new: e.target.value})}
                                            placeholder="Mật khẩu mới"
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-300 transition-colors"
                                        />
                                        <input 
                                            type="password" 
                                            value={passwordData.confirm}
                                            onChange={e => setPasswordData({...passwordData, confirm: e.target.value})}
                                            placeholder="Nhập lại mới"
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-300 transition-colors"
                                        />
                                    </div>
                                    <button 
                                        onClick={handlePasswordUpdate}
                                        disabled={!passwordData.current || !passwordData.new}
                                        className="w-full py-2 bg-orange-50 text-orange-600 font-bold rounded-lg border border-orange-200 hover:bg-orange-100 disabled:opacity-50 transition-colors"
                                    >
                                        Cập nhật mật khẩu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* System Branding & Local Backup */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Branding */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Globe size={20} className="text-blue-500"/> Thương hiệu hệ thống</h3>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden relative group">
                            {systemLogo ? (
                                <img src={systemLogo} className="w-full h-full object-contain p-2" />
                            ) : (
                                <span className="text-xs text-gray-400 text-center px-2">Logo mặc định</span>
                            )}
                            <div onClick={() => logoInputRef.current?.click()} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer text-white transition-opacity">
                                <Upload size={20} />
                            </div>
                            <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleSystemLogoUpload} />
                        </div>
                        <div className="flex-1 space-y-2">
                            <p className="text-sm text-gray-600">Logo này sẽ hiển thị trên màn hình đăng nhập và góc trái ứng dụng.</p>
                            <div className="flex gap-2">
                                <button onClick={() => logoInputRef.current?.click()} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100">Tải lên</button>
                                {systemLogo && (
                                    <button onClick={handleRemoveSystemLogo} className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100">Gỡ bỏ</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Local Backup */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Database size={20} className="text-purple-500"/> Sao lưu cục bộ (Local)</h3>
                    <div className="space-y-3">
                        <button onClick={handleBackupData} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200 group">
                            <span className="text-sm font-bold text-gray-700">Tải file Backup (.json)</span>
                            <Download size={18} className="text-gray-400 group-hover:text-purple-600" />
                        </button>
                        
                        <div className="relative">
                            <button onClick={() => restoreInputRef.current?.click()} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200 group">
                                <span className="text-sm font-bold text-gray-700">Khôi phục từ file</span>
                                <Upload size={18} className="text-gray-400 group-hover:text-purple-600" />
                            </button>
                            <input type="file" ref={restoreInputRef} className="hidden" accept=".json" onChange={handleRestoreData} />
                        </div>
                        
                        <p className="text-[10px] text-gray-400 mt-2 text-center">Dùng khi chuyển dữ liệu giữa các máy tính mà không qua Internet.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherProfile;