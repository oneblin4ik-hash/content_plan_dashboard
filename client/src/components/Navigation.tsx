import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { BarChart3, BookOpen, Sparkles, Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function Navigation() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
      <div className="container flex items-center justify-between py-4">
        <Link href="/">
          <span className="font-bold text-xl text-foreground hover:text-primary transition-colors cursor-pointer">
            Content Plan Dashboard
          </span>
        </Link>

        <div className="flex gap-2 items-center">
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

          <Link href="/generator">
            <Button
              variant={location === "/generator" ? "default" : "ghost"}
              className="flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Генератор</span>
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="ml-2"
            title={theme === "light" ? "Тёмная тема" : "Светлая тема"}
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </nav>
  );
}
