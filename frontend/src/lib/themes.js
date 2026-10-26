export const DEFAULT_THEME = "green";

export const THEMES = [
  {
    id: "green",
    label: "Yaşıl",
    vars: {
      "--qr-primary": "#3a513e",
      "--qr-bg": "#fbf7ee",
      "--qr-soft": "#f9f3e7",
      "--qr-soft-hover": "#f5ebd7",
      "--qr-border": "#cac2a7",
      "--qr-muted": "#f0ece1",
      "--qr-info-bg": "#f0ede3",
      "--qr-info-border": "#ece6dd",
      "--qr-info-text": "#374427"
    }
  },
  {
    id: "wine",
    label: "Bordo",
    vars: {
      "--qr-primary": "#7a2e3f",
      "--qr-bg": "#fdf5f5",
      "--qr-soft": "#f9e9ec",
      "--qr-soft-hover": "#f3d9df",
      "--qr-border": "#d9b4bd",
      "--qr-muted": "#f2e1e5",
      "--qr-info-bg": "#f5e6e9",
      "--qr-info-border": "#e6cdd3",
      "--qr-info-text": "#5f2432"
    }
  },
  {
    id: "navy",
    label: "Göy",
    vars: {
      "--qr-primary": "#1f3a5f",
      "--qr-bg": "#f5f8fc",
      "--qr-soft": "#e9f1f9",
      "--qr-soft-hover": "#dbe7f3",
      "--qr-border": "#b6c8dd",
      "--qr-muted": "#e2ebf5",
      "--qr-info-bg": "#e6eef7",
      "--qr-info-border": "#cddbea",
      "--qr-info-text": "#1b3352"
    }
  },
  {
    id: "brown",
    label: "Qəhvəyi",
    vars: {
      "--qr-primary": "#5b3d28",
      "--qr-bg": "#fbf6f0",
      "--qr-soft": "#f4eade",
      "--qr-soft-hover": "#ecddc9",
      "--qr-border": "#d3bda3",
      "--qr-muted": "#efe1cf",
      "--qr-info-bg": "#f0e5d6",
      "--qr-info-border": "#e0cfb8",
      "--qr-info-text": "#4a3120"
    }
  },
  {
    id: "terracotta",
    label: "Terra-kota",
    vars: {
      "--qr-primary": "#a24e2d",
      "--qr-bg": "#fdf6f1",
      "--qr-soft": "#faeae1",
      "--qr-soft-hover": "#f5dccc",
      "--qr-border": "#dcb8a3",
      "--qr-muted": "#f3e0d4",
      "--qr-info-bg": "#f6e7dd",
      "--qr-info-border": "#e8d2c3",
      "--qr-info-text": "#7f3d23"
    }
  },
  {
    id: "charcoal",
    label: "Antrasit",
    vars: {
      "--qr-primary": "#2f2f2f",
      "--qr-bg": "#f8f6f0",
      "--qr-soft": "#efede4",
      "--qr-soft-hover": "#e5e1d5",
      "--qr-border": "#ccc5b0",
      "--qr-muted": "#eae6da",
      "--qr-info-bg": "#edeae0",
      "--qr-info-border": "#d9d3c4",
      "--qr-info-text": "#262626"
    }
  }
];

export const THEME_IDS = THEMES.map((theme) => theme.id);

export function getTheme(id) {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
}

export function themeStyle(id) {
  return { ...getTheme(id).vars };
}
