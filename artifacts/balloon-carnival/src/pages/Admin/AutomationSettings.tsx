import { useState, useEffect, useCallback } from "react";
import { Settings, Clock, Zap, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutomationSetting {
  id: string;
  key: string;
  enabled: boolean;
  config: any;
  updatedAt: string;
}

const SETTING_DEFS = [
  {
    key: "auto_scheduler",
    label: "自動排程發布",
    description: "啟用後，系統每 60 秒自動檢查排程貼文並發布",
    icon: Clock,
    configFields: [
      { key: "interval_seconds", label: "檢查間隔（秒）", type: "number" as const, default: 60 },
    ],
  },
  {
    key: "auto_hashtag",
    label: "自動 Hashtag",
    description: "發布時自動附加預設 Hashtag",
    icon: Zap,
    configFields: [
      { key: "default_hashtags", label: "預設 Hashtags（逗號分隔）", type: "text" as const, default: "2026臺灣氣球嘉年華,BalloonCarnival" },
    ],
  },
  {
    key: "post_notification",
    label: "發布通知",
    description: "貼文發布成功或失敗時發送通知",
    icon: Settings,
    configFields: [
      { key: "notify_on_success", label: "成功時通知", type: "toggle" as const, default: true },
      { key: "notify_on_failure", label: "失敗時通知", type: "toggle" as const, default: true },
    ],
  },
];

export default function AutomationSettingsPage() {
  const [settings, setSettings] = useState<AutomationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [localChanges, setLocalChanges] = useState<Record<string, { enabled: boolean; config: any }>>({});

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/automation-settings", { credentials: "include" });
      if (res.ok) setSettings(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const getSettingValue = (key: string) => {
    if (localChanges[key]) return localChanges[key];
    const existing = settings.find(s => s.key === key);
    return {
      enabled: existing?.enabled || false,
      config: existing?.config || {},
    };
  };

  const updateLocal = (key: string, field: string, value: any) => {
    const current = getSettingValue(key);
    if (field === "enabled") {
      setLocalChanges(prev => ({ ...prev, [key]: { ...current, enabled: value } }));
    } else {
      setLocalChanges(prev => ({
        ...prev,
        [key]: { ...current, config: { ...current.config, [field]: value } },
      }));
    }
  };

  const saveSetting = async (key: string) => {
    const value = getSettingValue(key);
    setSaving(key);
    try {
      const res = await fetch(`/api/admin/automation-settings/${key}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (res.ok) {
        fetchSettings();
        setLocalChanges(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    } catch { alert("儲存失敗"); } finally { setSaving(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">載入中...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display">自動化設定</h1>
        <p className="text-muted-foreground mt-1">管理社群行銷自動化功能</p>
      </div>

      <div className="space-y-4">
        {SETTING_DEFS.map(def => {
          const value = getSettingValue(def.key);
          const hasChanges = !!localChanges[def.key];
          const Icon = def.icon;

          return (
            <div key={def.key} className="bg-white rounded-2xl border p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                    <Icon size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold">{def.label}</h3>
                    <p className="text-sm text-muted-foreground">{def.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => updateLocal(def.key, "enabled", !value.enabled)}
                  className={cn(
                    "relative w-12 h-6 rounded-full transition-colors",
                    value.enabled ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                    value.enabled ? "translate-x-6" : "translate-x-0.5"
                  )} />
                </button>
              </div>

              {value.enabled && def.configFields.length > 0 && (
                <div className="pl-13 space-y-3 mt-4 pt-4 border-t">
                  {def.configFields.map(field => {
                    const fieldValue = value.config[field.key] ?? field.default;
                    if (field.type === "toggle") {
                      return (
                        <div key={field.key} className="flex items-center justify-between">
                          <label className="text-sm">{field.label}</label>
                          <button
                            onClick={() => updateLocal(def.key, field.key, !fieldValue)}
                            className={cn("relative w-10 h-5 rounded-full transition-colors", fieldValue ? "bg-primary" : "bg-muted")}
                          >
                            <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", fieldValue ? "translate-x-5" : "translate-x-0.5")} />
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div key={field.key}>
                        <label className="block text-sm mb-1">{field.label}</label>
                        <input
                          type={field.type}
                          value={fieldValue}
                          onChange={e => updateLocal(def.key, field.key, field.type === "number" ? Number(e.target.value) : e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {hasChanges && (
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <button
                    onClick={() => saveSetting(def.key)}
                    disabled={saving === def.key}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save size={14} />
                    {saving === def.key ? "儲存中..." : "儲存設定"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
