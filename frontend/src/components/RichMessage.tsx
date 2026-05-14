import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Renders Ellie's scripted markdown-ish responses as proper native components.
 * Supports:
 *   • Heading lines wrapped in **...** (no other text on the line) → big bold heading
 *   • Bullet lines beginning with "• " → bullet row
 *   • Numbered lines "1. ..." → numbered row
 *   • Inline **bold** segments within paragraphs
 *   • Horizontal rule (lines starting with ━ or — or =) → divider
 *   • Empty lines → vertical gap
 */

interface RichMessageProps {
  content: string;
  textColor?: string;
  accentColor?: string;
}

interface InlineSegment {
  text: string;
  bold: boolean;
}

const parseInline = (line: string): InlineSegment[] => {
  const segments: InlineSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIdx) segments.push({ text: line.slice(lastIdx, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < line.length) segments.push({ text: line.slice(lastIdx), bold: false });
  if (segments.length === 0) segments.push({ text: line, bold: false });
  return segments;
};

export default function RichMessage({ content, textColor = '#333333', accentColor = '#DB0011' }: RichMessageProps) {
  const lines = content.split('\n');

  return (
    <View>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();

        // Empty line → small spacer
        if (line.trim() === '') {
          return <View key={i} style={{ height: 6 }} />;
        }

        // Divider line
        if (/^[━─=]{3,}$/.test(line.trim())) {
          return <View key={i} style={[styles.divider, { backgroundColor: `${accentColor}20` }]} />;
        }

        // Standalone heading: only **...** content
        const headingMatch = line.match(/^\*\*(.+)\*\*$/);
        if (headingMatch) {
          return (
            <Text key={i} style={[styles.heading, { color: accentColor }]}>
              {headingMatch[1]}
            </Text>
          );
        }

        // Bullet
        if (line.startsWith('• ')) {
          const rest = line.slice(2);
          const segs = parseInline(rest);
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: accentColor }]}>•</Text>
              <Text style={[styles.bulletText, { color: textColor }]}>
                {segs.map((s, j) => (
                  <Text key={j} style={s.bold ? styles.bold : undefined}>
                    {s.text}
                  </Text>
                ))}
              </Text>
            </View>
          );
        }

        // Numbered list e.g. "1. Foo"
        const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) {
          const segs = parseInline(numMatch[2]);
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.numText, { color: accentColor }]}>{numMatch[1]}.</Text>
              <Text style={[styles.bulletText, { color: textColor }]}>
                {segs.map((s, j) => (
                  <Text key={j} style={s.bold ? styles.bold : undefined}>
                    {s.text}
                  </Text>
                ))}
              </Text>
            </View>
          );
        }

        // Regular paragraph with possible inline bold
        const segs = parseInline(line);
        return (
          <Text key={i} style={[styles.paragraph, { color: textColor }]}>
            {segs.map((s, j) => (
              <Text key={j} style={s.bold ? styles.bold : undefined}>
                {s.text}
              </Text>
            ))}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 15, fontWeight: '700', marginTop: 2, marginBottom: 4, letterSpacing: 0.2 },
  paragraph: { fontSize: 14, lineHeight: 21, marginBottom: 2 },
  bold: { fontWeight: '700' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 1 },
  bulletDot: { fontSize: 16, lineHeight: 21, marginRight: 8, marginLeft: 2, fontWeight: '700' },
  numText: { fontSize: 13, lineHeight: 21, marginRight: 8, marginLeft: 2, fontWeight: '700', minWidth: 18 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21 },
  divider: { height: 1, marginVertical: 6, borderRadius: 1 },
});
