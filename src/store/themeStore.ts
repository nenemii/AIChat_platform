import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeStore {
  theme: Theme;
  initTheme: () => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: "light",

  initTheme: () => {
    console.log("[ThemeStore] 开始初始化主题");
    try {
      // 读取 localStorage
      const savedTheme = localStorage.getItem("appTheme") as Theme | null;
      console.log("[ThemeStore] 从localStorage读取到的主题：", savedTheme);

      // 验证本地存储的主题是否有效
      if (savedTheme && ["light", "dark"].includes(savedTheme)) {
        console.log("[ThemeStore] 本地主题有效，设置为：", savedTheme);
        set({ theme: savedTheme });
        // 同步到HTML根元素
        document.documentElement.classList.toggle("dark", savedTheme === "dark");
        console.log("[ThemeStore] 根元素类名更新：", document.documentElement.className);
      } else {
        // 本地存储无效，用默认值
        console.log("[ThemeStore] 本地主题无效或不存在，使用默认light");
        localStorage.setItem("appTheme", "light");
        document.documentElement.classList.remove("dark");
        console.log("[ThemeStore] 根元素类名重置为：", document.documentElement.className);
      }
    } catch (err) {
      console.error("[ThemeStore] 初始化主题失败：", err);
    }
  },

  toggleTheme: () => {
    const { theme, setTheme } = get();
    console.log("[ThemeStore] 触发切换主题，当前主题：", theme);
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
  },

  setTheme: (theme: Theme) => {
    console.log("[ThemeStore] 开始设置主题为：", theme);
    // 验证主题值是否合法
    if (!["light", "dark"].includes(theme)) {
      console.error("[ThemeStore] 无效的主题值：", theme);
      return;
    }

    // 更新状态
    set({ theme });
    console.log("[ThemeStore] Zustand状态已更新为：", theme);

    // 持久化到localStorage
    try {
      localStorage.setItem("appTheme", theme);
      console.log("[ThemeStore] 已写入localStorage，值：", localStorage.getItem("appTheme"));
    } catch (err) {
      console.error("[ThemeStore] 写入localStorage失败：", err);
    }

    // 同步到HTML根元素
    document.documentElement.classList.toggle("dark", theme === "dark");
    console.log("[ThemeStore] 根元素类名更新后：", document.documentElement.className);
  },
}));