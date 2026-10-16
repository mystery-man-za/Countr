# ScalarAI Gateway & MetaTrader 5 EA Integration

The **ScalarAI Gateway** enables direct, bidirectional communication between the web platform and MetaTrader 5 via native HTTP WebRequest and WebSockets.

---

## 📁 Structure

```
gateway/
├── ea/
│   └── ScalarAI_Gateway_EA.mq5   # The compile-ready MetaTrader 5 Expert Advisor
├── gateway-manager.ts            # Central EA telemetry and order execution manager
└── routes.ts                     # REST and streaming endpoints for EA communication
ea/
└── ScalarAI_Gateway_EA.mq5       # Master pre-made EA file for direct download
```

---

## ⚡ Quick Start: Connecting MetaTrader 5

### 1. Download & Compile the EA
1. Download **`ScalarAI_Gateway_EA.mq5`** directly from the **Downloads** tab in the web terminal (or from `ea/ScalarAI_Gateway_EA.mq5`).
2. Open MetaTrader 5, click **File > Open Data Folder**.
3. Navigate to **`MQL5/Experts/`** and copy `ScalarAI_Gateway_EA.mq5` into this folder.
4. Open **MetaEditor** (press **F4** in MT5), find `ScalarAI_Gateway_EA.mq5` under Experts, and click **Compile** (press **F7**). It compiles cleanly with 0 errors.

### 2. Allow WebRequest in MT5
1. In MetaTrader 5, go to **Tools > Options** (or press **Ctrl+O**).
2. Select the **Expert Advisors** tab.
3. Check **"Allow WebRequest for listed URL:"**.
4. Add your platform URL:
   - For local development: `http://127.0.0.1:3000` or `http://localhost:3000`
   - For live deployment: `https://<your-applet-domain>`
5. Click **OK**.

### 3. Attach to Chart
1. In MT5, open the chart for any desired instrument (e.g., `Step Index`, `Boom 1000`, `Volatility 75`, `EURUSD`).
2. In the **Navigator** panel (Ctrl+N), expand **Expert Advisors**, and drag **ScalarAI_Gateway_EA** onto the chart.
3. In the inputs dialog:
   - Ensure **ServerUrl** matches your platform URL.
   - Adjust **InpDefaultLotSize**, **InpDefaultSL**, and **InpDefaultTP** as desired.
   - In the **Common** tab, ensure **"Allow Algo Trading"** is checked.
4. Click **OK** and make sure the top **Algo Trading** toolbar button is green.

The EA will immediately report account balance, equity, and live ticks to the ScalarAI Gateway!
