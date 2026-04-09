import bgUrgency from "./bg_urgency.png";

export default function SocialPostUrgency() {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        position: "relative",
        fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
        overflow: "hidden",
      }}
    >
      <img
        src={bgUrgency}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 280,
          background: "linear-gradient(180deg, rgba(20,10,30,0.95) 0%, rgba(20,10,30,0.9) 60%, rgba(20,10,30,0) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 300,
          background: "linear-gradient(0deg, rgba(20,10,30,0.95) 0%, rgba(20,10,30,0.9) 60%, rgba(20,10,30,0) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 30,
          right: 30,
          background: "linear-gradient(135deg, #FF0844, #FF6B35)",
          padding: "12px 28px",
          borderRadius: 16,
          transform: "rotate(3deg)",
          boxShadow: "0 4px 20px rgba(255,8,68,0.5)",
          zIndex: 10,
        }}
      >
        <span style={{ color: "white", fontSize: 34, fontWeight: 900 }}>
          ⚡ 每日限量 500 人
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 30,
          left: 40,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <span
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 42,
            fontWeight: 300,
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            letterSpacing: 6,
          }}
        >
          2026
        </span>
        <span
          style={{
            color: "white",
            fontSize: 68,
            fontWeight: 900,
            textShadow: "0 4px 16px rgba(0,0,0,0.5)",
            letterSpacing: 6,
            lineHeight: 1.15,
          }}
        >
          臺灣氣球
        </span>
        <span
          style={{
            color: "white",
            fontSize: 68,
            fontWeight: 900,
            textShadow: "0 4px 16px rgba(0,0,0,0.5)",
            letterSpacing: 6,
            lineHeight: 1.15,
          }}
        >
          嘉年華
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 40,
          top: "48%",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.92)",
            padding: "12px 28px",
            borderRadius: 16,
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 700, color: "#333" }}>
            🎭 氣球藝術服裝遊行
          </span>
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.75)",
            padding: "8px 28px",
            borderRadius: 12,
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 22, color: "#555", fontWeight: 600 }}>
            7/25 15:30 全場僅此一場！
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", gap: 14 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #FF6B35, #FF0844)",
              padding: "14px 40px",
              borderRadius: 24,
              boxShadow: "0 6px 24px rgba(255,8,68,0.4)",
            }}
          >
            <span style={{ color: "white", fontSize: 36, fontWeight: 900 }}>
              單日票 NT$200
            </span>
          </div>
          <div
            style={{
              background: "linear-gradient(135deg, #7B2FF7, #F72585)",
              padding: "14px 40px",
              borderRadius: 24,
              boxShadow: "0 6px 24px rgba(123,47,247,0.4)",
            }}
          >
            <span style={{ color: "white", fontSize: 36, fontWeight: 900 }}>
              兩日套票 NT$300
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 28,
              fontWeight: 700,
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            📅 7/25（六）- 7/26（日）
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: 22,
              fontWeight: 600,
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            📍 臺北瓶蓋工廠
          </span>
        </div>

        <div
          style={{
            background: "#FFD700",
            padding: "12px 48px",
            borderRadius: 30,
            boxShadow: "0 4px 16px rgba(255,215,0,0.5)",
          }}
        >
          <span style={{ color: "#333", fontSize: 32, fontWeight: 900, letterSpacing: 4 }}>
            👉 手刀搶票！
          </span>
        </div>
      </div>
    </div>
  );
}
