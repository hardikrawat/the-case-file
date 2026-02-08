import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                sidebar: {
                    DEFAULT: "var(--sidebar-background)",
                    foreground: "var(--sidebar-foreground)",
                    accent: "var(--sidebar-accent)",
                    "accent-foreground": "var(--sidebar-accent-foreground)",
                },
                header: {
                    DEFAULT: "var(--header-background)",
                    foreground: "var(--header-foreground)",
                    border: "var(--header-border)",
                },
                panel: {
                    DEFAULT: "var(--panel-background)",
                    foreground: "var(--panel-foreground)",
                    border: "var(--panel-border)",
                },
            },
        },
    },
    plugins: [],
};

export default config;
