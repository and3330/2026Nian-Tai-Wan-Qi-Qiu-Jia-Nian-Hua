import { useState } from "react";
import { useGetRegistrationAvailability, useCreateRegistration } from "@workspace/api-client-react";
import { Ticket, Users, Phone, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetRegistrationAvailabilityQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export default function RegistrationPage() {
  const queryClient = useQueryClient();
  
  const { data: availability, isLoading: isAvailabilityLoading } = useGetRegistrationAvailability();
  const createMutation = useCreateRegistration();

  const [formData, setFormData] = useState({
    parentName: "",
    phone: "",
    ticketCount: 1,
    eventDate: ""
  });
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.eventDate) {
      alert("請選擇活動日期");
      return;
    }

    createMutation.mutate({
      data: formData
    }, {
      onSuccess: () => {
        setSuccess(true);
        queryClient.invalidateQueries({ queryKey: getGetRegistrationAvailabilityQueryKey() });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onError: (err: any) => {
        alert(err.error?.error || "報名失敗，請重試或聯絡客服");
      }
    });
  };

  const selectedDateInfo = availability?.find(a => a.date === formData.eventDate);
  const isSelectedDateFull = selectedDateInfo ? selectedDateInfo.remaining <= 0 : false;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-20 relative">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 text-primary rounded-full mb-6">
          <Ticket size={40} />
        </div>
        <h1 className="font-display text-4xl md:text-5xl mb-4">報名與訂票系統</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          每日限量 500 名入場名額，請盡早預約以免向隅。免註冊，直接填寫資料即可完成預約！
        </p>
      </div>

      {success ? (
        <div className="max-w-2xl mx-auto bg-green-50 border-2 border-green-200 rounded-3xl p-12 text-center shadow-lg">
          <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-green-800 mb-4">報名成功！</h2>
          <p className="text-green-700 text-lg mb-8">
            感謝您報名 2026 臺灣氣球嘉年華。我們期待在 {formData.eventDate} 與您相見！
          </p>
          <div className="bg-white rounded-2xl p-6 text-left max-w-sm mx-auto shadow-sm border border-green-100">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-muted-foreground">報名人：</div>
              <div className="font-bold text-right">{formData.parentName}</div>
              <div className="text-muted-foreground">聯絡電話：</div>
              <div className="font-bold text-right">{formData.phone}</div>
              <div className="text-muted-foreground">預購票數：</div>
              <div className="font-bold text-right">{formData.ticketCount} 張</div>
              <div className="text-muted-foreground">入場日期：</div>
              <div className="font-bold text-right text-primary">{formData.eventDate}</div>
            </div>
          </div>
          <button 
            onClick={() => { setSuccess(false); setFormData({ parentName: "", phone: "", ticketCount: 1, eventDate: "" }); }}
            className="mt-10 text-green-600 font-bold hover:underline"
          >
            繼續預購其他日期
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 max-w-5xl mx-auto">
          <div className="lg:col-span-2 space-y-6">
            <h3 className="font-bold text-xl flex items-center gap-2">
              <Calendar className="text-primary" /> 日期與名額狀況
            </h3>
            
            {isAvailabilityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-card border rounded-2xl animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {availability?.map((day) => {
                  const isFull = day.remaining <= 0;
                  const isLow = day.remaining > 0 && day.remaining < 50;
                  const isSelected = formData.eventDate === day.date;
                  
                  return (
                    <button
                      key={day.date}
                      type="button"
                      disabled={isFull}
                      onClick={() => setFormData({...formData, eventDate: day.date})}
                      className={cn(
                        "w-full text-left p-5 rounded-2xl border-2 transition-all flex flex-col gap-2 relative overflow-hidden",
                        isFull ? "bg-muted border-border opacity-60 cursor-not-allowed" : 
                        isSelected ? "bg-primary/5 border-primary shadow-md" : "bg-card border-border hover:border-primary/50 hover:shadow-sm",
                      )}
                    >
                      {isSelected && <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full -z-10"></div>}
                      
                      <div className="flex justify-between items-center w-full">
                        <span className={cn("font-bold text-lg", isSelected ? "text-primary" : "text-foreground")}>
                          {new Date(day.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                        </span>
                        {isFull ? (
                          <span className="px-3 py-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full">
                            已額滿
                          </span>
                        ) : isLow ? (
                          <span className="px-3 py-1 bg-accent text-accent-foreground text-xs font-bold rounded-full">
                            即將額滿
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                            熱賣中
                          </span>
                        )}
                      </div>
                      
                      <div className="w-full bg-muted rounded-full h-2 mt-2 overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-1000", isFull ? "bg-destructive" : isLow ? "bg-accent" : "bg-primary")}
                          style={{ width: `${(day.registered / day.totalCapacity) * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right mt-1">
                        剩餘 {day.remaining} / {day.totalCapacity}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm flex gap-3 border border-blue-100">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <p>系統會即時扣減庫存，若選定日期額滿將無法送出表單。每筆訂單最多限購 10 張。</p>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="glass-card rounded-3xl p-8 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-bl-full -z-10"></div>
              
              <h2 className="text-2xl font-bold mb-8 border-b pb-4">填寫報名資料</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Users size={16} className="text-primary" /> 家長/聯絡人姓名 <span className="text-destructive">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.parentName}
                    onChange={e => setFormData({...formData, parentName: e.target.value})}
                    placeholder="例如：王小明"
                    className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Phone size={16} className="text-primary" /> 聯絡電話 <span className="text-destructive">*</span>
                  </label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="例如：0912345678"
                    className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Ticket size={16} className="text-primary" /> 預購票數 <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={formData.ticketCount}
                    onChange={e => setFormData({...formData, ticketCount: parseInt(e.target.value)})}
                    className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg appearance-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <option key={num} value={num}>{num} 張</option>
                    ))}
                  </select>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={createMutation.isPending || isSelectedDateFull || !formData.eventDate}
                    className="w-full py-5 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-primary to-primary/90 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all flex items-center justify-center gap-2"
                  >
                    {createMutation.isPending ? "處理中..." : 
                     !formData.eventDate ? "請選擇入場日期" : 
                     isSelectedDateFull ? "選定日期已額滿" : 
                     "確認送出報名"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
