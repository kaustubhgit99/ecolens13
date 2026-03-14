"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type AuthMode = "login" | "signup";
type UserRole = "citizen" | "authority";

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("citizen");
  const [selectedWard, setSelectedWard] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const WARDS = [
    "Ward 1 - Rajapeth","Ward 2 - Jaistambh Chowk","Ward 3 - Wadali","Ward 4 - Cidco",
    "Ward 5 - Garoba Maidan","Ward 6 - Panchsheel Nagar","Ward 7 - Shivnagar",
    "Ward 8 - Laxmi Nagar","Ward 9 - Venkatesh Nagar","Ward 10 - Jawahar Gate",
    "Ward 11 - Gandhi Gate","Ward 12 - Prabhat Square","Ward 13 - Camp Area",
    "Ward 14 - Tapadia Nagar","Ward 15 - Badnera",
  ];

  const redirectByRole = (role: string) => {
    if (role === "admin") router.replace("/admin/dashboard");
    else if (role === "authority") router.replace("/authority/dashboard");
    else router.replace("/citizen/dashboard");
  };

  const validatePhone = (value: string): boolean => {
    const cleaned = value.replace(/[\s\-()]/g, "");
    const pattern = /^(\+91)?[6-9]\d{9}$/;
    return pattern.test(cleaned);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (value && !validatePhone(value)) {
      setPhoneError("Enter a valid 10-digit Indian phone number");
    } else {
      setPhoneError("");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    const sb = createClient();
    const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
    if (authErr) { setError(authErr.message); setLoading(false); return; }
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setError("Unable to load user."); setLoading(false); return; }
    const { data: profile } = await sb.from("users").select("role").eq("id", user.id).single();
    redirectByRole(profile?.role ?? "citizen");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");

    if (!fullName.trim()) { setError("Full name is required"); setLoading(false); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); setLoading(false); return; }
    if (!phone.trim()) { setError("Phone number is required"); setLoading(false); return; }
    if (!validatePhone(phone)) { setError("Enter a valid 10-digit Indian phone number"); setLoading(false); return; }

    const sb = createClient();

    const { data: authData, error: signUpErr } = await sb.auth.signUp({
      email,
      password,
    });

    if (signUpErr) { setError(signUpErr.message); setLoading(false); return; }
    if (!authData.user) { setError("Failed to create account"); setLoading(false); return; }

    const cleanedPhone = phone.replace(/[\s\-()]/g, "");
    const { error: profileErr } = await sb.from("users").insert({
      id: authData.user.id,
      email: email.toLowerCase(),
      full_name: fullName.trim(),
      phone: cleanedPhone,
      role: selectedRole,
      ward: selectedWard || null,
      coins_total: 0,
      xp: 0,
      level: 1,
    });

    if (profileErr) {
      console.error("Profile creation error:", profileErr);
      if (profileErr.message.includes("duplicate")) {
        setError("An account with this email already exists. Try signing in.");
      } else {
        setError("Account created but profile setup failed. Please contact support.");
      }
      setLoading(false);
      return;
    }

    const { error: loginErr } = await sb.auth.signInWithPassword({ email, password });
    if (loginErr) {
      setSuccess("Account created successfully! Please sign in.");
      setAuthMode("login");
      setLoading(false);
      return;
    }

    redirectByRole(selectedRole);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #E0F2FE 0%, #E8F4FD 30%, #F0F7FF 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{
        width: 440, maxWidth: "100%", padding: "36px 32px",
        background: "var(--surface)",
        borderRadius: 20,
        boxShadow: "8px 8px 24px rgba(163, 199, 224, 0.5), -6px -6px 16px rgba(255, 255, 255, 0.85)",
        border: "1px solid rgba(255,255,255,0.6)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, boxShadow: "0 4px 14px rgba(14, 165, 233, 0.35)",
          }}>🌿</div>
          <span style={{ fontFamily: "var(--font-syne)", fontSize: 26, fontWeight: 700, color: "var(--text)" }}>
            Eco<span style={{ color: "var(--primary)" }}>Lens</span>
          </span>
        </div>
        <p style={{ textAlign: "center", color: "var(--text2)", fontSize: 12, marginBottom: 24 }}>Amravati Municipal Corporation</p>

        {/* Auth Mode Toggle */}
        <div style={{
          display: "flex", borderRadius: 14, padding: 4, marginBottom: 24,
          background: "var(--surface2)",
          boxShadow: "var(--clay-inset)",
        }}>
          <button
            onClick={() => { setAuthMode("login"); setError(""); setSuccess(""); }}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 11, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .25s",
              background: authMode === "login" ? "linear-gradient(135deg, #0EA5E9, #0284C7)" : "transparent",
              color: authMode === "login" ? "#FFFFFF" : "var(--text2)",
              boxShadow: authMode === "login" ? "0 4px 12px rgba(14, 165, 233, 0.3)" : "none",
            }}
          >Sign In</button>
          <button
            onClick={() => { setAuthMode("signup"); setError(""); setSuccess(""); }}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 11, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .25s",
              background: authMode === "signup" ? "linear-gradient(135deg, #0EA5E9, #0284C7)" : "transparent",
              color: authMode === "signup" ? "#FFFFFF" : "var(--text2)",
              boxShadow: authMode === "signup" ? "0 4px 12px rgba(14, 165, 233, 0.3)" : "none",
            }}
          >Sign Up</button>
        </div>

        {/* Sign In Form */}
        {authMode === "login" && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {error && <div className="alert alert-red" style={{ marginBottom: 12 }}>{error}</div>}
            {success && <div className="alert alert-green" style={{ marginBottom: 12 }}>{success}</div>}
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: 12, marginBottom: 14, borderRadius: 14 }} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Sign In"}
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "var(--text3)" }}>
              Don&apos;t have an account?{" "}
              <span
                style={{ color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}
                onClick={() => { setAuthMode("signup"); setError(""); }}
              >Sign Up</span>
            </p>
          </form>
        )}

        {/* Sign Up Form */}
        {authMode === "signup" && (
          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Full Name *</label>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Rahul Sharma" required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Email *</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Password *</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Phone Number *</label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  fontSize: 13, color: "var(--text3)", fontWeight: 500, pointerEvents: "none",
                }}>+91</span>
                <input
                  className="input" type="tel" value={phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  placeholder="9876543210" required maxLength={15}
                  style={{ paddingLeft: 46 }}
                />
              </div>
              {phoneError && (
                <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>⚠️ {phoneError}</div>
              )}
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>10-digit Indian mobile number required</div>
            </div>

            {/* Role Toggle */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 8 }}>Role *</label>
              <div style={{
                display: "flex", borderRadius: 12, padding: 4,
                background: "var(--surface2)",
                boxShadow: "var(--clay-inset)",
              }}>
                {(["citizen", "authority"] as UserRole[]).map((role) => (
                  <button
                    key={role} type="button"
                    onClick={() => setSelectedRole(role)}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 9, border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 600, fontFamily: "inherit", transition: "all .25s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      background: selectedRole === role
                        ? (role === "citizen" ? "linear-gradient(135deg, #0EA5E9, #0284C7)" : "linear-gradient(135deg, #8B5CF6, #7C3AED)")
                        : "transparent",
                      color: selectedRole === role ? "#FFFFFF" : "var(--text2)",
                      boxShadow: selectedRole === role ? "0 3px 10px rgba(0,0,0,0.12)" : "none",
                    }}
                  >
                    {role === "citizen" ? "🌱" : "🏛️"} {role.charAt(0).toUpperCase() + role.slice(1)}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6 }}>
                {selectedRole === "citizen"
                  ? "Report civic issues and earn EcoCoins"
                  : "Manage and resolve complaints for Amravati Municipal Corporation"}
              </div>
            </div>

            {/* Ward */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 6 }}>Ward (optional)</label>
              <select className="input" value={selectedWard} onChange={e => setSelectedWard(e.target.value)}>
                <option value="">Select ward...</option>
                {WARDS.map(w => <option key={w}>{w}</option>)}
              </select>
            </div>

            {error && <div className="alert alert-red" style={{ marginBottom: 12 }}>{error}</div>}
            {success && <div className="alert alert-green" style={{ marginBottom: 12 }}>{success}</div>}
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: 12, marginBottom: 14, borderRadius: 14 }} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Create Account"}
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "var(--text3)" }}>
              Already have an account?{" "}
              <span
                style={{ color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}
                onClick={() => { setAuthMode("login"); setError(""); }}
              >Sign In</span>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
