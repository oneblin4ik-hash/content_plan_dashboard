import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { displayFamily } from "../lib/cyrillicFonts";

export interface HookTitleLine {
  text: string;
  /** Line colour. Short-form hooks put the claim being refuted in red. */
  color?: string;
  /** When this line lands, in seconds from the title's own start. */
  delay?: number;
  fontSize?: number;
}

export interface HookTitleProps {
  lines: HookTitleLine[];
  /** Fraction of frame height where the block starts. */
  top?: number;
  fontSize?: number;
  strokeWidth?: number;
  strokeColor?: string;
  fontFamily?: string;
  align?: "left" | "center" | "right";
}

/**
 * Stacked hook title that builds line by line — the opening card short-form
 * talking-head videos use to state the claim the piece then argues against.
 *
 * The heavy black stroke is drawn with layered text-shadows rather than
 * -webkit-text-stroke: the stroke property thins the glyphs from the inside,
 * which eats the counters on a condensed face at this weight.
 */
export const HookTitle: React.FC<HookTitleProps> = ({
  lines,
  top = 0.06,
  fontSize = 96,
  strokeWidth = 6,
  strokeColor = "#000000",
  fontFamily = displayFamily,
  align = "center",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ring = (w: number) => {
    const steps: string[] = [];
    for (let a = 0; a < 360; a += 45) {
      const r = (a * Math.PI) / 180;
      steps.push(`${(Math.cos(r) * w).toFixed(2)}px ${(Math.sin(r) * w).toFixed(2)}px 0 ${strokeColor}`);
    }
    steps.push(`0 ${(w * 1.4).toFixed(0)}px ${(w * 2).toFixed(0)}px rgba(0,0,0,0.55)`);
    return steps.join(", ");
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end",
        paddingTop: `${top * 100}%`,
        paddingLeft: 48,
        paddingRight: 48,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "inherit" }}>
        {lines.map((line, i) => {
          const start = Math.round((line.delay ?? i * 0.55) * fps);
          const t = frame - start;
          // A short rise: the line is simply not there before its cue.
          const appear = t < 0 ? 0 : interpolate(t, [0, 4], [0, 1], { extrapolateRight: "clamp" });
          const size = line.fontSize ?? fontSize;
          return (
            <div
              key={i}
              style={{
                opacity: appear,
                transform: `translateY(${interpolate(appear, [0, 1], [14, 0])}px)`,
                fontFamily,
                fontWeight: 800,
                fontSize: size,
                lineHeight: 1.12,
                letterSpacing: "0.01em",
                color: line.color ?? "#FFFFFF",
                textTransform: "uppercase",
                textShadow: ring(strokeWidth),
                whiteSpace: "nowrap",
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
