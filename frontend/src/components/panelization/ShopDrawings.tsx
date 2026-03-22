import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Loader2,
  FileDown,
  Scissors,
  Building2,
} from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import client from "../../api/client";
import type { PanelizationResult } from "../../types/api";

export default function ShopDrawings() {
  const { currentProjectId } = useProjectStore();
  const [results, setResults] = useState<PanelizationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProjectId) return;
    setLoading(true);
    client
      .get(`/panelization/results/${currentProjectId}`)
      .then((res) => setResults(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [currentProjectId]);

  const downloadPdf = async (url: string, filename: string, key: string) => {
    setDownloading(key);
    try {
      const res = await client.get(url, { responseType: "blob" });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error downloading PDF:", err);
    } finally {
      setDownloading(null);
    }
  };

  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
        Selecciona un proyecto
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-[var(--primary)]" />
          <div>
            <h2 className="text-xl font-bold">Planos de Taller</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Elevaciones de muros, detalles de paneles y listas de corte
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadPdf(
              `/panelization/shop-drawings/${currentProjectId}/cutting-list.pdf`,
              `lista_corte_${currentProjectId}.pdf`,
              "cutting-list"
            )}
            disabled={downloading === "cutting-list" || results.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--secondary)] rounded hover:bg-[var(--secondary)]/80 disabled:opacity-50"
          >
            {downloading === "cutting-list" ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} />}
            Lista de Corte
          </button>
          <button
            onClick={() => downloadPdf(
              `/panelization/shop-drawings/${currentProjectId}/full-set.pdf`,
              `planos_taller_${currentProjectId}.pdf`,
              "full-set"
            )}
            disabled={downloading === "full-set" || results.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded hover:opacity-90 disabled:opacity-50"
          >
            {downloading === "full-set" ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            Set Completo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--muted-foreground)]">
          <FileText size={48} className="opacity-30 mb-4" />
          <p className="text-lg">Sin planos disponibles</p>
          <p className="text-sm mt-1">Paneliza muros primero en la vista "Panelización SIP"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {results.map((result) => (
            <div
              key={result.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-[var(--primary)]" />
                  <div>
                    <h3 className="font-semibold text-sm">{result.wall_name || `Muro ${result.ifc_element_id}`}</h3>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {result.storey} | {result.config_type?.toUpperCase()} | {result.panel_count} paneles
                    </span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded ${
                  result.status === "confirmed"
                    ? "bg-green-500/10 text-green-500"
                    : "bg-yellow-500/10 text-yellow-500"
                }`}>
                  {result.status === "confirmed" ? "Confirmado" : "Borrador"}
                </span>
              </div>

              {/* Wall dimensions */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                <div className="bg-[var(--secondary)] rounded p-2">
                  <div className="font-bold">{result.wall_length_mm ? (result.wall_length_mm / 1000).toFixed(2) : "?"} m</div>
                  <div className="text-[var(--muted-foreground)]">Largo</div>
                </div>
                <div className="bg-[var(--secondary)] rounded p-2">
                  <div className="font-bold">{result.wall_height_mm ? (result.wall_height_mm / 1000).toFixed(2) : "?"} m</div>
                  <div className="text-[var(--muted-foreground)]">Alto</div>
                </div>
                <div className="bg-[var(--secondary)] rounded p-2">
                  <div className="font-bold">{result.total_area_m2?.toFixed(1) || 0} m²</div>
                  <div className="text-[var(--muted-foreground)]">Area</div>
                </div>
              </div>

              {/* Download buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => downloadPdf(
                    `/panelization/shop-drawings/${result.id}/wall-elevation.pdf`,
                    `elevacion_${result.wall_name || result.id}.pdf`,
                    `elevation-${result.id}`
                  )}
                  disabled={downloading === `elevation-${result.id}`}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-[var(--secondary)] rounded hover:bg-[var(--secondary)]/80 disabled:opacity-50"
                >
                  {downloading === `elevation-${result.id}` ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Download size={12} />
                  )}
                  Elevación PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
