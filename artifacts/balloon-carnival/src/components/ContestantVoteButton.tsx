import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVoterToken } from "@/lib/voterToken";
import { AnimatedNumber } from "@/components/EventCountdown";

type Counts = { contestantId: number; count: number }[];
type Mine = { contestantIds: number[] };

const COUNTS_KEY = ["contestant-votes", "counts"];
const MINE_KEY = (token: string) => ["contestant-votes", "me", token];

export function useContestantVoteData() {
  const token = getVoterToken();
  const counts = useQuery<Counts>({
    queryKey: COUNTS_KEY,
    queryFn: async () => {
      const r = await fetch("/api/contestant-votes/counts");
      if (!r.ok) throw new Error("counts");
      return r.json();
    },
    refetchInterval: 30000,
  });
  const mine = useQuery<Mine>({
    queryKey: MINE_KEY(token),
    queryFn: async () => {
      const r = await fetch(`/api/contestant-votes/me?token=${encodeURIComponent(token)}`);
      if (!r.ok) throw new Error("mine");
      return r.json();
    },
  });
  return {
    token,
    countFor: (id: number) => counts.data?.find((c) => c.contestantId === id)?.count ?? 0,
    didVote: (id: number) => mine.data?.contestantIds.includes(id) ?? false,
    isLoading: counts.isLoading || mine.isLoading,
  };
}

export function ContestantVoteButton({ contestantId, count, voted, token }: { contestantId: number; count: number; voted: boolean; token: string }) {
  const queryClient = useQueryClient();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/contestant-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contestantId, voterToken: token }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error ?? "投票失敗");
      }
      return r.json();
    },
    onSuccess: () => {
      setErrMsg(null);
      queryClient.invalidateQueries({ queryKey: COUNTS_KEY });
      queryClient.invalidateQueries({ queryKey: MINE_KEY(token) });
    },
    onError: (e: Error) => {
      setErrMsg(e.message);
      queryClient.invalidateQueries({ queryKey: MINE_KEY(token) });
      queryClient.invalidateQueries({ queryKey: COUNTS_KEY });
    },
  });

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-50/60 border border-rose-100">
      <div className="flex items-center gap-2 text-sm">
        <Heart size={16} className="text-rose-500 fill-rose-500" />
        <span className="font-medium text-foreground/80">觀眾票數</span>
        <span className="font-display text-xl text-rose-600">
          <AnimatedNumber value={count} />
        </span>
      </div>
      {voted ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
          <Check size={14} /> 已投票
        </span>
      ) : (
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          data-testid={`vote-${contestantId}`}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all",
            mutation.isPending
              ? "bg-rose-200 text-rose-700 cursor-wait"
              : "bg-rose-500 text-white hover:bg-rose-600 hover:shadow",
          )}
        >
          <Heart size={14} /> {mutation.isPending ? "投票中…" : "投他一票"}
        </button>
      )}
      {errMsg && (
        <span className="text-xs text-rose-600 ml-2" role="alert">{errMsg}</span>
      )}
    </div>
  );
}
