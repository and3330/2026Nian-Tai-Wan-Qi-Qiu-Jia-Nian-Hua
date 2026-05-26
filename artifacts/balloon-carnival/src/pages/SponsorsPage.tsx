import { Crown, Sparkles } from "lucide-react";

const sponsors = [
  { name: "台北氣球派對", logo: "images/sponsors/taipei-balloon.jpg" },
  { name: "曄達氣球", logo: "images/sponsors/yeda.jpg" },
  { name: "彩飛屋", logo: "images/sponsors/caifeiwu.svg" },
  { name: "藝人有限公司", logo: null },
  { name: "氣球屋", logo: "images/sponsors/balloon-house.png" },
];

export default function SponsorsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-20">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 text-primary rounded-full mb-6">
          <Crown size={40} />
        </div>
        <h1 className="font-display text-4xl md:text-5xl mb-4">贊助廠商專區</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          特別感謝以下合作夥伴的鼎力支持，讓 2026 臺灣氣球嘉年華得以順利舉行。
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 md:gap-6 max-w-6xl mx-auto">
        {sponsors.map(s => (
          <div
            key={s.name}
            className="group bg-white rounded-3xl border border-border/60 p-6 md:p-8 flex flex-col items-center justify-center gap-4 aspect-square shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            {s.logo ? (
              <div className="flex-1 w-full flex items-center justify-center min-h-0">
                <img
                  src={`${import.meta.env.BASE_URL}${s.logo}`}
                  alt={s.name}
                  className="max-h-24 md:max-h-28 max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex-1 w-full flex items-center justify-center">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
                  <Sparkles size={32} className="text-primary/70" />
                </div>
              </div>
            )}
            <p className="text-base md:text-lg font-bold text-center text-foreground leading-tight">{s.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
