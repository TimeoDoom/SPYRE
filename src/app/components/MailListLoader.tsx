"use client";

/**
 * Loading screen displayed while emails are being loaded.
 * Shows a skeleton/spinner to indicate the page is loading.
 */
export function MailListLoader() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "#f8fafc",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            height: "32px",
            backgroundColor: "#e2e8f0",
            borderRadius: "6px",
            animation: "pulse 2s infinite",
          }}
        />
      </div>

      <div style={{ flex: 1 }}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              padding: "16px",
              borderBottom: "1px solid #e2e8f0",
              animation: "pulse 2s infinite",
              animationDelay: `${i * 0.1}s`,
            }}
          >
            <div
              style={{
                height: "20px",
                backgroundColor: "#e2e8f0",
                borderRadius: "4px",
                marginBottom: "8px",
              }}
            />
            <div
              style={{
                height: "16px",
                backgroundColor: "#f1f5f9",
                borderRadius: "4px",
                maxWidth: "80%",
              }}
            />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
