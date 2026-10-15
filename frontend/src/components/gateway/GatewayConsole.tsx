import React, { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  Terminal,
  CheckCircle2,
  Copy,
  Check,
  Play,
  RotateCw,
  Zap,
  ShieldAlert,
  Sliders,
  DollarSign,
  Activity,
  Layers,
  ArrowRight,
  ExternalLink,
  Download,
  AlertCircle,
  Radio,
} from "lucide-react";

interface GatewayConsoleProps {
  activeSymbol: string;
  isBridgeConnected: boolean;
  onTradeActionComplete?: () => void;
}

export const GatewayConsole: React.FC<GatewayConsoleProps> = ({
  activeSymbol,
  isBridgeConnected,
  onTradeActionComplete,
}) => {
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedAction, setSelectedAction] = useState<string>("BUY");
  const [orderVolume, setOrderVolume] = useState<number>(0.1);
  const [orderSl, setOrderSl] = useState<number>(150);
  const [orderTp, setOrderTp] = useState<number>(300);
  const [orderTicket, setOrderTicket] = useState<string>("");
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/gateway/status");
      if (res.ok) {
        const data = await res.json();
        setGatewayStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch gateway status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleDispatchCommand = async () => {
    setIsDispatching(true);
    try {
      const res = await fetch("/api/gateway/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: selectedAction,
          symbol: activeSymbol || "Step Index",
          volume: orderVolume,
          sl: orderSl,
          tp: orderTp,
          ticket: orderTicket || undefined,
          reason: "Gateway Console Manual Dispatch",
        }),
      });
      const data = await res.json();
      setDispatchResult(data);
      await fetchStatus();
      if (onTradeActionComplete) onTradeActionComplete();
    } catch (err: any) {
      setDispatchResult({ success: false, error: err.message });
    } finally {
      setIsDispatching(false);
    }
  };

  const copyWebRequestUrl = () => {
    navigator.clipboard.writeText(baseUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const isConnected = isBridgeConnected || !!gatewayStatus?.isEaConnected;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header Banner */}
      <div className="card-panel bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border-indigo-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-400" />
                <span>MetaTrader 5 EA Gateway</span>
              </h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                isConnected
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/30"
              }`}>
                {isConnected ? "EA STREAMING ACTIVE" : "GATEWAY READY — AWAITING EA"}
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Direct WebRequest gateway for MetaTrader 5. Streams live ticks and bars, syncs account balances, and dispatches server-authoritative trading commands to attached EAs.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyWebRequestUrl}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{copiedUrl ? "Copied URL!" : "Copy WebRequest URL"}</span>
            </button>
            <a
              href="/api/ea/download"
              download="ScalarAI_Gateway_EA.mq5"
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download EA</span>
            </a>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="btn btn-secondary text-xs p-2"
              title="Refresh status"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-[10px] uppercase font-mono text-slate-400">Connection State</div>
            <div className={`text-xs font-bold flex items-center gap-1.5 mt-0.5 ${isConnected ? "text-emerald-400" : "text-amber-400"}`}>
              {isConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5 animate-pulse" />}
              <span>{isConnected ? "Connected (Live)" : "Listening on Port 3000"}</span>
            </div>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-[10px] uppercase font-mono text-slate-400">EA Account #</div>
            <div className="text-xs font-bold text-indigo-300 font-mono mt-0.5">
              #{gatewayStatus?.account?.login || "88204192"}
            </div>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-[10px] uppercase font-mono text-slate-400">Active Instrument</div>
            <div className="text-xs font-bold text-white font-mono mt-0.5">
              {gatewayStatus?.activeSymbol || activeSymbol || "Step Index"}
            </div>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-[10px] uppercase font-mono text-slate-400">Account Equity</div>
            <div className="text-xs font-bold text-cyan-300 font-mono mt-0.5">
              ${Number(gatewayStatus?.account?.equity || 10000).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Command Dispatcher & Telemetry (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Command Dispatcher (lg:col-span-7) */}
        <div className="lg:col-span-7 card-panel space-y-4">
          <div className="card-panel-header">
            <div className="card-panel-title flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>Direct EA Command Dispatcher</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Server-Authoritative Queue</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Select Action Command
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {["BUY", "SELL", "CLOSE", "CLOSE_ALL", "MODIFY"].map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setSelectedAction(act)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                      selectedAction === act
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            {(selectedAction === "BUY" || selectedAction === "SELL") && (
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Volume (Lots)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={orderVolume}
                    onChange={(e) => setOrderVolume(parseFloat(e.target.value) || 0.1)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-1.5 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Stop Loss (Pts)</span>
                  <input
                    type="number"
                    value={orderSl}
                    onChange={(e) => setOrderSl(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-1.5 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Take Profit (Pts)</span>
                  <input
                    type="number"
                    value={orderTp}
                    onChange={(e) => setOrderTp(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-1.5 font-mono"
                  />
                </div>
              </div>
            )}

            {(selectedAction === "CLOSE" || selectedAction === "MODIFY") && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Target Ticket Number</span>
                  <input
                    type="text"
                    value={orderTicket}
                    onChange={(e) => setOrderTicket(e.target.value)}
                    placeholder="e.g. 100001"
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-1.5 font-mono"
                  />
                </div>
                {selectedAction === "MODIFY" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block">New SL (Pts)</span>
                      <input
                        type="number"
                        value={orderSl}
                        onChange={(e) => setOrderSl(parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block">New TP (Pts)</span>
                      <input
                        type="number"
                        value={orderTp}
                        onChange={(e) => setOrderTp(parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-1.5 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleDispatchCommand}
              disabled={isDispatching}
              className="btn btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30"
            >
              {isDispatching ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>{isDispatching ? "Dispatching..." : `Send ${selectedAction} Command to EA`}</span>
            </button>

            {/* Execution Result */}
            {dispatchResult && (
              <div className="mt-3 space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Execution Response</span>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-40">
                  {JSON.stringify(dispatchResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: WebRequest Verification & Architecture (lg:col-span-5) */}
        <div className="lg:col-span-5 card-panel space-y-4">
          <div className="card-panel-header">
            <div className="card-panel-title flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>WebRequest Health &amp; Diagnostics</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
              HTTP Polling &amp; Push
            </span>
          </div>

          <div className="space-y-3 text-xs text-slate-300 font-sans">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-mono text-slate-400 uppercase font-bold">MT5 WebRequest URL</div>
              <div className="flex items-center gap-2">
                <code className="text-cyan-300 font-mono text-[11px] bg-slate-900 px-2 py-1 rounded flex-1 truncate border border-slate-800">
                  {baseUrl}
                </code>
                <button
                  onClick={copyWebRequestUrl}
                  className="btn btn-secondary btn-sm text-[10px]"
                >
                  {copiedUrl ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                In MT5: <strong className="text-white">Tools &gt; Options &gt; Expert Advisors</strong>, check <em>"Allow WebRequest for listed URL"</em> and paste the above URL.
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono text-[11px]">
              <div className="text-slate-400 uppercase font-bold text-[10px]">Gateway Architecture:</div>
              <div className="text-slate-300">• Mode: Full Platform Engine + MT5 EA Gateway</div>
              <div className="text-slate-300">• Folder: <span className="text-indigo-400">gateway/</span> and <span className="text-indigo-400">ea/</span></div>
              <div className="text-slate-300">• Heartbeat: Every {gatewayStatus?.secondsSinceLastHeartbeat !== null ? `${gatewayStatus?.secondsSinceLastHeartbeat}s ago` : "2s"}</div>
              <div className="text-slate-300">• Command Queue: {gatewayStatus?.pendingCommandsCount || 0} pending</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GatewayConsole;
