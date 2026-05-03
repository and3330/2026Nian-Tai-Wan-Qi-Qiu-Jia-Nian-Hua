const KEY = "balloon-carnival:voter-token";

function rand(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function getVoterToken(): string {
  if (typeof window === "undefined") return "";
  try {
    let t = window.localStorage.getItem(KEY);
    if (!t || t.length < 8) {
      t = rand();
      window.localStorage.setItem(KEY, t);
    }
    return t;
  } catch {
    return rand();
  }
}
