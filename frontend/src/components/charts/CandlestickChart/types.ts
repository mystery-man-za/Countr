import type { ChartData } from "../../../hooks/useChartData";

export interface CandlestickChartProps {
  chartData: ChartData;
  currentPrice: number;
}

export interface PriceTick {
  p: number;
  y: number;
  label: string;
}
