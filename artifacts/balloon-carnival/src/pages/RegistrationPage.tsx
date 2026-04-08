import { useState } from "react";
import { useGetRegistrationAvailability, useCreateRegistration } from "@workspace/api-client-react";
import { Ticket, Users, Phone, Calendar, AlertCircle, CheckCircle2, PartyPopper, Handshake, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetRegistrationAvailabilityQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type AudienceType = "visitor" | "professional" | null;

export default function RegistrationPage() {
  const queryClient = useQueryClient();

  const { data: availability, isLoading: isAvailabilityLoading } = useGetRegistrationAvailability();
  const createMutation = useCreateRegistration();

  const [audience, setAudience] = useState<AudienceType>(null);
  const [proTicketType, setProTicketType] = useState("");
  const [formData, setFormData] = useState({
    parentName: "",
    phone: "",
    ticketCount: 1,
    eventDate: ""
  });
  const [success, setSuccess] = useState(false);
  const [proSuccess, setProSuccess] = useState(false);

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

  const publicDates = availability?.filter(a => {
    const d = new Date(a.date);
    return d.getDate() >= 25;
  });

  const selectedDateInfo = publicDates?.find(a => a.date === formData.eventDate);
  const isSelectedDateFull = selectedDateInfo ? selectedDateInfo.remaining <= 0 : false;

  if (!audience) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 text-primary rounded-full mb-6">
            <Ticket size={40} />
          </div>
          <h1 className="font-display text-4xl md:text-5xl mb-4">報名與訂票</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            請先選擇您的身份，我們將為您顯示對應的票種與資訊
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <button
            onClick={() => setAudience("visitor")}
            className="glass-card rounded-3xl p-8 md:p-10 hover-lift group text-left relative overflow-hidden border-2 border-transparent hover:border-secondary/40 transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-secondary/10 to-transparent rounded-bl-full -z-10"></div>
            <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6">
              <PartyPopper size={32} className="text-secondary" />
            </div>
            <h3 className="text-2xl font-bold mb-2 group-hover:text-secondary transition-colors">一般觀眾購票</h3>
            <p className="text-sm text-muted-foreground font-medium mb-4">一般民眾 ・ 親子家庭 ・ 遊客</p>
            <p className="text-muted-foreground leading-relaxed mb-6">
              7/25-26 公開活動日入場票，可觀賞展覽、表演、參加親子手作坊。
            </p>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-sm text-muted-foreground">單日票</span>
                <span className="text-2xl font-bold text-green-600 ml-2">200</span>
                <span className="text-muted-foreground text-sm ml-1">元</span>
              </div>
              <div className="text-muted-foreground">/</div>
              <div>
                <span className="text-sm text-muted-foreground">兩日套票</span>
                <span className="text-2xl font-bold text-green-600 ml-2">300</span>
                <span className="text-muted-foreground text-sm ml-1">元</span>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-1 text-secondary font-bold text-sm">
              選擇此方案 <ArrowRight size={16} />
            </div>
          </button>

          <button
            onClick={() => setAudience("professional")}
            className="glass-card rounded-3xl p-8 md:p-10 hover-lift group text-left relative overflow-hidden border-2 border-transparent hover:border-amber-400/40 transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full -z-10"></div>
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-6">
              <Handshake size={32} className="text-amber-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2 group-hover:text-amber-500 transition-colors">同行交流報名</h3>
            <p className="text-sm text-muted-foreground font-medium mb-4">業界人士 ・ 氣球師 ・ 教學者</p>
            <p className="text-muted-foreground leading-relaxed mb-6">
              四天專業活動 — 研習會、五大交流賽、交流大賽，總獎金 12 萬元。
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <span className="text-sm text-muted-foreground">比賽</span>
                <span className="text-xl font-bold text-amber-600 ml-1">5,000</span>
                <span className="text-muted-foreground text-xs ml-0.5">元</span>
              </div>
              <div className="text-muted-foreground">/</div>
              <div>
                <span className="text-sm text-muted-foreground">研習</span>
                <span className="text-xl font-bold text-amber-600 ml-1">8,000</span>
                <span className="text-muted-foreground text-xs ml-0.5">元</span>
              </div>
              <div className="text-muted-foreground">/</div>
              <div>
                <span className="text-sm text-muted-foreground">全通</span>
                <span className="text-xl font-bold text-amber-600 ml-1">12,000</span>
                <span className="text-muted-foreground text-xs ml-0.5">元</span>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-1 text-amber-500 font-bold text-sm">
              選擇此方案 <ArrowRight size={16} />
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (audience === "professional") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-8">
          <button
            onClick={() => setAudience(null)}
            className="text-sm text-muted-foreground hover:text-primary font-medium mb-4 inline-block"
          >
            ← 返回選擇身份
          </button>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 text-amber-500 rounded-full mb-6 mx-auto block">
            <Handshake size={32} />
          </div>
          <h1 className="font-display text-4xl md:text-5xl mb-4">同行交流報名</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            歡迎氣球業界同行！請依需求選擇適合的票種
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-card rounded-2xl p-6 border-2 border-primary/30 relative hover-lift">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-1 rounded-full">
              最完整
            </div>
            <h3 className="text-lg font-bold text-center mb-1">四天通行票</h3>
            <div className="text-center mb-4">
              <span className="text-4xl font-bold text-primary">12,000</span>
              <span className="text-muted-foreground ml-1">元</span>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> 四天皆可入場</li>
              <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> 研習會參加資格</li>
              <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> 交流比賽報名資格</li>
            </ul>
          </div>
          <div className="glass-card rounded-2xl p-6 hover-lift">
            <h3 className="text-lg font-bold text-center mb-1">研習會通行票</h3>
            <div className="text-center mb-4">
              <span className="text-4xl font-bold text-amber-600">8,000</span>
              <span className="text-muted-foreground ml-1">元</span>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><span className="text-amber-600 font-bold">✓</span> 第一天研習會入場資格</li>
            </ul>
          </div>
          <div className="glass-card rounded-2xl p-6 hover-lift">
            <h3 className="text-lg font-bold text-center mb-1">交流比賽通行票</h3>
            <div className="text-center mb-4">
              <span className="text-4xl font-bold text-purple-600">5,000</span>
              <span className="text-muted-foreground ml-1">元</span>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><span className="text-purple-600 font-bold">✓</span> 第二天交流比賽報名資格</li>
            </ul>
          </div>
        </div>

        {proSuccess ? (
          <div className="max-w-2xl mx-auto bg-amber-50 border-2 border-amber-200 rounded-3xl p-12 text-center shadow-lg">
            <CheckCircle2 className="w-24 h-24 text-amber-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-amber-800 mb-4">報名資料已送出！</h2>
            <p className="text-amber-700 text-lg mb-4">
              感謝您報名同行交流活動。
            </p>
            <div className="bg-white rounded-2xl p-6 text-left max-w-sm mx-auto shadow-sm border border-amber-100 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-muted-foreground">姓名：</div>
                <div className="font-bold text-right">{formData.parentName}</div>
                <div className="text-muted-foreground">聯絡電話：</div>
                <div className="font-bold text-right">{formData.phone}</div>
                <div className="text-muted-foreground">票種：</div>
                <div className="font-bold text-right text-amber-600">{proTicketType}</div>
              </div>
            </div>
            <p className="text-amber-600 text-sm mb-6">主辦單位將於收到報名後，以電話或簡訊通知繳費方式。</p>
            <button
              onClick={() => { setProSuccess(false); setFormData({ parentName: "", phone: "", ticketCount: 1, eventDate: "" }); setProTicketType(""); }}
              className="text-amber-600 font-bold hover:underline"
            >
              繼續報名
            </button>
          </div>
        ) : (
          <>
            <div className="glass-card rounded-3xl p-8 md:p-10 relative overflow-hidden mb-8">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full -z-10"></div>
              <h2 className="text-2xl font-bold mb-8 border-b pb-4">填寫同行報名資料</h2>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (!proTicketType) { alert("請選擇票種"); return; }
                const ticketDateMap: Record<string, string> = {
                  "四天通行票": "2026-07-23",
                  "研習會通行票": "2026-07-23",
                  "交流比賽通行票": "2026-07-24",
                };
                const eventDate = ticketDateMap[proTicketType] || "2026-07-23";
                createMutation.mutate({
                  data: {
                    parentName: formData.parentName,
                    phone: formData.phone,
                    ticketCount: 1,
                    eventDate,
                  }
                }, {
                  onSuccess: () => {
                    setProSuccess(true);
                    queryClient.invalidateQueries({ queryKey: getGetRegistrationAvailabilityQueryKey() });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  },
                  onError: (err: any) => {
                    alert(err.error?.error || "報名失敗，請重試或聯絡客服");
                  }
                });
              }} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Users size={16} className="text-amber-500" /> 姓名 <span className="text-destructive">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.parentName}
                    onChange={e => setFormData({...formData, parentName: e.target.value})}
                    placeholder="例如：王小明"
                    className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Phone size={16} className="text-amber-500" /> 聯絡電話 <span className="text-destructive">*</span>
                  </label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="例如：0912345678"
                    className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Ticket size={16} className="text-amber-500" /> 票種選擇 <span className="text-destructive">*</span>
                  </label>
                  <select
                    required
                    value={proTicketType}
                    onChange={e => setProTicketType(e.target.value)}
                    className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-lg appearance-none cursor-pointer"
                  >
                    <option value="">請選擇票種</option>
                    <option value="四天通行票">四天通行票 — 12,000 元</option>
                    <option value="研習會通行票">研習會通行票 — 8,000 元</option>
                    <option value="交流比賽通行票">交流比賽通行票 — 5,000 元</option>
                  </select>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={createMutation.isPending || !proTicketType}
                    className="w-full py-5 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-amber-500 to-amber-600 shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/40 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all flex items-center justify-center gap-2"
                  >
                    {createMutation.isPending ? "處理中..." :
                     !proTicketType ? "請選擇票種" : "確認送出報名"}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-amber-50 text-amber-800 p-5 rounded-2xl text-sm border border-amber-200">
              <p className="font-bold mb-2">注意事項</p>
              <ul className="space-y-1 text-amber-700">
                <li>・報名後將由主辦單位確認並通知繳費方式</li>
                <li>・7/23（四）、7/24（五）為業內封閉活動，僅限報名同行入場</li>
                <li>・如有疑問請洽服務專線 02-2720-8889</li>
              </ul>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-20 relative">
      <div className="text-center mb-8">
        <button
          onClick={() => setAudience(null)}
          className="text-sm text-muted-foreground hover:text-primary font-medium mb-4 inline-block"
        >
          ← 返回選擇身份
        </button>
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 text-primary rounded-full mb-6 mx-auto block">
          <PartyPopper size={40} />
        </div>
        <h1 className="font-display text-4xl md:text-5xl mb-4">一般觀眾購票</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          7/25（六）、7/26（日）公開活動日入場，每日限量 500 名
        </p>
      </div>

      <div className="flex justify-center gap-6 mb-12">
        <div className="glass-card rounded-2xl p-6 text-center hover-lift">
          <h3 className="text-lg font-bold mb-1">單日票</h3>
          <div className="mb-2">
            <span className="text-3xl font-bold text-green-600">200</span>
            <span className="text-muted-foreground ml-1">元</span>
          </div>
          <p className="text-xs text-muted-foreground">7/25 或 7/26 擇一日</p>
        </div>
        <div className="glass-card rounded-2xl p-6 text-center hover-lift relative border-2 border-green-200">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            省 100 元
          </div>
          <h3 className="text-lg font-bold mb-1">兩日套票</h3>
          <div className="mb-2">
            <span className="text-3xl font-bold text-green-600">300</span>
            <span className="text-muted-foreground ml-1">元</span>
          </div>
          <p className="text-xs text-muted-foreground">7/25 + 7/26 兩日</p>
        </div>
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
                {publicDates?.map((day) => {
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
