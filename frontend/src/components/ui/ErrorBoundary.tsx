/**
 * ErrorBoundary — catches render errors in child components.
 * Prevents a Three.js crash from taking down the entire app.
 */
import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8"
          style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(229,72,77,0.1)" }}>
            <AlertTriangle size={28} style={{ color: "var(--destructive)" }} />
          </div>
          <div className="text-center max-w-md">
            <h2 className="text-base font-semibold mb-1">
              {this.props.fallbackTitle || "Error en el componente"}
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {this.state.error?.message || "Ocurrió un error inesperado."}
            </p>
          </div>
          <button onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
            <RotateCcw size={14} />
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
