"use client";

import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { usePlayer } from "@/lib/convex-hooks";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { player } = usePlayer();
  const isJoshuaDemo = player?.name === "Joshua Demo";

  const handleThemeToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    // Block dark mode for Joshua Demo
    if (isJoshuaDemo && newTheme === "dark") {
      return; // Prevent switching to dark mode
    }
    setTheme(newTheme);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleThemeToggle}
      aria-label="Toggle theme"
      disabled={isJoshuaDemo && theme !== "dark"}
      title={isJoshuaDemo && theme !== "dark" ? "Dark mode is not available for Joshua Demo" : "Toggle theme"}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
