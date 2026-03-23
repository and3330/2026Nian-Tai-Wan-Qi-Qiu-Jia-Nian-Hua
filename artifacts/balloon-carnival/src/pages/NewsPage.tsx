import { useListNews } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Calendar, ArrowRight, Newspaper } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function NewsPage() {
  const { data: news, isLoading } = useListNews();

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-20">
      <div className="flex items-center gap-4 mb-12">
        <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
          <Newspaper size={32} />
        </div>
        <div>
          <h1 className="font-display text-4xl md:text-5xl text-foreground">大會公告與最新消息</h1>
          <p className="text-muted-foreground mt-2">隨時掌握嘉年華的最新動態、天氣異動與每日亮點</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border rounded-3xl p-8 animate-pulse flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-48 h-32 bg-muted rounded-xl"></div>
              <div className="flex-1 space-y-4 py-2">
                <div className="h-6 bg-muted rounded w-1/4"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : news?.length ? (
        <div className="space-y-6">
          {news.map((article) => (
            <Link key={article.id} href={`/news/${article.id}`}>
              <div className="group bg-card border hover:border-secondary/50 rounded-3xl p-6 md:p-8 hover:shadow-xl hover:shadow-secondary/5 transition-all duration-300 hover:-translate-y-1 flex flex-col md:flex-row gap-6 md:gap-10 items-center cursor-pointer">
                
                {/* Date Badge */}
                <div className="shrink-0 flex flex-col items-center justify-center w-24 h-24 rounded-2xl bg-secondary/5 border border-secondary/20 group-hover:bg-secondary group-hover:text-white transition-colors">
                  <span className="text-sm font-bold opacity-80 uppercase tracking-wider">
                    {new Date(article.createdAt).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-3xl font-display leading-none mt-1">
                    {new Date(article.createdAt).getDate()}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 font-medium">
                    <Calendar size={14} />
                    {formatDate(article.createdAt)}
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 group-hover:text-secondary transition-colors">
                    {article.title}
                  </h2>
                  <p className="text-muted-foreground line-clamp-2">
                    {article.summary || article.content.substring(0, 150) + "..."}
                  </p>
                </div>

                {/* Action */}
                <div className="shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-all transform group-hover:translate-x-2">
                  <ArrowRight size={20} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-32 bg-muted/30 rounded-3xl border-2 border-dashed">
          <Newspaper className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-xl text-muted-foreground">目前沒有最新消息</p>
        </div>
      )}
    </div>
  );
}
