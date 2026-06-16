import { useGetNewsArticle } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { Calendar, ArrowLeft, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function NewsDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  
  const { data: article, isLoading, error } = useGetNewsArticle(id);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-20 animate-pulse">
        <div className="h-6 w-24 bg-muted rounded mb-8"></div>
        <div className="h-12 bg-muted rounded-xl w-3/4 mb-6"></div>
        <div className="h-6 bg-muted rounded w-1/4 mb-12"></div>
        <div className="space-y-4">
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="text-center py-32">
        <h2 className="text-2xl font-bold mb-4">找不到此篇消息</h2>
        <Link href="/news" className="text-primary hover:underline">返回最新消息列表</Link>
      </div>
    );
  }

  return (
    <article className="max-w-4xl mx-auto px-4 py-12 md:py-20">
      <Link href="/news" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-medium mb-10 transition-colors">
        <ArrowLeft size={16} /> 返回列表
      </Link>
      
      <header className="mb-12 border-b pb-8">
        <h1 className="text-3xl md:text-5xl font-display leading-tight text-foreground mb-6">
          {article.title}
        </h1>
        
        <div className="flex flex-wrap items-center gap-6 text-muted-foreground font-medium">
          <div className="flex items-center gap-2 bg-secondary/10 text-secondary px-4 py-2 rounded-full">
            <Calendar size={16} />
            發布於 {formatDateTime(article.createdAt)}
          </div>
          {article.updatedAt !== article.createdAt && (
            <div className="flex items-center gap-2">
              <Clock size={16} />
              更新於 {formatDateTime(article.updatedAt)}
            </div>
          )}
        </div>
      </header>
      
      {article.imageUrl && (
        <img
          src={article.imageUrl}
          alt={article.title}
          className="w-full max-h-[480px] object-cover rounded-2xl border mb-10"
          onError={e => (e.currentTarget.style.display = "none")}
        />
      )}

      {article.summary && (
        <div className="text-xl text-muted-foreground font-medium leading-relaxed mb-10 pl-6 border-l-4 border-secondary">
          {article.summary}
        </div>
      )}
      
      <div className="prose prose-lg prose-headings:font-display prose-headings:text-foreground prose-a:text-primary max-w-none text-foreground/90 whitespace-pre-wrap">
        {article.content}
      </div>
    </article>
  );
}
