import { useListExhibitions } from "@workspace/api-client-react";
import { Calendar, MapPin, Clock, ArrowRight, Tent } from "lucide-react";
import { Link } from "wouter";

export default function HomePage() {
  const { data: exhibitions, isLoading } = useListExhibitions();

  return (
    <div className="flex flex-col min-h-screen">
      <section className="relative w-full py-20 lg:py-32 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Colorful hot air balloons" 
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background"></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur border border-primary/20 text-primary font-bold text-sm tracking-widest uppercase shadow-sm">
            SUMMER 2026 EVENT
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-foreground mb-6 drop-shadow-sm">
            2026 臺灣氣球<span className="text-carnival">嘉年華</span>
          </h1>
          <p className="text-xl md:text-2xl text-foreground/80 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
            亞洲最大室內氣球藝術盛典！探索令人驚嘆的巨型氣球裝置，體驗充滿歡樂與奇幻的夏日派對。
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white shadow-sm">
              <Calendar className="text-primary w-6 h-6" />
              <div className="text-left">
                <div className="text-xs text-muted-foreground font-bold">活動日期</div>
                <div className="font-bold text-foreground">7/14 - 7/16</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white shadow-sm">
              <MapPin className="text-secondary w-6 h-6" />
              <div className="text-left">
                <div className="text-xs text-muted-foreground font-bold">活動地點</div>
                <div className="font-bold text-foreground">臺北瓶蓋工廠</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/registration" 
              className="px-8 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center gap-2"
            >
              立即報名訂票 <ArrowRight size={20} />
            </Link>
            <Link 
              href="/news" 
              className="px-8 py-4 rounded-full font-bold text-lg bg-white text-foreground border-2 border-transparent hover:border-border shadow-sm hover:shadow-md transition-all"
            >
              查看最新消息
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 max-w-7xl mx-auto w-full relative">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl mb-4">主題展區導覽</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            五大奇幻展區，每個展區都有獨特的氣球藝術主題，等你來探索！
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-card rounded-3xl p-6 border shadow-sm animate-pulse h-80"></div>
            ))}
          </div>
        ) : exhibitions?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {exhibitions.map((zone, idx) => (
              <div key={zone.id} className="group glass-card rounded-3xl overflow-hidden hover-lift flex flex-col md:flex-row">
                <div className="w-full md:w-2/5 h-64 md:h-auto relative overflow-hidden bg-muted">
                  <img 
                    src={zone.imageUrl || `${import.meta.env.BASE_URL}images/exhibition-${(idx % 2) + 1}.png`} 
                    alt={zone.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-primary shadow-sm">
                    Zone {idx + 1}
                  </div>
                </div>
                <div className="p-8 md:w-3/5 flex flex-col justify-center">
                  <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{zone.name}</h3>
                  <p className="text-muted-foreground mb-6 line-clamp-3">
                    {zone.description}
                  </p>
                  <div className="space-y-3 mt-auto pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                        <MapPin size={16} />
                      </div>
                      {zone.location}
                    </div>
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground">
                        <Clock size={16} />
                      </div>
                      {zone.openTime} - {zone.closeTime}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-3xl">
            <Tent className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p>展區資訊準備中...</p>
          </div>
        )}
      </section>
    </div>
  );
}
