import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="content-wrapper" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div
            className="card"
            style={{
              maxWidth: '560px',
              margin: '0 auto',
              padding: '32px',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--bg-main)',
                color: 'var(--danger-text)',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={28} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
              {this.props.fallbackTitle || 'Unable to load this section'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {this.state.error?.message || 'An unexpected rendering error occurred while displaying this section.'}
            </p>
            <button className="btn btn-primary btn-sm" onClick={this.handleReset} style={{ margin: '0 auto' }}>
              <RefreshCw size={14} />
              <span>Retry / Reload Section</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
