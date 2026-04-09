import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { BarChart3, BookOpen } from "lucide-react";

export default function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-border shadow-sm">
      <div className="container flex items-center justify-between py-4">
        <Link href="/">
          <span className="font-bold text-xl text-foreground hover:text-primary transition-colors cursor-pointer">
            Content Plan Dashboard
          </span>
        </Link>

        <div className="flex gap-2">
          <Link href="/">
            <Button
              variant={location === "/" ? "default" : "ghost"}
              className="flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">План</span>
            </Button>
          </Link>

          <Link href="/analytics">
            <Button
              variant={location === "/analytics" ? "default" : "ghost"}
              className="flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Аналитика</span>
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
