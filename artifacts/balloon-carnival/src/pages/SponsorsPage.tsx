import { useListSponsors } from "@workspace/api-client-react";
import { Crown, ExternalLink } from "lucide-react";
import { SponsorTier } from "@workspace/api-client-react";

export default function SponsorsPage() {
  const { data: sponsors, isLoading } = useListSponsors();

  const tierConfig = {
    [SponsorTier.platinum]: { title: "白金贊助", color: "from-slate-300 via-slate-100 to-slate-300", borderColor: "border-slate-300", size: "col-span-2 lg:col-span-4 aspect-[2/1]" },
    [SponsorTier.gold]: { title: "黃金贊助", color: "from-yellow-300 via-yellow-100 to-yellow-300", borderColor: "border-yellow-300", size: "col-span-2 lg:col-span-2 aspect-video" },
    [SponsorTier.silver]: { title: "白銀贊助", color: "from-gray-300 via-gray-100 to-gray-300", borderColor: "border-gray-300", size: "col-span-1 lg:col-span-1 aspect-square" },
    [SponsorTier.bronze]: { title: "青銅贊助", color: "from-orange-300 via-orange-100 to-orange-300", borderColor: "border-orange-300", size: "col-span-1 lg:col-span-1 aspect-square" },
  };

  const groupedSponsors = sponsors?.reduce((acc, sponsor) => {
    if (!acc[sponsor.tier]) acc[sponsor.tier] = [];
    acc[sponsor.tier].push(sponsor);
    return acc;
  }, {} as Record<string, typeof sponsors>) || {};

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

      {isLoading ? (
        <div className="space-y-12">
          <div className="h-64 bg-card rounded-3xl animate-pulse"></div>
          <div className="grid grid-cols-2 gap-6"><div className="h-48 bg-card rounded-2xl animate-pulse"></div><div className="h-48 bg-card rounded-2xl animate-pulse"></div></div>
        </div>
      ) : (
        <div className="space-y-20">
          {[SponsorTier.platinum, SponsorTier.gold, SponsorTier.silver, SponsorTier.bronze].map((tier) => {
            const tierSponsors = groupedSponsors[tier];
            if (!tierSponsors?.length) return null;
            
            const config = tierConfig[tier];
            
            return (
              <section key={tier} className="relative">
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="h-px bg-border flex-1 max-w-[100px]"></div>
                  <h2 className={`font-display text-2xl bg-gradient-to-r ${config.color} bg-clip-text text-transparent drop-shadow-sm`}>
                    {config.title}
                  </h2>
                  <div className="h-px bg-border flex-1 max-w-[100px]"></div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {tierSponsors.map(sponsor => (
                    <a 
                      key={sponsor.id} 
                      href={sponsor.websiteUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`group block bg-white rounded-3xl border-2 ${config.borderColor} hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden flex items-center justify-center p-8 ${config.size}`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-black/0 to-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <img 
                        src={sponsor.logoUrl} 
                        alt={sponsor.name} 
                        className="max-w-full max-h-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-500"
                      />
                      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 p-2 rounded-full">
                        <ExternalLink size={16} className="text-foreground/50" />
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
