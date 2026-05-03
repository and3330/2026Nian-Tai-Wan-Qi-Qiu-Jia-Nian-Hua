import React, { useState, useEffect } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";

export default function Home() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const targetDate = new Date("2026-07-25T00:00:00").getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#111] font-sans selection:bg-[#FF4A1C] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-50 mix-blend-difference text-[#FAFAF7]">
        <div className="text-xs tracking-[0.2em] uppercase font-medium">TBC '26</div>
        <div className="flex gap-8 text-xs tracking-[0.1em] uppercase">
          <a href="#about" className="hover:text-[#FF4A1C] transition-colors">About</a>
          <a href="#schedule" className="hover:text-[#FF4A1C] transition-colors">Schedule</a>
          <a href="#tickets" className="hover:text-[#FF4A1C] transition-colors">Tickets</a>
        </div>
      </nav>

      {/* 1. Hero */}
      <section className="relative min-h-screen pt-32 pb-16 px-6 md:px-12 flex flex-col justify-between">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end flex-1">
          <div className="md:col-span-8 flex flex-col justify-end">
            <div className="mb-12">
              <div className="text-[10px] tracking-[0.2em] text-[#FF4A1C] uppercase mb-4">Countdown to Carnival</div>
              <div className="flex gap-8 font-serif text-5xl md:text-7xl">
                <div className="flex flex-col">
                  <span>{String(timeLeft.days).padStart(3, '0')}</span>
                  <span className="text-[10px] tracking-[0.2em] font-sans text-[#111]/50 uppercase mt-2">Days</span>
                </div>
                <div className="flex flex-col">
                  <span>{String(timeLeft.hours).padStart(2, '0')}</span>
                  <span className="text-[10px] tracking-[0.2em] font-sans text-[#111]/50 uppercase mt-2">Hours</span>
                </div>
                <div className="flex flex-col">
                  <span>{String(timeLeft.minutes).padStart(2, '0')}</span>
                  <span className="text-[10px] tracking-[0.2em] font-sans text-[#111]/50 uppercase mt-2">Minutes</span>
                </div>
                <div className="flex flex-col hidden sm:flex">
                  <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
                  <span className="text-[10px] tracking-[0.2em] font-sans text-[#111]/50 uppercase mt-2">Seconds</span>
                </div>
              </div>
            </div>
            <h1 className="font-serif text-[12vw] leading-[0.85] tracking-tight mb-6">
              Taiwan<br />
              Balloon<br />
              <span className="italic text-[#FF4A1C]">Carnival</span>
            </h1>
          </div>
          <div className="md:col-span-4 flex flex-col gap-8 pb-4">
            <div className="text-sm tracking-[0.15em] leading-relaxed uppercase border-l border-[#111]/20 pl-4">
              亞洲最大<br />
              室內氣球藝術盛典
            </div>
            <div>
              <a href="#tickets" className="group inline-flex items-center gap-4 bg-[#111] text-[#FAFAF7] px-8 py-4 rounded-none hover:bg-[#FF4A1C] transition-colors w-fit">
                <span className="text-xs tracking-[0.2em] uppercase">Purchase Tickets</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Info Bar */}
      <section className="border-y border-[#111]/10 px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-3">
            <div className="text-[10px] tracking-[0.2em] text-[#111]/50 uppercase">Dates</div>
            <div className="text-lg font-medium">2026/7/23–26</div>
            <div className="text-xs text-[#111]/60">7/25–26 對外開放</div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-[10px] tracking-[0.2em] text-[#111]/50 uppercase">Location</div>
            <div className="text-lg font-medium">臺北瓶蓋工廠</div>
            <div className="text-xs text-[#111]/60">南港</div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-[10px] tracking-[0.2em] text-[#111]/50 uppercase">Capacity</div>
            <div className="text-lg font-medium">每日上限 500 人</div>
            <div className="text-xs text-[#111]/60">限量席次</div>
          </div>
          <div className="flex flex-col gap-2 justify-end">
            <div className="text-sm font-serif italic text-right">01</div>
          </div>
        </div>
      </section>

      {/* 3. 4 Highlights */}
      <section id="about" className="py-32 px-6 md:px-12 border-b border-[#111]/10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-4">
            <h2 className="text-xs tracking-[0.2em] uppercase sticky top-24">Highlights</h2>
          </div>
          <div className="md:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-32">
              {[
                { title: "巨型氣球展覽", desc: "突破空間限制的大型裝置藝術。由百萬顆環保氣球打造的沉浸式空間，展現令人驚嘆的視覺張力。", icon: ArrowUpRight },
                { title: "舞臺氣球秀", desc: "結合聲光效果的動態演出。國內外頂尖表演者輪番上陣，帶來震撼感官的舞臺魅力。", icon: ArrowUpRight },
                { title: "親子手作坊", desc: "NT$150 體驗費・創造專屬回憶。專業導師親自指導，帶領孩子進入氣球藝術的奇妙世界。", icon: ArrowUpRight },
                { title: "AI 教育科技", desc: "前沿技術與傳統工藝的碰撞。透過擴增實境與人工智慧，以全新視角解構氣球藝術。", icon: ArrowUpRight },
              ].map((item, i) => (
                <div key={i} className="group cursor-pointer relative">
                  <div className="absolute -left-4 top-0 w-1 h-full bg-[#FF4A1C] scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-500 ease-out" />
                  <div className="text-[10px] tracking-[0.2em] text-[#FF4A1C] mb-6">0{i + 1}</div>
                  <h3 className="font-serif text-4xl mb-6 group-hover:text-[#FF4A1C] transition-colors flex items-center justify-between">
                    {item.title}
                    <item.icon className="w-6 h-6 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 text-[#FF4A1C]" />
                  </h3>
                  <p className="text-sm text-[#111]/70 leading-loose">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Schedule */}
      <section id="schedule" className="py-32 px-6 md:px-12 border-b border-[#111]/10 bg-[#111] text-[#FAFAF7]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs tracking-[0.2em] uppercase sticky top-24">Schedule</h2>
              <div className="text-sm font-serif italic text-[#FAFAF7]/50">02</div>
            </div>
          </div>
          <div className="md:col-span-8">
            <div className="flex flex-col border-t border-[#FAFAF7]/10">
              {[
                { time: "13:00", title: "12分鐘快手比賽", type: "Competition" },
                { time: "13:30", title: "親子氣球表演", type: "Performance" },
                { time: "14:30", title: "氣球藝術表演", type: "Performance" },
                { time: "15:30", title: "藝術服裝走秀遊行", type: "Parade" },
              ].map((item, i) => (
                <div key={i} className="group flex flex-col sm:flex-row sm:items-center py-10 border-b border-[#FAFAF7]/10 hover:bg-[#FAFAF7]/5 transition-colors px-6 -mx-6 cursor-pointer">
                  <div className="w-32 text-sm tracking-[0.1em] text-[#FF4A1C] mb-4 sm:mb-0 font-medium">{item.time}</div>
                  <div className="flex-1">
                    <div className="font-serif text-3xl group-hover:translate-x-4 transition-transform duration-500 mb-2">{item.title}</div>
                    <div className="text-[10px] tracking-[0.2em] text-[#FAFAF7]/40 uppercase group-hover:translate-x-4 transition-transform duration-500 delay-75">{item.type}</div>
                  </div>
                  <ArrowRight className="w-5 h-5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 text-[#FF4A1C] hidden sm:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Tickets */}
      <section id="tickets" className="py-32 px-6 md:px-12 border-b border-[#111]/10 bg-[#FAFAF7]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-4 flex flex-col justify-between">
            <div>
              <h2 className="text-xs tracking-[0.2em] uppercase mb-6">Ticketing</h2>
              <p className="text-sm text-[#111]/60 leading-relaxed pr-8">
                每日限制 500 人入場，以確保觀展品質。強烈建議提前線上購票。六歲以下兒童免費入場。
              </p>
            </div>
            <div className="text-sm font-serif italic text-[#111]/50 hidden md:block">03</div>
          </div>
          <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-[#111] p-10 flex flex-col justify-between min-h-[480px] group hover:bg-[#111] hover:text-[#FAFAF7] transition-colors duration-500">
              <div>
                <div className="text-[10px] tracking-[0.2em] mb-10 uppercase flex justify-between">
                  <span>Single Day</span>
                  <span className="text-[#111]/40 group-hover:text-[#FAFAF7]/40">01</span>
                </div>
                <h3 className="font-serif text-5xl mb-6">單日票</h3>
                <div className="text-xs tracking-widest text-[#111]/60 group-hover:text-[#FAFAF7]/60 mb-10">ONE DAY PASS</div>
                <p className="text-sm opacity-80 leading-relaxed">
                  適用於單日入場，探索展覽與舞臺節目。包含所有公共區域及表演活動的觀賞權限。
                </p>
              </div>
              <div className="flex items-end justify-between border-t border-[#111]/10 group-hover:border-[#FAFAF7]/10 pt-8 mt-8">
                <div className="font-serif text-6xl">NT$200</div>
                <button className="w-14 h-14 rounded-full border border-current flex items-center justify-center group-hover:bg-[#FF4A1C] group-hover:border-[#FF4A1C] transition-colors">
                  <ArrowUpRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="border border-[#111] p-10 flex flex-col justify-between min-h-[480px] group hover:bg-[#111] hover:text-[#FAFAF7] transition-colors duration-500 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#FF4A1C] text-white text-[10px] tracking-[0.2em] px-6 py-2 uppercase">Best Value</div>
              <div>
                <div className="text-[10px] tracking-[0.2em] mb-10 uppercase flex justify-between">
                  <span>Two Days</span>
                  <span className="text-[#111]/40 group-hover:text-[#FAFAF7]/40">02</span>
                </div>
                <h3 className="font-serif text-5xl mb-6">兩日套票</h3>
                <div className="text-xs tracking-widest text-[#111]/60 group-hover:text-[#FAFAF7]/60 mb-10">WEEKEND PASS</div>
                <p className="text-sm opacity-80 leading-relaxed">
                  完整體驗週末所有賽事與表演。無限次進出會場，不錯過任何精彩瞬間。
                </p>
              </div>
              <div className="flex items-end justify-between border-t border-[#111]/10 group-hover:border-[#FAFAF7]/10 pt-8 mt-8">
                <div className="font-serif text-6xl">NT$300</div>
                <button className="w-14 h-14 rounded-full border border-current flex items-center justify-center group-hover:bg-[#FF4A1C] group-hover:border-[#FF4A1C] transition-colors">
                  <ArrowUpRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Contestants */}
      <section className="py-32 px-6 md:px-12 border-b border-[#111]/10 overflow-hidden bg-[#FAFAF7]">
        <div className="mb-20 flex justify-between items-end">
          <div className="max-w-md">
            <h2 className="text-xs tracking-[0.2em] uppercase mb-4">Featured Contestants</h2>
            <p className="text-sm text-[#111]/60 leading-relaxed">
              集結來自亞洲各地的頂尖氣球藝術家，帶來突破想像的作品。
            </p>
          </div>
          <div className="text-sm font-serif italic text-[#111]/50">04</div>
        </div>
        
        <div className="flex gap-12 overflow-x-auto pb-12 snap-x hide-scrollbar">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="min-w-[320px] w-[320px] shrink-0 snap-start">
              <div className="aspect-[3/4] bg-[#111]/5 mb-8 relative group overflow-hidden border border-[#111]/10">
                <div className="absolute inset-0 bg-[#111] opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500" />
                {/* Abstract geometric placeholder for artwork */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <div className={`w-32 h-32 border border-[#111] ${i % 2 === 0 ? 'rounded-full' : 'rotate-45'}`} />
                </div>
                <div className="absolute bottom-6 left-6 text-xs tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-500 text-[#111] flex items-center gap-2">
                  View Portfolio <ArrowRight className="w-3 h-3" />
                </div>
              </div>
              <div className="flex justify-between items-start border-t border-[#111]/10 pt-4">
                <div>
                  <div className="text-[10px] tracking-[0.2em] text-[#FF4A1C] mb-3">CONTESTANT 0{i}</div>
                  <h3 className="font-serif text-3xl">選手 {i}</h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Sponsors */}
      <section className="py-32 px-6 md:px-12 border-b border-[#111]/10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-4">
            <h2 className="text-xs tracking-[0.2em] uppercase">Partners</h2>
            <div className="text-sm font-serif italic text-[#111]/50 mt-4 md:hidden">05</div>
          </div>
          <div className="md:col-span-8">
            <div className="grid grid-cols-2 gap-px bg-[#111]/10 border border-[#111]/10">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-[3/2] bg-[#FAFAF7] flex flex-col items-center justify-center group hover:bg-[#FAFAF7]/50 transition-colors p-8 text-center">
                  <div className="w-16 h-16 border border-[#111]/20 rounded-full mb-4 flex items-center justify-center group-hover:border-[#FF4A1C] transition-colors">
                    <span className="font-serif text-xl opacity-40 group-hover:text-[#FF4A1C] group-hover:opacity-100 transition-all">{i}</span>
                  </div>
                  <span className="text-[10px] tracking-[0.2em] uppercase text-[#111]/40 group-hover:text-[#111] transition-colors">Sponsor Partner</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="bg-[#111] text-[#FAFAF7] px-6 md:px-12 pt-32 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 mb-32 border-b border-[#FAFAF7]/10 pb-24">
          <div className="md:col-span-6">
            <h2 className="font-serif text-[8vw] leading-none mb-12 tracking-tight">
              See you<br />
              in <span className="italic text-[#FF4A1C]">2026.</span>
            </h2>
            <div className="flex gap-8">
              <a href="#" className="text-[10px] tracking-[0.2em] uppercase hover:text-[#FF4A1C] transition-colors">Instagram</a>
              <a href="#" className="text-[10px] tracking-[0.2em] uppercase hover:text-[#FF4A1C] transition-colors">Facebook</a>
              <a href="#" className="text-[10px] tracking-[0.2em] uppercase hover:text-[#FF4A1C] transition-colors">YouTube</a>
            </div>
          </div>
          <div className="md:col-span-3 flex flex-col justify-end">
            <h4 className="text-[10px] tracking-[0.2em] text-[#FAFAF7]/50 uppercase mb-6">Contact</h4>
            <div className="flex flex-col gap-3 text-sm opacity-80">
              <a href="mailto:info@ballooncarnival.tw" className="hover:text-[#FF4A1C] transition-colors">info@ballooncarnival.tw</a>
              <p>+886 2 1234 5678</p>
            </div>
          </div>
          <div className="md:col-span-3 flex flex-col justify-end">
            <h4 className="text-[10px] tracking-[0.2em] text-[#FAFAF7]/50 uppercase mb-6">Location</h4>
            <div className="flex flex-col gap-3 text-sm opacity-80">
              <p>臺北瓶蓋工廠</p>
              <p>南港區南港路二段13號</p>
              <a href="#" className="text-[#FF4A1C] hover:text-white transition-colors mt-2 inline-flex items-center gap-2 text-xs uppercase tracking-wider">
                Get Directions <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center text-[10px] tracking-[0.2em] uppercase text-[#FAFAF7]/40">
          <p>© 2026 Taiwan Balloon Carnival. All rights reserved.</p>
          <div className="flex gap-8 mt-6 md:mt-0">
            <a href="#" className="hover:text-[#FAFAF7] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#FAFAF7] transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
