import { useListContestants } from "@workspace/api-client-react";
import { ContestantVoteButton, useContestantVoteData } from "@/components/ContestantVoteButton";
import { Users, Heart, ArrowRight, Sparkles, BookOpen } from "lucide-react";
import { Link } from "wouter";

export default function ContestantsPage() {
  const { data: members, isLoading } = useListContestants();
  const voteData = useContestantVoteData();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-rose-50/80 via-pink-50/30 to-background"></div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-100 text-rose-700 font-bold text-sm mb-6">
            <Heart size={16} /> 觀眾投票
          </div>
          <h1 className="font-display text-4xl md:text-6xl mb-6 text-foreground">
            人氣<span className="text-carnival">選手</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-4">
            認識本屆參展的氣球藝術家，把那一票投給最打動你的作品。
          </p>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-2">
            每位觀眾每位選手限投一次・投票結果將於 7/26 公布於現場舞臺
          </p>
        </div>
      </section>

      {/* Contestants grid + vote */}
      <section id="vote" className="py-12 px-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border rounded-3xl h-64 animate-pulse"></div>
            ))}
          </div>
        ) : members && members.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {members.map((member) => (
              <div key={member.id} className="group glass-card rounded-3xl overflow-hidden hover-lift flex flex-col">
                <div className="flex items-start gap-5 p-6 pb-0">
                  <div className="w-20 h-20 rounded-2xl bg-muted overflow-hidden shrink-0 border-2 border-white shadow-sm">
                    {member.imageUrl ? (
                      <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                        <Users size={28} className="text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-bold text-xl truncate group-hover:text-primary transition-colors">{member.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <BookOpen size={14} className="text-rose-500 shrink-0" />
                      <span className="text-sm text-rose-600 font-medium">參展藝術家</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-4 flex-1">
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap line-clamp-5">
                    {member.description}
                  </p>
                </div>
                <div className="px-6 pb-6">
                  <ContestantVoteButton
                    contestantId={member.id}
                    count={voteData.countFor(member.id)}
                    voted={voteData.didVote(member.id)}
                    token={voteData.token}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 max-w-md mx-auto">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-xl text-muted-foreground mb-2">選手名單即將公布</p>
            <p className="text-muted-foreground text-sm">敬請期待本屆參展藝術家名單與作品介紹</p>
          </div>
        )}
      </section>

      {/* CTA back to carnival */}
      <section className="py-16 bg-gradient-to-b from-pink-50/40 to-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl mb-4">想到現場看作品嗎？</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            7/25-26 兩天對外開放，到現場欣賞氣球藝術展覽、表演與親子活動。
          </p>
          <Link
            href="/carnival"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            前往購票入場 <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
}
