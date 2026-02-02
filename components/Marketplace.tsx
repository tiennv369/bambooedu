import React from 'react';
import { Star, Download, ShoppingCart, Lock } from 'lucide-react';

const Marketplace: React.FC = () => {
  const items = [
    { id: 1, title: 'Bộ đề ôn thi THPTQG Toán 2024', author: 'Thầy Phan Duy', price: '150.000đ', rating: 4.8, sales: 1200, tags: ['Toán 12', 'Đại học'] },
    { id: 2, title: '500 câu trắc nghiệm Lịch sử Việt Nam', author: 'Cô Minh Anh', price: 'Free', rating: 4.5, sales: 850, tags: ['Lịch sử', 'Ôn tập'] },
    { id: 3, title: 'IELTS Reading Practice (Advanced)', author: 'Mr. John Smith', price: '200.000đ', rating: 4.9, sales: 340, tags: ['English', 'IELTS'] },
    { id: 4, title: 'Đề thi thử Vật Lý chuyên Phan Bội Châu', author: 'Team Vật Lý', price: '50.000đ', rating: 4.7, sales: 500, tags: ['Vật Lý', 'Lớp 12'] },
  ];

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-gray-800">Chợ nội dung số</h2>
        <p className="text-gray-500 mt-2">Khám phá và chia sẻ hàng ngàn bộ đề thi chất lượng từ cộng đồng giáo viên.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="h-40 bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center relative">
               <span className="text-6xl">📚</span>
               {item.price !== 'Free' && (
                 <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-sm">
                   <Lock size={14} className="text-gray-500" />
                 </div>
               )}
            </div>
            <div className="p-5">
              <div className="flex gap-2 mb-2">
                {item.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium uppercase tracking-wide">{tag}</span>
                ))}
              </div>
              <h3 className="font-bold text-gray-800 text-lg leading-snug mb-1 line-clamp-2 min-h-[3.5rem]">{item.title}</h3>
              <p className="text-xs text-gray-500 mb-3">bởi <span className="text-indigo-600 font-medium">{item.author}</span></p>
              
              <div className="flex items-center gap-1 mb-4">
                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-bold text-gray-700">{item.rating}</span>
                <span className="text-xs text-gray-400">({item.sales} lượt tải)</span>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className={`font-bold text-lg ${item.price === 'Free' ? 'text-green-600' : 'text-indigo-600'}`}>
                  {item.price}
                </span>
                <button className="p-2 rounded-lg bg-gray-50 hover:bg-indigo-600 hover:text-white text-gray-600 transition-colors">
                  {item.price === 'Free' ? <Download size={20} /> : <ShoppingCart size={20} />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Marketplace;