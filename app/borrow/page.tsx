'use client';

import React, { useState, useEffect } from 'react';
import { 
  getEquipment, 
  getRecords, 
  addEquipment, 
  deleteEquipment, 
  updateStock, 
  borrowItem, 
  returnItem, 
  clearHistory 
} from '../actions';

// We can define types based on what we expect from the DB
// Or import if we generated types shared, but for client component local types are fine
interface Equipment {
  id: number;
  name: string;
  total: number;
  available: number;
}

interface Record {
  id: number;
  userName: string;
  equipmentId: number;
  borrowDate: Date;
  returnDate: Date | null;
  status: string;
  equipment: Equipment;
}

export default function BorrowPage() {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'manage' | 'history'>('dashboard');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Forms State
  const [newItemName, setNewItemName] = useState('');
  const [newItemTotal, setNewItemTotal] = useState(1);
  const [borrowUser, setBorrowUser] = useState('');
  const [selectedEqId, setSelectedEqId] = useState('');

  // --- Initial Data Loading ---
  const fetchData = async () => {
    try {
      const [eqData, recData] = await Promise.all([getEquipment(), getRecords()]);
      setEquipment(eqData);
      // @ts-ignore - Prisma Date objects might need handling if passed as JSON, but server actions serialize dates
      setRecords(recData); 
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Handlers ---

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    await addEquipment(newItemName, newItemTotal);
    setNewItemName('');
    setNewItemTotal(1);
    await fetchData(); // Refresh data
    alert('เพิ่มอุปกรณ์เรียบร้อยแล้ว');
  };

  const handleDeleteItem = async (id: number) => {
    if(!confirm('ยืนยันการลบ?')) return;
    await deleteEquipment(id);
    await fetchData();
  };

  const handleUpdateStock = async (id: number, amount: number) => {
    await updateStock(id, amount);
    await fetchData();
  };

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowUser || !selectedEqId) return;

    try {
      await borrowItem(borrowUser, parseInt(selectedEqId));
      setBorrowUser('');
      setSelectedEqId('');
      await fetchData();
      alert('บันทึกการยืมสำเร็จ');
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error);
    }
  };

  const handleReturn = async (recordId: number) => {
    await returnItem(recordId);
    await fetchData();
    alert('คืนอุปกรณ์เรียบร้อย');
  };

  const handleClearHistory = async () => {
    if(confirm('ล้างประวัติทั้งหมด?')) {
        await clearHistory();
        await fetchData();
    }
  };


  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-10 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
          <span>🏀</span> SportLend (DB Connected)
        </h1>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
           <TabButton label="ยืม-คืน" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
           <TabButton label="จัดการสตอก" active={activeTab === 'manage'} onClick={() => setActiveTab('manage')} />
           <TabButton label="ประวัติ" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6">
        
        {/* --- View: Dashboard (Borrow/Return) --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Borrow Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 text-gray-700">📝 ทำรายการยืม</h2>
              <form onSubmit={handleBorrow} className="flex flex-col md:flex-row gap-4">
                <input 
                  type="text" 
                  placeholder="ชื่อผู้ยืม" 
                  className="flex-1 p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition"
                  value={borrowUser}
                  onChange={e => setBorrowUser(e.target.value)}
                  required
                />
                <select 
                  className="flex-1 p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition bg-white"
                  value={selectedEqId}
                  onChange={e => setSelectedEqId(e.target.value)}
                  required
                >
                  <option value="">เลือกอุปกรณ์</option>
                  {equipment.map(e => (
                    <option key={e.id} value={e.id} disabled={e.available === 0}>
                      {e.name} (คงเหลือ {e.available})
                    </option>
                  ))}
                </select>
                <button 
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-8 rounded-xl transition shadow-lg shadow-indigo-200"
                >
                  ยืนยัน
                </button>
              </form>
            </div>

            {/* Active Borrows */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 text-gray-700">⏳ กำลังยืมอยู่</h2>
              {records.filter(r => r.status === 'ACTIVE').length === 0 ? (
                <p className="text-gray-400 text-center py-4">ไม่มีรายการที่กำลังยืม</p>
              ) : (
                 <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="text-sm text-gray-400 border-b border-gray-100">
                         <th className="py-2">ผู้ยืม</th>
                         <th className="py-2">อุปกรณ์</th>
                         <th className="py-2">เวลา</th>
                         <th className="py-2 text-right">จัดการ</th>
                       </tr>
                     </thead>
                     <tbody>
                       {records.filter(r => r.status === 'ACTIVE').map(r => (
                         <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                           <td className="py-3 font-medium text-gray-700">{r.userName}</td>
                           <td className="py-3">{r.equipment?.name || 'Unknown'}</td>
                           <td className="py-3 text-sm text-gray-500">
                             {new Date(r.borrowDate).toLocaleString('th-TH')}
                           </td>
                           <td className="py-3 text-right">
                             <button 
                               onClick={() => handleReturn(r.id)}
                               className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-full transition"
                             >
                               แจ้งคืน
                             </button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
              )}
            </div>

             {/* Simple Stock View */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {equipment.map(e => (
                 <div key={e.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-xl mb-2">
                        🏐
                    </div>
                    <h3 className="font-semibold text-gray-700">{e.name}</h3>
                    <p className={`text-sm mt-1 ${e.available === 0 ? 'text-red-500 font-bold' : 'text-green-600'}`}>
                        {e.available} / {e.total}
                    </p>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* --- View: Manage Stock --- */}
        {activeTab === 'manage' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Add New Item */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4 text-gray-700">➕ เพิ่มอุปกรณ์ใหม่</h2>
                <form onSubmit={handleAddItem} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-sm text-gray-500 mb-1">ชื่ออุปกรณ์</label>
                        <input 
                            type="text" 
                            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="block text-sm text-gray-500 mb-1">จำนวนเริ่มต้น</label>
                        <input 
                            type="number" 
                            min="1"
                            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                            value={newItemTotal}
                            onChange={(e) => setNewItemTotal(parseInt(e.target.value))}
                            required
                        />
                    </div>
                    <button className="w-full md:w-auto bg-gray-800 text-white px-6 py-3 rounded-xl hover:bg-black transition">
                        เพิ่มรายการ
                    </button>
                </form>
            </div>

            {/* List & Edit */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4 text-gray-700">📦 รายการทั้งหมด</h2>
                <div className="space-y-3">
                    {equipment.map(e => (
                        <div key={e.id} className="flex flex-wrap items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                                <h3 className="font-bold text-gray-800">{e.name}</h3>
                                <p className="text-sm text-gray-500">ทั้งหมด {e.total} | ว่าง {e.available}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-2 md:mt-0">
                                <button className="control-btn" onClick={() => handleUpdateStock(e.id, -1)}>-</button>
                                <button className="control-btn" onClick={() => handleUpdateStock(e.id, 1)}>+</button>
                                <div className="w-4"></div>
                                <button 
                                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg text-sm transition"
                                    onClick={() => handleDeleteItem(e.id)}
                                >
                                    ลบ
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}

        {/* --- View: History --- */}
        {activeTab === 'history' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-700">📜 ประวัติทั้งหมด</h2>
                <button 
                  onClick={handleClearHistory}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                    ล้างประวัติ
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-sm text-gray-400 border-b border-gray-100">
                            <th className="py-2">วันที่</th>
                            <th className="py-2">ผู้ใช้งาน</th>
                            <th className="py-2">อุปกรณ์</th>
                            <th className="py-2">สถานะ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map((r) => (
                            <tr key={r.id} className="border-b border-gray-50 text-sm">
                                <td className="py-3 text-gray-500">
                                    {new Date(r.borrowDate).toLocaleString('th-TH')}
                                </td>
                                <td className="py-3 font-medium">{r.userName}</td>
                                <td className="py-3">{r.equipment?.name || 'Unknown'}</td>
                                <td className="py-3">
                                    <span className={`px-2 py-1 rounded-md text-xs ${
                                        r.status === 'ACTIVE' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {r.status === 'ACTIVE' ? 'กำลังยืม' : 'คืนแล้ว'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
          </div>
        )}

      </main>

      {/* --- Helper Styles --- */}
      <style jsx>{`
        .control-btn {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: white;
            border: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
        }
        .control-btn:hover {
            border-color: #6366f1;
            color: #6366f1;
        }
      `}</style>
    </div>
  );
}

// Sub-component for tabs
function TabButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                active 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
        >
            {label}
        </button>
    )
}
