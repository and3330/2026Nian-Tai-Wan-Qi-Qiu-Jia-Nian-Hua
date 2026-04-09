import bgFamily from "./bg_family.png";

export default function SocialPostFamily() {
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
        src={bgFamily}
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
          height: 260,
          background: "linear-gradient(180deg, rgba(30,80,140,0.95) 0%, rgba(30,80,140,0.92) 70%, rgba(30,80,140,0) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 280,
          background: "linear-gradient(0deg, rgba(30,80,140,0.95) 0%, rgba(30,80,140,0.92) 70%, rgba(30,80,140,0) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 35,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #FF6B35, #F72585)",
            padding: "16px 52px",
            borderRadius: 60,
            boxShadow: "0 8px 32px rgba(247,37,133,0.4)",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 58,
              fontWeight: 900,
              letterSpacing: 6,
              textShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            2026 臺灣氣球嘉年華
          </span>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.95)",
            padding: "12px 40px",
            borderRadius: 40,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          }}
        >
          <span
            style={{
              color: "#333",
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            🎈 7/25（六）- 7/26（日）
          </span>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.85)",
            padding: "8px 28px",
            borderRadius: 30,
          }}
        >
          <span style={{ color: "#555", fontSize: 26, fontWeight: 600 }}>
            📍 臺北瓶蓋工廠（南港捷運站 1 號出口）
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 35,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: "#FF6B35",
              padding: "14px 36px",
              borderRadius: 20,
              boxShadow: "0 4px 20px rgba(255,107,53,0.5)",
            }}
          >
            <span style={{ color: "white", fontSize: 38, fontWeight: 900 }}>
              單日票 NT$200
            </span>
          </div>
          <div
            style={{
              background: "#F72585",
              padding: "14px 36px",
              borderRadius: 20,
              boxShadow: "0 4px 20px rgba(247,37,133,0.5)",
            }}
          >
            <span style={{ color: "white", fontSize: 38, fontWeight: 900 }}>
              兩日套票 NT$300
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span
            style={{
              color: "white",
              fontSize: 24,
              fontWeight: 700,
              background: "rgba(0,0,0,0.5)",
              padding: "8px 22px",
              borderRadius: 20,
            }}
          >
            🎟️ 6 歲以下免費入場
          </span>
          <span
            style={{
              color: "#FFD700",
              fontSize: 24,
              fontWeight: 800,
              background: "rgba(0,0,0,0.5)",
              padding: "8px 22px",
              borderRadius: 20,
            }}
          >
            ⚡ 每日限量 500 人
          </span>
        </div>
      </div>
    </div>
  );
}
