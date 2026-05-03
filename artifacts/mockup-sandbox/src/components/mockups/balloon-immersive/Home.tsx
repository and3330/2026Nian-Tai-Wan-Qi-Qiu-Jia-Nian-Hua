import React from "react";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Ticket, 
  Star, 
  Clock, 
  Music, 
  Award, 
  Sparkles,
  ChevronRight,
  MonitorPlay,
  Shapes,
  Palette
} from "lucide-react";

const GlowOrb = ({ color, className }: { color: string; className: string }) => (
  <div 
    className={`absolute rounded-full blur-[100px] opacity-40 pointer-events-none ${className}`}
    style={{ backgroundColor: color }}
  />
);

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] rounded-3xl ${className}`}>
    {children}
  </div>
);

const GradientText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`text-transparent bg-clip-text bg-gradient-to-r from-[#FF3D8A] via-[#A78BFA] to-[#2D7FFF] ${className}`}>
    {children}
  </span>
);

export default function Home() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#0E0B1F] to-[#2A0A3D] text-white font-sans overflow-hidden selection:bg-[#FF3D8A] selection:text-white">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <GlowOrb color="#FF3D8A" className="w-[600px] h-[600px] -top-[200px] -left-[200px]" />
        <GlowOrb color="#2D7FFF" className="w-[800px] h-[800px] top-[20%] -right-[300px] opacity-30" />
        <GlowOrb color="#A78BFA" className="w-[500px] h-[500px] bottom-[10%] -left-[100px] opacity-20" />
        <GlowOrb color="#FFD86B" className="w-[400px] h-[400px] bottom-[-100px] right-[10%]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 p-6 z-50">
          <div className="max-w-7xl mx-auto">
            <GlassCard className="px-6 py-4 flex items-center justify-between rounded-full">
              <div className="font-black text-xl tracking-tighter">
                <GradientText>TBC 2026</GradientText>
              </div>
              <div className="hidden md:flex gap-8 text-sm font-bold text-white/80">
                <a href="#highlights" className="hover:text-white transition-colors">亮點</a>
                <a href="#schedule" className="hover:text-white transition-colors">節目</a>
                <a href="#tickets" className="hover:text-white transition-colors">購票</a>
              </div>
              <button className="bg-[#FF3D8A] hover:bg-[#ff5c9d] text-white px-6 py-2 rounded-full font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,61,138,0.5)]">
                立即搶票
              </button>
            </GlassCard>
          </div>
        </nav>

        {/* 1. Hero */}
        <section className="relative min-h-screen flex items-center justify-center pt-32 pb-20 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-sm font-bold text-[#FFD86B] mb-8">
              <Sparkles size={16} />
              亞洲最大室內氣球藝術盛典
            </div>
            
            <h1 className="text-6xl md:text-8xl lg:text-[120px] font-black tracking-tighter leading-none mb-8">
              臺灣氣球<br />
              <GradientText>嘉年華</GradientText>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/70 font-medium mb-12 max-w-2xl mx-auto">
              突破想像的邊界，體驗光影與氣球交織的沉浸式藝術派對。準備好迎接視覺震撼了嗎？
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-20">
              <button className="w-full sm:w-auto px-10 py-5 rounded-full bg-gradient-to-r from-[#FF3D8A] to-[#A78BFA] text-white font-bold text-lg hover:scale-105 transition-transform shadow-[0_0_40px_rgba(255,61,138,0.6)] flex items-center justify-center gap-2">
                購買入場券 <ChevronRight size={20} />
              </button>
              <button className="w-full sm:w-auto px-10 py-5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-lg transition-colors">
                觀看預告片
              </button>
            </div>

            {/* Countdown */}
            <div className="flex justify-center gap-4 md:gap-8">
              {[
                { label: "天", value: "45" },
                { label: "時", value: "12" },
                { label: "分", value: "30" },
                { label: "秒", value: "00" }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-16 h-16 md:w-24 md:h-24 flex items-center justify-center bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl md:rounded-3xl text-3xl md:text-5xl font-black mb-2 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)]">
                    {item.value}
                  </div>
                  <span className="text-sm font-bold text-white/50">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. Key Info Bar */}
        <section className="px-6 relative z-20 -mt-10">
          <div className="max-w-6xl mx-auto">
            <GlassCard className="p-8 md:p-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-white/10">
                <div className="flex items-center gap-6 md:justify-center">
                  <div className="w-14 h-14 rounded-full bg-[#2D7FFF]/20 flex items-center justify-center text-[#2D7FFF]">
                    <Calendar size={28} />
                  </div>
                  <div>
                    <p className="text-sm text-white/50 font-bold mb-1">展出日期</p>
                    <p className="text-xl font-bold">2026/7/25–26</p>
                    <p className="text-xs text-[#FFD86B] mt-1">對外開放</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 md:justify-center pt-8 md:pt-0">
                  <div className="w-14 h-14 rounded-full bg-[#FF3D8A]/20 flex items-center justify-center text-[#FF3D8A]">
                    <MapPin size={28} />
                  </div>
                  <div>
                    <p className="text-sm text-white/50 font-bold mb-1">展出地點</p>
                    <p className="text-xl font-bold">臺北瓶蓋工廠</p>
                    <p className="text-xs text-[#FFD86B] mt-1">南港車站旁</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 md:justify-center pt-8 md:pt-0">
                  <div className="w-14 h-14 rounded-full bg-[#A78BFA]/20 flex items-center justify-center text-[#A78BFA]">
                    <Users size={28} />
                  </div>
                  <div>
                    <p className="text-sm text-white/50 font-bold mb-1">每日名額</p>
                    <p className="text-xl font-bold">上限 500 人</p>
                    <p className="text-xs text-[#FFD86B] mt-1">限量發售</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* 3. Highlights */}
        <section id="highlights" className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-4">四大亮點</h2>
              <p className="text-white/60 text-lg">一場挑戰感官極限的視覺饗宴</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: "巨型氣球展覽", desc: "高達 8 公尺的超現實氣球裝置藝術，結合動態光影投射，打造迷幻空間。", icon: Shapes, color: "#FF3D8A" },
                { title: "舞臺氣球秀", desc: "世界級氣球大師同台競技，結合音樂與魔術的極致舞台表演。", icon: Star, color: "#2D7FFF" },
                { title: "親子手作坊", desc: "專業導師帶領，體驗折氣球的樂趣。單人材料費 NT$150。", icon: Palette, color: "#FFD86B" },
                { title: "AI 教育科技", desc: "結合擴增實境與人工智慧，用科技重新定義氣球藝術的可能性。", icon: MonitorPlay, color: "#A78BFA" }
              ].map((item, i) => (
                <GlassCard key={i} className="p-8 group hover:bg-white/15 transition-colors cursor-pointer relative overflow-hidden">
                  <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" style={{ backgroundColor: item.color }} />
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6 border border-white/10">
                    <item.icon size={32} style={{ color: item.color }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                  <p className="text-white/60 leading-relaxed">{item.desc}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Schedule */}
        <section id="schedule" className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-16 text-center">舞臺節目時程</h2>
            <GlassCard className="p-8 md:p-12 relative overflow-hidden">
              <div className="absolute left-[40px] md:left-[50%] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
              
              <div className="space-y-12">
                {[
                  { time: "13:00", title: "12分鐘快手比賽", desc: "極限速度挑戰，參賽者將在倒數中完成複雜作品。" },
                  { time: "13:30", title: "親子氣球表演", desc: "歡樂互動時間，適合全家大小一同參與的魔幻演出。" },
                  { time: "14:30", title: "氣球藝術表演", desc: "大師級獨奏，展現氣球藝術的優雅與張力。" },
                  { time: "15:30", title: "藝術服裝走秀遊行", desc: "純氣球打造的時裝大秀，模特兒穿梭於觀眾之間。" }
                ].map((item, i) => (
                  <div key={i} className="relative flex flex-col md:flex-row gap-6 md:gap-12 md:even:flex-row-reverse md:items-center">
                    <div className="md:w-1/2 flex md:justify-end md:even:justify-start">
                      <div className="bg-[#2D7FFF]/20 text-[#2D7FFF] px-4 py-2 rounded-full font-black text-xl border border-[#2D7FFF]/30 shadow-[0_0_15px_rgba(45,127,255,0.3)] inline-flex items-center gap-2">
                        <Clock size={20} /> {item.time}
                      </div>
                    </div>
                    
                    <div className="absolute left-[16px] md:left-1/2 w-4 h-4 rounded-full bg-white border-4 border-[#0E0B1F] transform -translate-x-1/2 mt-3 md:mt-0 shadow-[0_0_10px_white]" />
                    
                    <div className="md:w-1/2 pl-12 md:pl-0">
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                        <h3 className="text-2xl font-bold mb-2">{item.title}</h3>
                        <p className="text-white/60">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </section>

        {/* 5. Tickets */}
        <section id="tickets" className="py-32 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-4">票券購買</h2>
              <p className="text-[#FFD86B] font-bold text-xl">每日限量 500 人，售完為止</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Ticket 1 */}
              <GlassCard className="relative overflow-hidden p-8 flex flex-col items-center text-center group border-[#FF3D8A]/30 hover:border-[#FF3D8A] transition-all">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF3D8A]/20 blur-3xl rounded-full" />
                <div className="w-20 h-20 bg-gradient-to-br from-[#FF3D8A] to-purple-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,61,138,0.4)]">
                  <Ticket size={32} className="text-white" />
                </div>
                <h3 className="text-3xl font-black mb-2">單日票</h3>
                <p className="text-white/60 mb-6 font-medium">任選一日入場體驗</p>
                <div className="text-5xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                  NT$200
                </div>
                <ul className="space-y-3 mb-10 text-white/70 font-medium text-left w-full max-w-[200px] mx-auto">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#FF3D8A]" /> 全區展覽通行</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#FF3D8A]" /> 舞台節目觀賞</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#FF3D8A]" /> 現場抽獎資格</li>
                </ul>
                <button className="w-full py-4 rounded-2xl bg-white/10 hover:bg-[#FF3D8A] border border-[#FF3D8A]/50 hover:border-transparent font-bold text-lg transition-all mt-auto">
                  選擇單日票
                </button>
              </GlassCard>

              {/* Ticket 2 */}
              <GlassCard className="relative overflow-hidden p-8 flex flex-col items-center text-center group border-[#A78BFA] shadow-[0_0_40px_rgba(167,139,250,0.2)] transform md:-translate-y-4">
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#2D7FFF] via-[#A78BFA] to-[#FF3D8A]" />
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#A78BFA]/20 blur-3xl rounded-full" />
                <div className="w-20 h-20 bg-gradient-to-br from-[#2D7FFF] to-[#A78BFA] rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(167,139,250,0.5)]">
                  <Award size={32} className="text-white" />
                </div>
                <div className="absolute top-6 right-6 bg-[#FFD86B] text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  最佳選擇
                </div>
                <h3 className="text-3xl font-black mb-2">兩日套票</h3>
                <p className="text-white/60 mb-6 font-medium">完整體驗兩日精彩活動</p>
                <div className="text-5xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                  NT$300
                </div>
                <ul className="space-y-3 mb-10 text-white/70 font-medium text-left w-full max-w-[200px] mx-auto">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]" /> 兩日全區展覽通行</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]" /> 所有舞台節目觀賞</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]" /> 雙倍抽獎資格</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]" /> 限量紀念徽章</li>
                </ul>
                <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#2D7FFF] to-[#A78BFA] hover:shadow-[0_0_30px_rgba(167,139,250,0.6)] font-bold text-lg transition-all mt-auto text-white">
                  選擇套票
                </button>
              </GlassCard>
            </div>
          </div>
        </section>

        {/* 6. Contestants */}
        <section className="py-20 px-6 overflow-hidden relative">
           <GlowOrb color="#2D7FFF" className="w-[600px] h-[600px] top-[10%] left-[-200px] opacity-20" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
              <div>
                <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-4">參賽者作品預覽</h2>
                <p className="text-white/60 text-lg">研究會議預告：匯聚五位頂尖氣球藝術家的狂想</p>
              </div>
              <button className="flex items-center gap-2 text-white/70 hover:text-white font-bold transition-colors">
                查看所有作品 <ChevronRight size={20} />
              </button>
            </div>

            <div className="flex gap-6 overflow-x-auto pb-10 snap-x snap-mandatory scrollbar-hide -mx-6 px-6 md:mx-0 md:px-0">
              {[
                { name: "Chen Wei", style: "Cyberpunk", color: "from-[#FF3D8A]/80 to-transparent" },
                { name: "Lin Yu", style: "Organic Nature", color: "from-[#2D7FFF]/80 to-transparent" },
                { name: "Wang Kai", style: "Abstract Geometry", color: "from-[#FFD86B]/80 to-transparent" },
                { name: "Zhang Xin", style: "Retro Futurism", color: "from-[#A78BFA]/80 to-transparent" },
                { name: "Liu Ming", style: "Minimalist Light", color: "from-white/50 to-transparent" }
              ].map((artist, i) => (
                <div key={i} className="min-w-[300px] w-[300px] snap-center shrink-0">
                  <GlassCard className="aspect-[4/5] relative overflow-hidden group">
                    <div className={`absolute inset-0 bg-gradient-to-t ${artist.color} opacity-60 mix-blend-overlay`} />
                    <div className="absolute inset-0 bg-black/20" />
                    
                    {/* Abstract Art Representation */}
                    <div className="absolute inset-0 flex items-center justify-center p-8">
                      <div className="w-full h-full rounded-full border border-white/30 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 ease-out" 
                           style={{
                             background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), transparent)`
                           }} 
                      />
                      <div className="absolute w-2/3 h-2/3 rounded-full border border-white/50 transform group-hover:-rotate-45 transition-transform duration-1000 ease-out backdrop-blur-sm" />
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0E0B1F] to-transparent">
                      <p className="text-white/60 text-sm font-bold tracking-wider uppercase mb-1">CONTESTANT 0{i + 1}</p>
                      <h3 className="text-2xl font-black">{artist.name}</h3>
                      <p className="text-sm mt-2 text-white/80">{artist.style}</p>
                    </div>
                  </GlassCard>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Sponsors */}
        <section className="py-20 px-6 border-t border-white/10">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-sm font-bold text-white/40 tracking-[0.2em] uppercase mb-10">贊助夥伴</h2>
            <div className="flex flex-wrap justify-center gap-6 md:gap-12">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-sm rounded-full transition-colors flex items-center justify-center">
                  <span className="font-black text-xl text-white/30 tracking-widest">SPONSOR {i}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. Footer */}
        <footer className="py-12 px-6 border-t border-white/10 bg-black/40 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Sparkles size={24} className="text-[#FF3D8A]" />
              <span className="font-black text-xl tracking-tighter">TBC 2026</span>
            </div>
            <div className="flex gap-6 text-sm font-medium text-white/50">
              <a href="#" className="hover:text-white transition-colors">隱私權政策</a>
              <a href="#" className="hover:text-white transition-colors">服務條款</a>
              <a href="#" className="hover:text-white transition-colors">聯絡我們</a>
            </div>
            <p className="text-sm text-white/30">
              © 2026 Taiwan Balloon Carnival. All rights reserved.
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}
