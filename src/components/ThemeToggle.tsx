// components/ThemeToggle.tsx
import { useThemeStore } from "../store/themeStore";
import styles from "./Theme.module.css";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button 
      onClick={toggleTheme} 
      className={styles.toggleBtn}
      aria-label={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}
    >
      {theme === "light" ? "🌙 深色模式" : "☀️ 浅色模式"}
    </button>
  );
};

export default ThemeToggle;