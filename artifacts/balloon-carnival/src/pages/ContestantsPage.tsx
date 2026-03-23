import { useListContestants } from "@workspace/api-client-react";
import { Trophy, Star, Award } from "lucide-react";

export default function ContestantsPage() {
  const { data: contestants, isLoading } = useListContestants();

  // Sort by score if available
  const sortedContestants = [...(contestants || [])].sort((a, b) => 
    ((b.score || 0) - (a.score || 0))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-20 relative">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-accent/20 text-accent-foreground rounded-full mb-6 ring-8 ring-accent/10">
          <Trophy size={40} />
        </div>
        <h1 className="font-display text-4xl md:text-5xl mb-4 text-foreground">氣球造型比賽 參賽者展示</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          來自各地的頂尖氣球藝術家齊聚一堂，展現令人驚嘆的創意與技巧。
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-card border rounded-3xl h-96 animate-pulse"></div>
          ))}
        </div>
      ) : sortedContestants.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sortedContestants.map((contestant, idx) => (
            <div key={contestant.id} className="group glass-card rounded-3xl overflow-hidden hover-lift flex flex-col border-2 hover:border-accent/50 relative">
              
              {/* Rank Badge for top 3 */}
              {idx < 3 && (
                <div className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full flex items-center justify-center font-display text-xl text-white shadow-lg shadow-black/20"
                  style={{
                    background: idx === 0 ? 'linear-gradient(135deg, #FCD34D, #F59E0B)' : 
                               idx === 1 ? 'linear-gradient(135deg, #E5E7EB, #9CA3AF)' : 
                                           'linear-gradient(135deg, #FDBA74, #D97706)'
                  }}
                >
                  #{idx + 1}
                </div>
              )}

              <div className="h-64 relative bg-muted overflow-hidden">
                {contestant.imageUrl ? (
                  <img 
                    src={contestant.imageUrl} 
                    alt={contestant.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary/10 text-secondary">
                    <Star size={48} className="opacity-50" />
                  </div>
                )}
                
                {/* Score overlay */}
                {contestant.score !== null && contestant.score !== undefined && (
                  <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg">
                    <Award size={18} className="text-accent" />
                    得分 {contestant.score}
                  </div>
                )}
              </div>
              
              <div className="p-8 flex-1 flex flex-col bg-white">
                <h3 className="font-display text-2xl mb-3 text-foreground">{contestant.name}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                  {contestant.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-32 bg-muted/30 rounded-3xl border-2 border-dashed">
          <p className="text-xl text-muted-foreground">目前沒有參賽者資料</p>
        </div>
      )}
    </div>
  );
}
