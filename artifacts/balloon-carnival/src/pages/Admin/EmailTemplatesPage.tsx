import { useState, useEffect, useCallback } from "react";
import { Mail, Save, Send, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type EmailTemplate = {
  id: number;
  key: string;
  subject: string;
  body: string;
  updatedAt: string;
};

const TEMPLATE_LABELS: Record<string, { label: string; description: string }> = {
  confirmation: {
    label: "購票確認信",
    description: "購票成功後立即寄送，包含活動資訊與報到 QR Code。",
  },
  week_reminder: {
    label: "活動前一週提醒信",
    description: "活動日前 7 天自動寄送，提醒使用者即將到來的活動。",
  },
  day_reminder: {
    label: "活動前一日提醒信",
    description: "活動日前 1 天自動寄送，提醒入場注意事項。",
  },
};

const SUPPORTED_VARS = ["{{parentName}}", "{{phone}}", "{{eventDate}}", "{{ticketCount}}", "{{qrUrl}}"];

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body: string }>>({});
  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const getCurrent = (tpl: EmailTemplate) => drafts[tpl.key] || { subject: tpl.subject, body: tpl.body };

  const updateDraft = (key: string, field: "subject" | "body", value: string, original: EmailTemplate) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        subject: field === "subject" ? value : (prev[key]?.subject ?? original.subject),
        body: field === "body" ? value : (prev[key]?.body ?? original.body),
      },
    }));
  };

  const hasChanges = (tpl: EmailTemplate) => {
    const draft = drafts[tpl.key];
    if (!draft) return false;
    return draft.subject !== tpl.subject || draft.body !== tpl.body;
  };

  const save = async (tpl: EmailTemplate) => {
    const draft = getCurrent(tpl);
    setSaving(tpl.key);
    try {
      const res = await fetch(`/api/admin/email-templates/${encodeURIComponent(tpl.key)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: draft.subject, body: draft.body }),
      });
      if (res.ok) {
        await fetchTemplates();
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[tpl.key];
          return next;
        });
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "儲存失敗");
      }
    } finally {
      setSaving(null);
    }
  };

  const sendTest = async (tpl: EmailTemplate) => {
    if (!testEmail || !testEmail.includes("@")) {
      alert("請先在上方輸入測試收件人 email");
      return;
    }
    setTestStatus((prev) => ({ ...prev, [tpl.key]: "sending" }));
    try {
      const res = await fetch(`/api/admin/email-templates/${encodeURIComponent(tpl.key)}/test`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: testEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const modeLabel = data.mode === "resend" ? "已透過 Resend 寄出" : "已記錄到伺服器 console (未設定 RESEND_API_KEY)";
        setTestStatus((prev) => ({ ...prev, [tpl.key]: `✓ ${modeLabel}` }));
      } else {
        setTestStatus((prev) => ({ ...prev, [tpl.key]: `✗ ${data.error || "失敗"}` }));
      }
    } catch (err) {
      setTestStatus((prev) => ({ ...prev, [tpl.key]: `✗ ${(err as Error).message}` }));
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">載入中...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display flex items-center gap-3">
          <Mail className="text-primary" /> Email 模板管理
        </h1>
        <p className="text-muted-foreground mt-1">編輯購票確認信與活動提醒信的內容</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-800">
        <div className="flex items-start gap-3">
          <Info size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <p className="font-bold">可用變數：</p>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_VARS.map((v) => (
                <code key={v} className="bg-white px-2 py-1 rounded text-xs font-mono border border-blue-200">{v}</code>
              ))}
            </div>
            <p className="text-xs text-blue-700 mt-2">
              寄信模式：若已設定 <code className="bg-white px-1 rounded">RESEND_API_KEY</code> 環境變數，將透過 Resend 寄送；否則僅記錄至伺服器 console (適合開發測試)。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-5 flex items-center gap-3 flex-wrap">
        <label className="text-sm font-bold flex items-center gap-2 shrink-0">
          <Send size={16} /> 測試收件人 Email：
        </label>
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="輸入 email 後可使用各模板下方的「寄送測試」按鈕"
          className="flex-1 min-w-[260px] px-4 py-2 border rounded-xl text-sm focus:outline-none focus:border-primary"
          data-testid="input-test-email"
        />
      </div>

      <div className="space-y-6">
        {templates.map((tpl) => {
          const meta = TEMPLATE_LABELS[tpl.key] || { label: tpl.key, description: "" };
          const draft = getCurrent(tpl);
          const dirty = hasChanges(tpl);
          const status = testStatus[tpl.key];
          return (
            <div key={tpl.key} className="bg-white rounded-2xl border p-6" data-testid={`template-${tpl.key}`}>
              <div className="mb-4">
                <h3 className="font-bold text-lg">{meta.label}</h3>
                <p className="text-sm text-muted-foreground">{meta.description}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1">主旨</label>
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={(e) => updateDraft(tpl.key, "subject", e.target.value, tpl)}
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:border-primary"
                    data-testid={`input-subject-${tpl.key}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">內文</label>
                  <textarea
                    value={draft.body}
                    onChange={(e) => updateDraft(tpl.key, "body", e.target.value, tpl)}
                    rows={14}
                    className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-primary font-mono"
                    data-testid={`input-body-${tpl.key}`}
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex items-center justify-between gap-4 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  最後更新：{new Date(tpl.updatedAt).toLocaleString("zh-TW")}
                  {status && <span className="ml-3">{status}</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => sendTest(tpl)}
                    disabled={!testEmail || testStatus[tpl.key] === "sending"}
                    className="px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 hover:bg-muted/50 disabled:opacity-50"
                    data-testid={`button-test-${tpl.key}`}
                  >
                    <Send size={14} /> 寄送測試
                  </button>
                  <button
                    onClick={() => save(tpl)}
                    disabled={!dirty || saving === tpl.key}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all",
                      dirty ? "bg-primary text-white hover:bg-primary/90" : "bg-muted text-muted-foreground",
                      saving === tpl.key && "opacity-50",
                    )}
                    data-testid={`button-save-${tpl.key}`}
                  >
                    <Save size={14} /> {saving === tpl.key ? "儲存中..." : "儲存"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
