import { Link } from "wouter";
import { Compass, ArrowUpRight } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{ background: "var(--background)", padding: 24 }}
    >
      <div
        className="bento-card"
        style={{
          width: "100%",
          maxWidth: 460,
          padding: 40,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 9999,
            background: "var(--gold-soft-fill)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <Compass className="w-7 h-7" style={{ color: "var(--brand-gold)" }} />
        </div>

        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: "-2px",
            lineHeight: 1,
            color: "#fff",
          }}
        >
          404
        </div>
        <h3 style={{ marginTop: 12, marginBottom: 10 }}>Такой страницы нет</h3>
        <p
          className="text-platinum"
          style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 28 }}
        >
          Возможно, ссылка устарела или раздел переехал. Вернись на главную и
          продолжай с того места.
        </p>

        <Link href="/">
          <span
            className="btn-gold"
            style={{ justifyContent: "center", width: "100%" }}
          >
            На главную
            <ArrowUpRight className="w-4 h-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
