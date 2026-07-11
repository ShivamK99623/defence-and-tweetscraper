import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "./theme";

interface PdfPageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PdfPageHeader({ title, subtitle }: PdfPageHeaderProps) {
  return (
    <View style={pdfStyles.pageHeader}>
      <Text style={pdfStyles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={pdfStyles.pageSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

interface PdfPageFooterProps {
  section: string;
  generatedAt: string;
}

export function PdfPageFooter({ section, generatedAt }: PdfPageFooterProps) {
  const dateLabel = new Date(generatedAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <View style={pdfStyles.footer} fixed>
      <Text>Defence Media Intelligence · {section}</Text>
      <Text>Generated {dateLabel}</Text>
    </View>
  );
}
