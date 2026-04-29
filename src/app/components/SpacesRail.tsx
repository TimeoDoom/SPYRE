"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Space } from "@/lib/session";
import { useLanguage } from "@/app/components/LanguageProvider";
import { SpaceIcon, AVAILABLE_ICONS, AVAILABLE_EMOJIS } from "./SpaceIcon";
import { t } from "@/lib/i18n";
import logodImage from "@/assets/logod.png";

type Props = {
  spaces: Space[];
  activityBySpaceId?: Record<string, boolean>;
};

export default function SpacesRail({ spaces, activityBySpaceId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const _language = useLanguage();
  const currentSpaceId = searchParams.get("space") || "principal";
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewSpaceOpen, setIsNewSpaceOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [selectedIconTab, setSelectedIconTab] = useState<"emojis" | "icons">(
    "icons",
  );
  const [selectedIcon, setSelectedIcon] = useState("fork-knife");
  const [isMounted, setIsMounted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const buildMailHref = (spaceId: string) => {
    const next = new URLSearchParams();
    next.set("space", spaceId);
    const box = searchParams.get("box");
    const q = searchParams.get("q");
    if (box) next.set("box", box);
    if (q) next.set("q", q);
    return `/mail?${next.toString()}`;
  };

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/spaces/create", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: newSpaceName.trim(),
          icon: selectedIcon, // For now passing the ID, we might need to map to emoji if backend only supports emojis
        }),
      });

      if (response.ok) {
        const newSpace = await response.json();
        setNewSpaceName("");
        setIsNewSpaceOpen(false);
        router.refresh();
        router.replace(buildMailHref(newSpace.id));
      } else {
        console.error("Failed to create space");
      }
    } catch (error) {
      console.error("Error creating space:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCurrentSpace = async () => {
    if (!currentSpaceId || currentSpaceId === "principal") {
      setIsSettingsOpen(false);
      return;
    }
    if (!confirm("Delete this space?")) return;
    try {
      const res = await fetch(
        `/api/spaces/${encodeURIComponent(currentSpaceId)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok || !data?.success) {
        alert(typeof data?.error === "string" ? data.error : "Delete failed");
        return;
      }
      setIsSettingsOpen(false);
      router.replace(buildMailHref("principal"));
      router.refresh();
    } catch {
      alert("Delete failed");
    }
  };

  const orderedSpaces = useMemo(() => {
    const list = [...(spaces || [])];
    list.sort((a, b) => {
      if (a.id === "principal") return -1;
      if (b.id === "principal") return 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [spaces]);

  const renderSpaceIcon = (space: Space) => {
    return <SpaceIcon space={space} />;
  };

  const spaceIcons = orderedSpaces.slice(0, 5); // Increased from 3
  const appIcons = orderedSpaces.slice(5); // Rest of the spaces

  return (
    <>
      <nav className="spaces-rail">
        {/* Logo */}
        <div className="spaces-rail-logo">
          <img className="logo" src={logodImage.src} alt="logo" />
        </div>

        {/* SPACE Section */}
        <span className="spaces-rail-section-label">SPACE</span>
        <div className="spaces-rail-section">
          {spaceIcons.map((space) => {
            const isActive = space.id === currentSpaceId;
            const hasActivity = Boolean(activityBySpaceId?.[space.id]);
            return (
              <button
                key={space.id}
                type="button"
                onClick={() => {
                  if (space.id === currentSpaceId) return;
                  router.replace(buildMailHref(space.id));
                }}
                className="spaces-rail-item"
                title={space.name}
              >
                <div
                  className={`spaces-rail-item-icon ${isActive ? "active" : ""}`}
                >
                  {renderSpaceIcon(space)}
                </div>
                {hasActivity && !isActive && (
                  <div className="spaces-rail-activity-dot" />
                )}
              </button>
            );
          })}
        </div>

        {/* APP Section (if any more spaces) */}
        {appIcons.length > 0 && (
          <>
            <div className="spaces-rail-divider" />
            <span className="spaces-rail-section-label">OTHERS</span>
            <div className="spaces-rail-section">
              {appIcons.map((space) => {
                const isActive = space.id === currentSpaceId;
                return (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => {
                      if (space.id === currentSpaceId) return;
                      router.replace(buildMailHref(space.id));
                    }}
                    className="spaces-rail-item"
                    title={space.name}
                  >
                    <div
                      className={`spaces-rail-item-icon ${isActive ? "active" : ""}`}
                    >
                      {renderSpaceIcon(space)}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Bottom */}
        <div className="spaces-rail-bottom">
          <div className="spaces-settings-container">
            {isSettingsOpen && (
              <div className="spaces-settings-popup">
                <button
                  className="spaces-settings-item"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsNewSpaceOpen(true);
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  New space
                </button>
                {/* <button className="spaces-settings-item" onClick={() => setIsSettingsOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 0 0-10 10 10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                Customise
              </button> */}
                <button
                  className="spaces-settings-item"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    router.push("/settings");
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  Settings
                </button>
                <button
                  className="spaces-settings-item delete"
                  onClick={handleDeleteCurrentSpace}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M17.5 3.33333H14.9166C14.7232 2.39284 14.2115 1.54779 13.4677 0.940598C12.7239 0.333408 11.7935 0.0012121 10.8333 0L9.16663 0C8.20645 0.0012121 7.27606 0.333408 6.53225 0.940598C5.78844 1.54779 5.27671 2.39284 5.08329 3.33333H2.49996C2.27895 3.33333 2.06698 3.42113 1.9107 3.57741C1.75442 3.73369 1.66663 3.94565 1.66663 4.16667C1.66663 4.38768 1.75442 4.59964 1.9107 4.75592C2.06698 4.9122 2.27895 5 2.49996 5H3.33329V15.8333C3.33462 16.938 3.77403 17.997 4.55514 18.7782C5.33626 19.5593 6.3953 19.9987 7.49996 20H12.5C13.6046 19.9987 14.6637 19.5593 15.4448 18.7782C16.2259 17.997 16.6653 16.938 16.6666 15.8333V5H17.5C17.721 5 17.9329 4.9122 18.0892 4.75592C18.2455 4.59964 18.3333 4.38768 18.3333 4.16667C18.3333 3.94565 18.2455 3.73369 18.0892 3.57741C17.9329 3.42113 17.721 3.33333 17.5 3.33333ZM9.16663 1.66667H10.8333C11.3502 1.6673 11.8542 1.82781 12.2763 2.1262C12.6984 2.42459 13.0178 2.84624 13.1908 3.33333H6.80913C6.98211 2.84624 7.30154 2.42459 7.72361 2.1262C8.14569 1.82781 8.64973 1.6673 9.16663 1.66667ZM15 15.8333C15 16.4964 14.7366 17.1323 14.2677 17.6011C13.7989 18.0699 13.163 18.3333 12.5 18.3333H7.49996C6.83692 18.3333 6.20103 18.0699 5.73219 17.6011C5.26335 17.1323 4.99996 16.4964 4.99996 15.8333V5H15V15.8333Z"
                      fill="currentColor"
                    />
                  </svg>
                  Delete space
                </button>
              </div>
            )}
            <button
              type="button"
              className={`spaces-rail-settings ${isSettingsOpen ? "active" : ""}`}
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              title="Settings"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M1 4.75h2.736a3.67 3.67 0 007.195 0H23a1 1 0 000-2H10.931a3.67 3.67 0 00-7.195 0H1a1 1 0 000 2zM7.333 2a1.75 1.75 0 110 3.5 1.75 1.75 0 010-3.5zM23 11h-2.736a3.67 3.67 0 00-7.195 0H1a1 1 0 000 2h12.069a3.67 3.67 0 007.195 0H23a1 1 0 000-2zM16.667 13.75a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM23 19.25h-12.069a3.67 3.67 0 00-7.195 0H1a1 1 0 000 2h2.736a3.67 3.67 0 007.195 0H23a1 1 0 000-2zM7.333 22a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5z"
                  fill="#999999"
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* New Space Modal */}
      {isNewSpaceOpen &&
        isMounted &&
        createPortal(
          <div
            className="new-space-overlay"
            onClick={() => setIsNewSpaceOpen(false)}
          >
            <div
              className="new-space-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="new-space-title">
                {t(_language as any, "spaces.createTitle")}
              </h2>

              <div className="new-space-input-wrapper">
                <input
                  type="text"
                  className="new-space-input"
                  placeholder={t(_language as any, "spaces.name")}
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateSpace();
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="new-space-icon-section">
                <div className="new-space-icon-header">
                  <span className="new-space-icon-label">
                    {t(_language as any, "spaces.icon")}
                  </span>
                  <div className="new-space-toggle">
                    <button
                      className={`new-space-toggle-btn ${selectedIconTab === "emojis" ? "active" : ""}`}
                      onClick={() => setSelectedIconTab("emojis")}
                    >
                      Emojis
                    </button>
                    <button
                      className={`new-space-toggle-btn ${selectedIconTab === "icons" ? "active" : ""}`}
                      onClick={() => setSelectedIconTab("icons")}
                    >
                      Icons
                    </button>
                  </div>
                </div>

                <div className="new-space-icon-grid">
                  {selectedIconTab === "icons"
                    ? AVAILABLE_ICONS.map((icon) => (
                        <div
                          key={icon.id}
                          className={`new-space-icon-item ${selectedIcon === icon.id ? "active" : ""}`}
                          onClick={() => setSelectedIcon(icon.id)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d={icon.path} />
                          </svg>
                        </div>
                      ))
                    : AVAILABLE_EMOJIS.map((emoji) => (
                        <div
                          key={emoji}
                          className={`new-space-icon-item ${selectedIcon === emoji ? "active" : ""}`}
                          onClick={() => setSelectedIcon(emoji)}
                          style={{ fontSize: "28px" }}
                        >
                          {emoji}
                        </div>
                      ))}
                </div>
              </div>

              <div className="new-space-footer">
                <button
                  className="new-space-btn cancel"
                  onClick={() => setIsNewSpaceOpen(false)}
                >
                  {t(_language as any, "common.cancel")}
                </button>
                <button
                  className="new-space-btn create"
                  onClick={handleCreateSpace}
                  disabled={isCreating || !newSpaceName.trim()}
                >
                  {isCreating ? "..." : t(_language as any, "common.create")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
