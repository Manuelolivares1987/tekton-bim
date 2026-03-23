/**
 * LicenseDialog — license activation and status display.
 * Shown from sidebar footer or settings.
 */
import { useState, useEffect } from "react";
import { Key, CheckCircle2, AlertCircle, X } from "lucide-react";
import client from "../../api/client";

interface LicenseStatus {
  valid: boolean;
  plan: string;
  message: string;
  email?: string;
  activated_at?: string;
  activated?: boolean;
  key_prefix?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LicenseDialog({ open, onClose }: Props) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      client.get("/license/status").then((r) => setStatus(r.data)).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const handleActivate = async () => {
    if (!key.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await client.post("/license/activate", { key: key.trim(), email: email.trim() });
      setStatus(res.data);
      setKey("");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || "Error al activar licencia");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      await client.post("/license/deactivate");
      setStatus({ valid: false, plan: "free", message: "Licencia desactivada", activated: false });
    } catch {
      // ignore
    }
  };

  const isActive = status?.valid && status?.activated;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fadeIn">
      <div className="w-[400px] rounded-xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Key size={16} style={{ color: "var(--primary)" }} />
            <h3 className="text-sm font-semibold">Licencia Tekton</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md"
            style={{ color: "var(--muted-foreground)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Current status */}
          {status && (
            <div className="flex items-start gap-3 p-3 rounded-lg"
              style={{
                background: isActive ? "rgba(48,164,108,0.08)" : "rgba(229,164,76,0.08)",
                border: `1px solid ${isActive ? "rgba(48,164,108,0.2)" : "rgba(229,164,76,0.2)"}`,
              }}>
              {isActive ? (
                <CheckCircle2 size={18} style={{ color: "var(--success)" }} className="flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={18} style={{ color: "var(--primary)" }} className="flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-sm font-medium" style={{ color: isActive ? "var(--success)" : "var(--primary)" }}>
                  {isActive ? `Plan ${status.plan.toUpperCase()} activo` : "Modo gratuito"}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {status.message}
                </div>
                {status.key_prefix && (
                  <div className="text-xs font-mono mt-1" style={{ color: "var(--muted-foreground)" }}>
                    {status.key_prefix}
                  </div>
                )}
                {status.email && (
                  <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {status.email}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Activation form */}
          {!isActive && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--muted-foreground)" }}>
                  Clave de licencia
                </label>
                <input type="text" value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="TEKTON-XXXX-XXXX-XXXX-XXXX"
                  className="w-full text-sm font-mono rounded-lg px-3 py-2"
                  style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                  onKeyDown={(e) => e.key === "Enter" && handleActivate()} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--muted-foreground)" }}>
                  Email (opcional)
                </label>
                <input type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
              </div>

              {error && (
                <div className="text-xs p-2 rounded-lg"
                  style={{ background: "rgba(229,72,77,0.08)", color: "var(--destructive)" }}>
                  {error}
                </div>
              )}

              <button onClick={handleActivate} disabled={loading || !key.trim()}
                className="w-full py-2.5 text-sm font-medium rounded-lg transition-opacity disabled:opacity-40"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                {loading ? "Activando..." : "Activar Licencia"}
              </button>
            </div>
          )}

          {/* Deactivate */}
          {isActive && (
            <button onClick={handleDeactivate}
              className="w-full py-2 text-xs rounded-lg"
              style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              Desactivar licencia
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
