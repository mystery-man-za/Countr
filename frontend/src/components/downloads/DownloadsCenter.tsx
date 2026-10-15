import React, { useState } from "react";
import { Download, Layers, Check, Copy, Eye, X, ShieldCheck, Cpu, Terminal, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { TradeConfig } from "../../types";

export interface DownloadsCenterProps {
  config: TradeConfig;
  activeSymbol: string;
  isBridgeConnected: boolean;
  appEndpoint: string;
  copiedLink: boolean;
  onSetEndpoint: (endpoint: string) => void;
  onSaveEndpoint: (endpoint: string) => void;
  onCopyLink: (text: string) => void;
  onDownloadNodejsBridge?: () => void;
  getAppBaseUrl: () => string;
}

export const DownloadsCenter: React.FC<DownloadsCenterProps> = ({
  config,
  activeSymbol,
  isBridgeConnected,
  appEndpoint,
  getAppBaseUrl,
}) => {
  const effectiveUrl = typeof window !== "undefined" ? window.location.origin : (appEndpoint || "http://127.0.0.1:3000");
  const downloadUrl = "/api/ea/download";

  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [eaCode, setEaCode] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [verifyingGateway, setVerifyingGateway] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(effectiveUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  const handleCopyCode = async () => {
    try {
      let codeToCopy = eaCode;
      if (!codeToCopy) {
        const res = await fetch("/api/ea/generator-source");
        codeToCopy = await res.text();
        setEaCode(codeToCopy);
      }
      await navigator.clipboard.writeText(codeToCopy);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const handleOpenCodeModal = async () => {
    setIsCodeModalOpen(true);
    if (!eaCode) {
      setCodeLoading(true);
      try {
        const res = await fetch("/api/ea/generator-source");
        const text = await res.text();
        setEaCode(text);
      } catch (err) {
        setEaCode("// Failed to fetch EA source from server");
      } finally {
        setCodeLoading(false);
      }
    }
  };

  const handleVerifyGateway = async () => {
    setVerifyingGateway(true);
    try {
      const res = await fetch("/api/gateway/status");
      if (res.ok) {
        const data = await res.json();
        setGatewayStatus(data);
      }
    } catch (err) {
      console.error("Failed to check gateway status:", err);
    } finally {
      setVerifyingGateway(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
      {/* Left side download options (lg:col-span-5) */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        {/* 1. Master EA Card */}
        <div className="card-panel flex flex-col space-y-4 border-indigo-500/30 shadow-indigo-950/20">
          <div className="card-panel-header">
            <div className="card-panel-title flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-400" />
              <span>MetaTrader 5 Gateway Expert Advisor</span>
            </div>
            <span className="badge badge-success text-[10px] uppercase font-mono">v2.50 Ready</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Ready-to-compile, pre-made MQL5 Expert Advisor located in the <code className="text-indigo-300 font-mono text-[11px] bg-slate-950 px-1 py-0.5 rounded border border-indigo-500/30">ea/</code> and <code className="text-indigo-300 font-mono text-[11px] bg-slate-950 px-1 py-0.5 rounded border border-indigo-500/30">gateway/</code> folders. Connects MetaTrader 5 directly to the ScalarAI platform with zero extra downloads or bridges.
          </p>

          <div className="flex flex-col gap-2.5">
            {/* Primary Download Button */}
            <a
              href={downloadUrl}
              download="ScalarAI_Gateway_EA.mq5"
              className="btn btn-primary w-full py-3 shadow-md flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span className="font-semibold">Download ScalarAI_Gateway_EA.mq5</span>
            </a>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="btn btn-secondary w-full py-2.5 text-xs text-indigo-300 hover:text-white flex items-center justify-center gap-1.5"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Source</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenCodeModal}
                className="btn btn-secondary w-full py-2.5 text-xs text-slate-300 hover:text-white flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Source</span>
              </button>
            </div>

            {/* WebRequest URL Helper Button */}
            <button
              type="button"
              onClick={handleCopyUrl}
              className="btn btn-secondary w-full py-2.5 text-xs text-cyan-300 hover:text-cyan-100 border-cyan-500/30 hover:border-cyan-400/50 flex items-center justify-center gap-1.5"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied WebRequest URL!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Copy WebRequest URL for MT5</span>
                </>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Full-Featured Gateway EA Capabilities:</span>
            </div>
            <div>• Real-time tick &amp; OHLCV candle streaming straight into SQLite database</div>
            <div>• Remote command polling &amp; instant execution (BUY, SELL, CLOSE, MODIFY)</div>
            <div>• Account telemetry sync: Balance, equity, margin, leverage, broker details</div>
            <div>• Dynamic server-side trailing stop and multi-asset position management</div>
            <div>• Backtesting support: Works in MetaTrader 5 Strategy Tester with server sync</div>
          </div>
        </div>

        {/* 2. Gateway Status Card */}
        <div className="card-panel flex flex-col space-y-4">
          <div className="card-panel-header">
            <div className="card-panel-title flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>EA Gateway Connection Monitor</span>
            </div>
            <button
              type="button"
              onClick={handleVerifyGateway}
              disabled={verifyingGateway}
              className="btn btn-secondary btn-sm flex items-center gap-1 text-[11px]"
            >
              <RefreshCw className={`w-3 h-3 ${verifyingGateway ? "animate-spin" : ""}`} />
              <span>Probe</span>
            </button>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Gateway Status:</span>
              <span className={`font-bold flex items-center gap-1.5 ${isBridgeConnected || gatewayStatus?.isEaConnected ? "text-emerald-400" : "text-amber-400"}`}>
                {isBridgeConnected || gatewayStatus?.isEaConnected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>EA Connected &amp; Streaming</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Ready — Awaiting EA</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Target Server:</span>
              <span className="text-indigo-300 truncate max-w-[200px]">{effectiveUrl}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Active Instrument:</span>
              <span className="text-white font-bold">{activeSymbol || "Step Index"}</span>
            </div>
            {gatewayStatus?.account && (
              <div className="flex justify-between items-center text-slate-300 border-t border-slate-800/80 pt-1.5">
                <span className="text-slate-400">Account #{gatewayStatus.account.login}:</span>
                <span className="text-cyan-300 font-bold">${Number(gatewayStatus.account.balance).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. MT5 Chart Visuals Template (.tpl) Card */}
        <div className="card-panel flex flex-col space-y-4">
          <div className="card-panel-header">
            <div className="card-panel-title">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>MT5 Dark Terminal Template (.tpl)</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Clean dark-theme chart template matching this platform. Disables grid clutter and sets vivid bullish &amp; bearish candles.
          </p>
          <a
            href="/api/ea/template"
            className="btn btn-success w-full py-2.5 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download step_index_chart.tpl</span>
          </a>
        </div>
      </div>

      {/* Right side setup guides (lg:col-span-7) */}
      <div className="lg:col-span-7">
        <div className="card-panel p-6 space-y-6">
          <div className="card-panel-header">
            <div>
              <h3 className="card-panel-title text-base flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>MetaTrader 5 Installation &amp; Setup Guide</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Attach the EA in 3 simple steps to execute real trades and sync live market data.
              </p>
            </div>
          </div>

          <div className="space-y-5 text-xs text-slate-300">
            {/* Step 1 */}
            <div className="flex gap-3 items-start">
              <span className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                1
              </span>
              <div className="space-y-1.5 flex-1">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
                  Save MQ5 File into MetaTrader 5
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Click the <strong className="text-indigo-300">Download ScalarAI_Gateway_EA.mq5</strong> button above. Then:
                </p>
                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-2 text-[11px]">
                  <div>
                    <strong className="text-white">Option A (Standard):</strong> In MetaTrader 5, click <strong className="text-indigo-300">File &gt; Open Data Folder</strong>. Open the <strong className="text-white font-mono">MQL5/Experts/</strong> directory and copy <strong className="text-emerald-300 font-mono">ScalarAI_Gateway_EA.mq5</strong> there.
                  </div>
                  <div>
                    <strong className="text-white">Option B (MetaEditor):</strong> Press <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono">F4</kbd> in MT5 to open MetaEditor. Click <strong className="text-white">New &gt; Expert Advisor</strong>, paste the code from <strong className="text-indigo-300">Copy Source</strong>, and press <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono">F7</kbd> to compile.
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3 items-start">
              <span className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                2
              </span>
              <div className="space-y-1.5 flex-1">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
                  Allow WebRequest in MT5
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  In MetaTrader 5:
                </p>
                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-2 text-[11px]">
                  <div>
                    1. Go to <strong className="text-white">Tools &gt; Options</strong> (or press <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono">Ctrl+O</kbd>).
                  </div>
                  <div>
                    2. Select the <strong className="text-indigo-300 font-semibold">Expert Advisors</strong> tab.
                  </div>
                  <div>
                    3. Check the box <strong className="text-emerald-300">"Allow WebRequest for listed URL"</strong>.
                  </div>
                  <div>
                    4. Add this platform URL:
                    <div className="flex items-center gap-2 mt-1 bg-slate-950 p-2 rounded border border-slate-700">
                      <code className="text-cyan-300 font-mono text-[11px] truncate flex-1">{effectiveUrl}</code>
                      <button
                        onClick={handleCopyUrl}
                        className="btn btn-secondary btn-sm text-[10px] py-1 px-2"
                      >
                        {copiedUrl ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3 items-start">
              <span className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                3
              </span>
              <div className="space-y-1.5 flex-1">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
                  Attach EA to Any Chart
                </h4>
                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-2 text-[11px]">
                  <div>
                    1. Open any chart (e.g. <strong className="text-white">Step Index</strong>, <strong className="text-white">Boom 1000</strong>, <strong className="text-white">Volatility 75</strong>, <strong className="text-white">EURUSD</strong>).
                  </div>
                  <div>
                    2. In the MT5 Navigator panel (<kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono">Ctrl+N</kbd>), expand <strong className="text-indigo-300">Expert Advisors</strong> and drag <strong className="text-emerald-300 font-mono">ScalarAI_Gateway_EA</strong> onto the chart.
                  </div>
                  <div>
                    3. In the <strong className="text-white">Common</strong> tab, ensure <strong className="text-emerald-300">"Allow Algo Trading"</strong> is checked.
                  </div>
                  <div>
                    4. Click <strong className="text-white">OK</strong> and ensure the MT5 top toolbar button <strong className="text-white">"Algo Trading"</strong> is green.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Code Modal */}
      {isCodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-white text-sm">ScalarAI_Gateway_EA.mq5 (Source Code)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="btn btn-secondary btn-sm text-xs flex items-center gap-1"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? "Copied" : "Copy Source"}</span>
                </button>
                <button
                  onClick={() => setIsCodeModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-950">
              {codeLoading ? (
                <div className="flex items-center justify-center h-48 text-slate-400 text-xs font-mono">
                  Loading EA source code...
                </div>
              ) : (
                <pre className="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre">
                  {eaCode}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadsCenter;
