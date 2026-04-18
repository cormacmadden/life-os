"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const base = await apiUrl();
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { email, password, name };

      const res = await fetch(`${base}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.replace("/");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Something went wrong.");
      }
    } catch {
      setError("Could not connect to the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const base = await apiUrl();
      const res = await fetch(`${base}/api/google/login`);
      const data = await res.json();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        setError(data.message || "Google login is not configured.");
      }
    } catch {
      setError("Could not initiate Google login.");
    }
  };

  return (
    <div
      style={{ backgroundColor: "#2c2e31", minHeight: "100vh" }}
      className="flex items-center justify-center px-4"
    >
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-mono font-bold" style={{ color: "#e2b714" }}>
            life<span style={{ color: "#d1d0c5" }}>os</span>
          </h1>
          <p className="text-sm mt-1 font-mono" style={{ color: "#646669" }}>
            your personal dashboard
          </p>
        </div>

        {/* Mode switcher */}
        <div
          className="flex mb-6 rounded overflow-hidden border font-mono text-sm"
          style={{ borderColor: "#646669" }}
        >
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              className="flex-1 py-2 transition-colors"
              style={{
                backgroundColor: mode === m ? "#646669" : "transparent",
                color: mode === m ? "#d1d0c5" : "#646669",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <div>
              <input
                type="text"
                placeholder="name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded font-mono text-sm outline-none transition-colors"
                style={{
                  backgroundColor: "#323437",
                  color: "#d1d0c5",
                  border: "1px solid #646669",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#e2b714")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#646669")}
              />
            </div>
          )}

          <div>
            <input
              type="email"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded font-mono text-sm outline-none transition-colors"
              style={{
                backgroundColor: "#323437",
                color: "#d1d0c5",
                border: "1px solid #646669",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#e2b714")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#646669")}
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full px-4 py-3 rounded font-mono text-sm outline-none transition-colors"
              style={{
                backgroundColor: "#323437",
                color: "#d1d0c5",
                border: "1px solid #646669",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#e2b714")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#646669")}
            />
          </div>

          {error && (
            <p className="text-sm font-mono px-1" style={{ color: "#ca4754" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded font-mono text-sm font-bold transition-opacity"
            style={{
              backgroundColor: "#e2b714",
              color: "#2c2e31",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "..." : mode === "login" ? "login" : "create account"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-5 gap-3">
          <div className="flex-1 h-px" style={{ backgroundColor: "#646669" }} />
          <span className="font-mono text-xs" style={{ color: "#646669" }}>
            or
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "#646669" }} />
        </div>

        {/* Google OAuth button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full py-3 rounded font-mono text-sm flex items-center justify-center gap-3 transition-colors"
          style={{
            backgroundColor: "#323437",
            color: "#d1d0c5",
            border: "1px solid #646669",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#d1d0c5")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#646669")}
        >
          {/* Google "G" icon */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          continue with google
        </button>
      </div>
    </div>
  );
}
