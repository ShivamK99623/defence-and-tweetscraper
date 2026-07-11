"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center">
          <AlertTriangle className="mb-4 h-10 w-10 text-red-500" />
          <h3 className="text-lg font-semibold text-slate-900">
            Something went wrong
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-4 rounded-md bg-defence-green px-4 py-2 text-sm font-medium text-white hover:bg-defence-green/90"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
