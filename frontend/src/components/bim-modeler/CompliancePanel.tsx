/**
 * CompliancePanel — normative validation semaphore display.
 * Shows compliance status with green/yellow/red indicators per rule.
 */
import { useState, useEffect } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, RefreshCw } from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import client from "../../api/client";

interface ComplianceCheck {
  rule_id: string;
  category: string;
  severity: "pass" | "warning" | "fail";
  message: string;
  element_type: string;
  element_id: number;
  element_label: string;
  value: string;
  limit: string;
  code_ref: string;
}

interface ComplianceResult {
  status: "pass" | "warning" | "fail";
  checks: ComplianceCheck[];
  summary: { pass: number; warning: number; fail: number };
  total_checks: number;
}

const SEVERITY_CONFIG = {
  pass: { color: "#30a46c", bg: "rgba(48,164,108,0.08)", icon: ShieldCheck, label: "Cumple" },
  warning: { color: "#f5a623", bg: "rgba(245,166,35,0.08)", icon: ShieldAlert, label: "Advertencia" },
  fail: { color: "#e5484d", bg: "rgba(229,72,77,0.08)", icon: ShieldX, label: "No cumple" },
};

export default function CompliancePanel() {
  const { currentProjectId } = useProjectStore();
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runCheck = async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const res = await client.get(`/compliance/project/${currentProjectId}/check?country=chile`);
      setResult(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runCheck(); }, [currentProjectId]);

  if (!result) return null;

  const StatusIcon = SEVERITY_CONFIG[result.status].icon;

  return (
    <div className="space-y-3">
      {/* Overall status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon size={18} style={{ color: SEVERITY_CONFIG[result.status].color }} />
          <span className="text-xs font-semibold" style={{ color: SEVERITY_CONFIG[result.status].color }}>
            {SEVERITY_CONFIG[result.status].label}
          </span>
        </div>
        <button onClick={runCheck} disabled={loading}
          className="p-1 rounded-md transition-colors disabled:opacity-40"
          style={{ color: "var(--muted-foreground)" }}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2">
        {(["pass", "warning", "fail"] as const).map((s) => (
          <div key={s} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: SEVERITY_CONFIG[s].bg, color: SEVERITY_CONFIG[s].color }}>
            {result.summary[s]}
          </div>
        ))}
      </div>

      {/* Findings */}
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {result.checks
          .filter((c) => c.severity !== "pass")
          .map((check, i) => (
            <div key={i} className="text-[11px] p-2 rounded-lg"
              style={{ background: SEVERITY_CONFIG[check.severity].bg }}>
              <div className="flex items-start gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0"
                  style={{ background: SEVERITY_CONFIG[check.severity].color }} />
                <div>
                  <div style={{ color: "var(--foreground)" }}>{check.message}</div>
                  {check.code_ref && (
                    <div className="mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      Ref: {check.code_ref}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        {result.checks.filter((c) => c.severity !== "pass").length === 0 && (
          <div className="text-[11px] p-2 text-center" style={{ color: "var(--muted-foreground)" }}>
            Todas las validaciones pasaron
          </div>
        )}
      </div>
    </div>
  );
}
