"use client";

import { useState } from "react";

export default function TestMailConnection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/mail/test");
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        message: `❌ Erreur: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleTest}
        disabled={loading}
        className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Test en cours..." : "Tester la connexion"}
      </button>

      {result && (
        <div
          className={`rounded-md border p-4 text-sm whitespace-pre-wrap ${
            result.success
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
