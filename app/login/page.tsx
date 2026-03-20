"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Feil passord");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg)",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "2.5rem",
          width: "100%",
          maxWidth: "380px",
        }}
      >
        <h1
          style={{
            color: "var(--text)",
            fontSize: "1.5rem",
            fontWeight: 700,
            marginBottom: "0.25rem",
          }}
        >
          Innsats
        </h1>
        <p style={{ color: "var(--text-subtle)", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
          Skriv inn passord for å fortsette
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passord"
            autoFocus
            required
            style={{
              width: "100%",
              padding: "0.625rem 0.75rem",
              border: `1px solid ${error ? "#ef4444" : "var(--border)"}`,
              borderRadius: "0.5rem",
              backgroundColor: "var(--bg)",
              color: "var(--text)",
              fontSize: "1rem",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: error ? "0.5rem" : "1rem",
            }}
          />

          {error && (
            <p
              style={{
                color: "#ef4444",
                fontSize: "0.875rem",
                marginBottom: "1rem",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.625rem",
              backgroundColor: "var(--text)",
              color: "var(--surface)",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Logger inn…" : "Logg inn"}
          </button>
        </form>
      </div>
    </div>
  );
}
