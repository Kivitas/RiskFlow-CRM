import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReset = this.handleReset.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info?.componentStack);
  }

  handleReset() {
    this.setState({ error: null });
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    const message = error?.message || String(error);

    return (
      <div
        role="alert"
        className="mx-auto mt-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
        <p className="mt-1 text-sm text-slate-500">
          This section ran into an unexpected problem. You can try again or reload the page.
        </p>

        <details className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">Error details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">{message}</pre>
        </details>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
