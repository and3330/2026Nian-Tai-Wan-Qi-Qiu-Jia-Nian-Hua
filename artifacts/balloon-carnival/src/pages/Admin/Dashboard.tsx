import { useAdminGetStats, useAdminListRegistrations, useAdminExportRegistrations } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Users, Ticket } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useState } from "react";

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useAdminGetStats();
  const { data: registrations, isLoading: regLoading } = useAdminListRegistrations({});
  const exportMutation = useAdminExportRegistrations();
  
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Create a manual fetch to bypass JSON parsing for CSV text
      const res = await fetch('/api/admin/registrations/export');
      const text = await res.text();
      
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `registrations_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("匯出失敗");
    } finally {
      setIsExporting(false);
    }
  };

  const chartData = stats?.map(s => ({
    name: new Date(s.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
    registered: s.registered,
    remaining: s.remaining
  })) || [];

  const totalRegistered = stats?.reduce((sum, s) => sum + s.registered, 0) || 0;
  const totalCapacity = stats?.reduce((sum, s) => sum + s.totalCapacity, 0) || 0;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display">報名監控總覽</h1>
          <p className="text-muted-foreground mt-1">查看售票狀況與匯出報名清單</p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="bg-primary text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
        >
          <Download size={18} />
          {isExporting ? "匯出中..." : "匯出 CSV 報表"}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
            <Users size={32} />
          </div>
          <div>
            <p className="text-muted-foreground font-medium mb-1">總報名人數</p>
            <div className="text-4xl font-display text-foreground">{totalRegistered}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
            <Ticket size={32} />
          </div>
          <div>
            <p className="text-muted-foreground font-medium mb-1">總售票率</p>
            <div className="text-4xl font-display text-foreground">
              {totalCapacity ? Math.round((totalRegistered / totalCapacity) * 100) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-8 rounded-3xl border shadow-sm">
        <h2 className="text-xl font-bold mb-6">每日報名統計</h2>
        {statsLoading ? (
          <div className="h-80 bg-muted/50 animate-pulse rounded-xl"></div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280'}} />
                <Tooltip 
                  cursor={{fill: '#F3F4F6'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="registered" name="已報名人數" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                <Bar dataKey="remaining" name="剩餘名額" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Registrations Table */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">最新報名名單</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/30">
              <tr>
                <th className="p-4 font-semibold text-muted-foreground">報名時間</th>
                <th className="p-4 font-semibold text-muted-foreground">家長姓名</th>
                <th className="p-4 font-semibold text-muted-foreground">聯絡電話</th>
                <th className="p-4 font-semibold text-muted-foreground">預約日期</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">票數</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {regLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">載入中...</td></tr>
              ) : registrations?.slice(0, 10).map((reg) => (
                <tr key={reg.id} className="hover:bg-muted/20">
                  <td className="p-4 text-sm text-muted-foreground">{new Date(reg.createdAt).toLocaleString('zh-TW')}</td>
                  <td className="p-4 font-medium">{reg.parentName}</td>
                  <td className="p-4">{reg.phone}</td>
                  <td className="p-4 text-primary font-medium">{formatDate(reg.eventDate)}</td>
                  <td className="p-4 text-right font-bold">{reg.ticketCount}</td>
                </tr>
              ))}
              {!regLoading && !registrations?.length && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">尚無報名資料</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
