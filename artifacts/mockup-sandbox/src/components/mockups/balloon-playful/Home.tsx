import React, { useState, useEffect } from 'react';
import { Terminal, Crosshair, Cpu, Zap, Ticket, Calendar, MapPin, Users, ChevronRight, Play, Hexagon, Box } from 'lucide-react';

export default function Home() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    // Fake countdown to 2026-07-23
    const target = new Date('2026-07-23T00:00:00');
    const interval = setInterval(() => {
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60)
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-mono selection:bg-[#B6FF3C] selection:text-black overflow-x-hidden relative">
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20" 
           style={{ backgroundImage: 'linear-gradient(#B6FF3C 1px, transparent 1px), linear-gradient(90deg, #B6FF3C 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 border-l border-r border-[#B6FF3C]/30 min-h-screen">
        
        {/* Navbar */}
        <nav className="border-b border-[#B6FF3C]/30 py-4 flex justify-between items-center bg-black/80 backdrop-blur-md sticky top-0 z-50">
          <div className="text-[#B6FF3C] font-bold tracking-tighter flex items-center gap-2">
            <Hexagon className="w-5 h-5" />
            <span>TBC_2026</span>
          </div>
          <div className="hidden md:flex gap-6 text-sm text-gray-400">
            <a href="#info" className="hover:text-[#B6FF3C] transition-colors">// 資訊</a>
            <a href="#highlights" className="hover:text-[#B6FF3C] transition-colors">// 亮點</a>
            <a href="#schedule" className="hover:text-[#B6FF3C] transition-colors">// 節目</a>
            <a href="#tickets" className="hover:text-[#B6FF3C] transition-colors">// 售票</a>
          </div>
          <button className="border border-[#B6FF3C] text-[#B6FF3C] px-4 py-1 text-sm hover:bg-[#B6FF3C] hover:text-black transition-all hover:shadow-[0_0_15px_#B6FF3C]">
            INIT_SYS
          </button>
        </nav>

        {/* Hero Section */}
        <section className="py-24 border-b border-[#B6FF3C]/30 relative">
          <div className="absolute top-10 right-10 text-[#FF2D95] opacity-50 font-mono text-xs">
            [SYS_STATUS: ONLINE]<br/>
            [CAPACITY: 500/DAY]
          </div>
          <div className="space-y-6">
            <div className="inline-block border border-[#B6FF3C]/50 text-[#B6FF3C] px-3 py-1 text-xs tracking-widest mb-4">
              &gt; 亞洲最大室內氣球藝術盛典
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none">
              2026<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#B6FF3C] to-[#FF2D95]">
                臺灣氣球嘉年華
              </span>
            </h1>
            <p className="max-w-xl text-gray-400 text-sm leading-relaxed border-l-2 border-[#FF2D95] pl-4">
              以未來視角重塑氣球藝術。結合巨型結構、動力展演與演算法生成設計，挑戰材質極限。
            </p>
            
            {/* Countdown */}
            <div className="flex gap-4 py-8">
              {[
                { label: 'DAYS', value: timeLeft.days },
                { label: 'HRS', value: timeLeft.hours },
                { label: 'MIN', value: timeLeft.minutes },
                { label: 'SEC', value: timeLeft.seconds },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-16 h-16 border border-[#B6FF3C]/50 flex items-center justify-center text-2xl font-bold bg-[#B6FF3C]/5 shadow-[inset_0_0_10px_rgba(182,255,60,0.2)] text-[#B6FF3C]">
                    {String(item.value).padStart(2, '0')}
                  </div>
                  <span className="text-[10px] mt-2 text-gray-500">{item.label}</span>
                </div>
              ))}
            </div>

            <button className="bg-[#B6FF3C] text-black font-bold px-8 py-4 flex items-center gap-2 hover:bg-white hover:shadow-[0_0_30px_#B6FF3C] transition-all duration-300">
              <Terminal className="w-5 h-5" />
              立即購票 _ACCESS_GRANTED
            </button>
          </div>
          
          {/* Wireframe Balloon Decorative */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:block opacity-20">
            <svg width="400" height="400" viewBox="0 0 400 400" className="stroke-[#B6FF3C]" fill="none" strokeWidth="1">
              <path d="M200 50 C300 50 350 150 350 250 C350 350 250 380 200 380 C150 380 50 350 50 250 C50 150 100 50 200 50 Z" />
              <path d="M200 50 C250 50 280 150 280 250 C280 350 220 380 200 380 C180 380 120 350 120 250 C120 150 150 50 200 50 Z" />
              <path d="M200 50 C220 50 230 150 230 250 C230 350 210 380 200 380 C190 380 170 350 170 250 C170 150 180 50 200 50 Z" />
              <path d="M50 250 L350 250" />
              <path d="M70 150 L330 150" />
              <path d="M100 320 L300 320" />
            </svg>
          </div>
        </section>

        {/* Info Bar */}
        <section id="info" className="grid grid-cols-1 md:grid-cols-3 border-b border-[#B6FF3C]/30 bg-[#B6FF3C]/5">
          <div className="p-6 border-b md:border-b-0 md:border-r border-[#B6FF3C]/30 flex items-start gap-4">
            <Calendar className="text-[#FF2D95] mt-1" />
            <div>
              <div className="text-xs text-gray-500 mb-1">// DATE</div>
              <div className="font-bold">2026/7/23 - 7/26</div>
              <div className="text-sm text-gray-400 mt-1">7/25-26 對外開放</div>
            </div>
          </div>
          <div className="p-6 border-b md:border-b-0 md:border-r border-[#B6FF3C]/30 flex items-start gap-4">
            <MapPin className="text-[#FF2D95] mt-1" />
            <div>
              <div className="text-xs text-gray-500 mb-1">// LOCATION</div>
              <div className="font-bold">臺北瓶蓋工廠</div>
              <div className="text-sm text-gray-400 mt-1">南港區</div>
            </div>
          </div>
          <div className="p-6 flex items-start gap-4">
            <Users className="text-[#FF2D95] mt-1" />
            <div>
              <div className="text-xs text-gray-500 mb-1">// CAPACITY</div>
              <div className="font-bold">每日上限 500 人</div>
              <div className="text-sm text-gray-400 mt-1">實名制入場</div>
            </div>
          </div>
        </section>

        {/* Highlights */}
        <section id="highlights" className="py-20 border-b border-[#B6FF3C]/30">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-3xl font-bold tracking-tight">四大亮點</h2>
            <div className="flex-1 border-t border-dashed border-[#B6FF3C]/30"></div>
            <div className="text-[#B6FF3C] text-xs">MODULE_01</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { id: '01', title: '巨型氣球展覽', desc: '10米挑高空間的視覺震撼，無重力漂浮結構', icon: Box },
              { id: '02', title: '舞臺氣球秀', desc: '結合光影與動態感測的臨場表演', icon: Play },
              { id: '03', title: '親子手作坊', desc: '基礎幾何建構原理 (加購 NT$150)', icon: Crosshair },
              { id: '04', title: 'AI 教育科技', desc: '生成式模型輔助氣球造型設計', icon: Cpu }
            ].map((feature, i) => (
              <div key={i} className="border border-[#B6FF3C]/30 p-6 group hover:border-[#B6FF3C] hover:bg-[#B6FF3C]/5 transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#FF2D95]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="text-[#B6FF3C] font-mono text-xs mb-4">[{feature.id}]</div>
                <feature.icon className="w-8 h-8 mb-4 text-gray-400 group-hover:text-[#FF2D95] transition-colors" />
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Schedule */}
        <section id="schedule" className="py-20 border-b border-[#B6FF3C]/30 relative">
          <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#FF2D95] to-transparent opacity-50 hidden md:block"></div>
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-3xl font-bold tracking-tight">舞臺節目時程</h2>
            <div className="flex-1 border-t border-dashed border-[#B6FF3C]/30"></div>
            <div className="text-[#B6FF3C] text-xs">MODULE_02</div>
          </div>

          <div className="space-y-0">
            {[
              { time: '13:00', title: '12分鐘快手比賽', type: 'COMPETITION' },
              { time: '13:30', title: '親子氣球表演', type: 'SHOW' },
              { time: '14:30', title: '氣球藝術表演', type: 'SHOW' },
              { time: '15:30', title: '藝術服裝走秀遊行', type: 'PARADE' }
            ].map((event, i) => (
              <div key={i} className="group flex flex-col md:flex-row md:items-center border border-[#B6FF3C]/20 hover:border-[#B6FF3C] hover:shadow-[0_0_20px_rgba(182,255,60,0.15)] transition-all bg-black -mt-[1px]">
                <div className="w-full md:w-48 p-6 font-mono text-[#B6FF3C] text-xl border-b md:border-b-0 md:border-r border-[#B6FF3C]/20 bg-[#B6FF3C]/5">
                  {event.time}
                </div>
                <div className="flex-1 p-6 flex justify-between items-center">
                  <h3 className="text-lg font-bold group-hover:text-[#FF2D95] transition-colors">{event.title}</h3>
                  <div className="text-xs text-gray-600 border border-gray-800 px-2 py-1">{event.type}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tickets */}
        <section id="tickets" className="py-20 border-b border-[#B6FF3C]/30">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-3xl font-bold tracking-tight">票券購買</h2>
            <div className="flex-1 border-t border-dashed border-[#B6FF3C]/30"></div>
            <div className="text-[#B6FF3C] text-xs">MODULE_03</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Single Day */}
            <div className="border border-[#B6FF3C]/50 p-8 relative overflow-hidden group hover:shadow-[0_0_30px_rgba(182,255,60,0.2)] transition-shadow">
              <div className="absolute top-4 right-4 text-[#B6FF3C]/20">
                <Ticket className="w-24 h-24 transform -rotate-12" />
              </div>
              <div className="text-[#B6FF3C] font-mono text-sm mb-6">// TICKET_TYPE_A</div>
              <h3 className="text-3xl font-black mb-2">單日票</h3>
              <div className="text-4xl font-mono text-white mb-8">NT$200</div>
              
              <ul className="space-y-3 mb-10 text-sm text-gray-400 font-mono">
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-[#FF2D95]" /> 包含單日所有展覽區域</li>
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-[#FF2D95]" /> 舞臺節目觀賞權限</li>
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-[#FF2D95]" /> AI 互動體驗區入場</li>
              </ul>
              
              <button className="w-full border border-[#B6FF3C] text-[#B6FF3C] py-4 font-bold hover:bg-[#B6FF3C] hover:text-black transition-colors flex items-center justify-center gap-2">
                EXECUTE_PURCHASE <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Two Day Pass */}
            <div className="border border-[#FF2D95]/50 bg-[#FF2D95]/5 p-8 relative overflow-hidden group hover:shadow-[0_0_30px_rgba(255,45,149,0.2)] transition-shadow">
              <div className="absolute top-4 right-4 text-[#FF2D95]/20">
                <Ticket className="w-24 h-24 transform -rotate-12" />
              </div>
              <div className="text-[#FF2D95] font-mono text-sm mb-6">// TICKET_TYPE_B (RECOMMENDED)</div>
              <h3 className="text-3xl font-black mb-2">兩日套票</h3>
              <div className="text-4xl font-mono text-white mb-8">NT$300</div>
              
              <ul className="space-y-3 mb-10 text-sm text-gray-400 font-mono">
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-[#B6FF3C]" /> 包含兩日所有展覽區域</li>
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-[#B6FF3C]" /> 舞臺節目觀賞權限</li>
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-[#B6FF3C]" /> 專屬紀念識別證</li>
              </ul>
              
              <button className="w-full bg-[#FF2D95] text-white py-4 font-bold hover:bg-white hover:text-[#FF2D95] transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,45,149,0.5)]">
                EXECUTE_PURCHASE <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Contestants */}
        <section className="py-20 border-b border-[#B6FF3C]/30">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-3xl font-bold tracking-tight">參賽者檔案</h2>
            <div className="flex-1 border-t border-dashed border-[#B6FF3C]/30"></div>
            <div className="text-[#B6FF3C] text-xs">MODULE_04</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border border-gray-800 hover:border-[#B6FF3C] transition-colors group cursor-pointer bg-black">
                <div className="aspect-square bg-gray-900 border-b border-gray-800 group-hover:border-[#B6FF3C] relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-[#B6FF3C]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <Hexagon className="w-12 h-12 text-gray-800 group-hover:text-[#B6FF3C] transition-colors" />
                </div>
                <div className="p-3">
                  <div className="text-xs text-gray-500 font-mono mb-1">ID: 100{i}</div>
                  <div className="font-bold text-sm">選手 0{i}</div>
                  <div className="text-[#FF2D95] text-[10px] mt-2 group-hover:translate-x-1 transition-transform">VIEW_DATA &gt;</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sponsors */}
        <section className="py-20 border-b border-[#B6FF3C]/30">
          <div className="text-center mb-12">
            <div className="text-gray-500 text-xs font-mono mb-4">// ALLIED_ENTITIES</div>
            <h2 className="text-xl font-bold tracking-widest text-gray-400">贊助單位</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 border border-gray-800 flex items-center justify-center text-gray-600 font-mono text-sm hover:text-[#B6FF3C] hover:border-[#B6FF3C] transition-colors">
                SPONSOR_{i}
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-gray-500">
            <Hexagon className="w-6 h-6" />
            <span className="font-mono text-sm">© 2026 TAIWAN BALLOON CARNIVAL.</span>
          </div>
          <div className="flex gap-6 text-sm font-mono text-gray-600">
            <a href="#" className="hover:text-[#B6FF3C] transition-colors">SYS_ADMIN</a>
            <a href="#" className="hover:text-[#B6FF3C] transition-colors">PRIVACY_PROTOCOL</a>
            <a href="#" className="hover:text-[#B6FF3C] transition-colors">TERMS_OF_ENGAGEMENT</a>
          </div>
        </footer>

      </div>
    </div>
  );
}
