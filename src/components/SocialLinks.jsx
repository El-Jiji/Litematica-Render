import React from "react";

// Simple Icons & Material Design paths
// Store as objects to support different viewBoxes
const icons = {
  github: {
    viewBox: "0 0 24 24",
    path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.419-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.24 1.91 1.24 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  },
  curseforge: {
    viewBox: "0 0 260 256",
    path: "M196.422 98.77S247.874 90.623 256 66.858h-78.819V48H4l21.334 24.862v25.473s53.83-2.811 74.653 13.047c28.502 26.532-32.058 62.397-32.058 62.397l-10.384 34.512c16.239-15.529 47.188-35.618 103.933-34.65-21.594 6.854-43.307 17.56-60.211 34.65h114.71l-10.802-34.512s-83.139-49.235-8.753-75.005v-.004Z",
  },
  modrinth: {
    viewBox: "0 0 24 24",
    path: "M12.252.004a11.78 11.768 0 0 0-8.92 3.73a11 10.999 0 0 0-2.17 3.11a11.37 11.359 0 0 0-1.16 5.169c0 1.42.17 2.5.6 3.77c.24.759.77 1.899 1.17 2.529a12.3 12.298 0 0 0 8.85 5.639c.44.05 2.54.07 2.76.02c.2-.04.22.1-.26-1.7l-.36-1.37l-1.01-.06a8.5 8.489 0 0 1-5.18-1.8a5.34 5.34 0 0 1-1.3-1.26c0-.05.34-.28.74-.5a37.572 37.545 0 0 1 2.88-1.629c.03 0 .5.45 1.06.98l1 .97l2.07-.43l2.06-.43l1.47-1.47c.8-.8 1.48-1.5 1.48-1.52c0-.09-.42-1.63-.46-1.7c-.04-.06-.2-.03-1.02.18c-.53.13-1.2.3-1.45.4l-.48.15l-.53.53l-.53.53l-.93.1l-.93.07l-.52-.5a2.7 2.7 0 0 1-.96-1.7l-.13-.6l.43-.57c.68-.9.68-.9 1.46-1.1c.4-.1.65-.2.83-.33c.13-.099.65-.579 1.14-1.069l.9-.9l-.7-.7l-.7-.7l-1.95.54c-1.07.3-1.96.53-1.97.53c-.03 0-2.23 2.48-2.63 2.97l-.29.35l.28 1.03c.16.56.3 1.16.31 1.34l.03.3l-.34.23c-.37.23-2.22 1.3-2.84 1.63c-.36.2-.37.2-.44.1c-.08-.1-.23-.6-.32-1.03c-.18-.86-.17-2.75.02-3.73a8.84 8.839 0 0 1 7.9-6.93c.43-.03.77-.08.78-.1c.06-.17.5-2.999.47-3.039c-.01-.02-.1-.02-.2-.03Zm3.68.67c-.2 0-.3.1-.37.38c-.06.23-.46 2.42-.46 2.52c0 .04.1.11.22.16a8.51 8.499 0 0 1 2.99 2a8.38 8.379 0 0 1 2.16 3.449a6.9 6.9 0 0 1 .4 2.8c0 1.07 0 1.27-.1 1.73a9.37 9.369 0 0 1-1.76 3.769c-.32.4-.98 1.06-1.37 1.38c-.38.32-1.54 1.1-1.7 1.14c-.1.03-.1.06-.07.26c.03.18.64 2.56.7 2.78l.06.06a12.07 12.058 0 0 0 7.27-9.4c.13-.77.13-2.58 0-3.4a11.96 11.948 0 0 0-5.73-8.578c-.7-.42-2.05-1.06-2.25-1.06Z",
  },
  bug: {
    viewBox: "0 0 24 24",
    path: "M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 12h-4v-1h4v1zm0-2h-4v-1h4v1zm0-3h-4V8h4v7z",
  },
};

export function SocialLinks() {
  const links = [
    {
      name: "GitHub Project",
      url: "https://github.com/El-Jiji/Litematica-Render",
      icon: icons.github,
      color: "#333",
    },
    {
      name: "Litematica (CurseForge)",
      url: "https://www.curseforge.com/minecraft/mc-mods/litematica",
      icon: icons.curseforge,
      color: "#f16436",
    },
    {
      name: "Litematica (Modrinth)",
      url: "https://modrinth.com/mod/litematica",
      icon: icons.modrinth,
      color: "#1bd96a",
    },
    {
      name: "Report Issue",
      url: "https://github.com/El-Jiji/Litematica-Render/issues",
      icon: icons.bug,
      color: "#d9534f",
    },
  ];

  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        right: "20px",
        display: "flex",
        gap: "12px",
        zIndex: 1000,
      }}
    >
      {links.map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "42px",
            height: "42px",
            backgroundColor: "rgba(30, 30, 30, 0.6)",
            borderRadius: "50%",
            color: "white",
            transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(4px)",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = link.color;
            e.currentTarget.style.transform = "translateY(-2px) scale(1.1)";
            e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.2)";
            e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(30, 30, 30, 0.6)";
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
            e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
          }}
          title={link.name}
        >
          <svg
            viewBox={link.icon.viewBox}
            width="22"
            height="22"
            fill="currentColor"
            style={{ display: "block" }}
          >
            <path d={link.icon.path} />
          </svg>
        </a>
      ))}
    </div>
  );
}
