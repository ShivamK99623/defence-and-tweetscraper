import { Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { pdfStyles } from "./theme";

interface PdfChartContainerProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  flex?: number;
}

export function PdfChartContainer({
  title,
  subtitle,
  children,
  flex,
}: PdfChartContainerProps) {
  return (
    <View style={[pdfStyles.chartBox, flex !== undefined ? { flex } : {}]}>
      <Text style={pdfStyles.chartTitle}>{title}</Text>
      {subtitle ? <Text style={pdfStyles.chartSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}
