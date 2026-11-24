import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled UI error:", error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;
    const message = this.state.error?.message ?? "An unexpected error occurred.";

    return (
      <div className="flex min-h-[320px] items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                {this.props.fallbackTitle ?? "Something went wrong"}
              </h2>
              <p className="text-sm text-muted-foreground">
                An unexpected error prevented this page from loading. You can try again or reload the application.
              </p>
              {isDev ? (
                <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
                  {message}
                </pre>
              ) : null}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={this.handleReset} variant="outline" size="sm">
              Try again
            </Button>
            <Button onClick={this.handleReload} size="sm">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
