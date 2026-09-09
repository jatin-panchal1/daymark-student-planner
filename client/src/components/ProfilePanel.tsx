import { X, LogOut, RefreshCw, User, BookOpen, ListChecks, Shield } from "lucide-react";
import type { AuthUser } from "@/App";

type ProfilePanelProps = {
  open: boolean;
  onClose: () => void;
  user: AuthUser;
  onLogout: () => void;
  subjectsCount: number;
  tasksCount: number;
};

export default function ProfilePanel({
  open,
  onClose,
  user,
  onLogout,
  subjectsCount,
  tasksCount,
}: ProfilePanelProps) {
  if (!open) return null;

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const handleLogout = async () => {
    onClose();
    onLogout();
  };

  const handleSwitchAccount = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <>
      <div
        className="profile-panel-backdrop"
        onMouseDown={onClose}
        aria-label="Close profile panel"
      />
      <aside className="profile-panel" role="dialog" aria-label="Your profile">
        <div className="profile-panel-header">
          <p className="eyebrow coral">YOUR ACCOUNT</p>
          <button className="close-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="profile-identity">
          <div className="profile-avatar-lg">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || "Avatar"}
                className="profile-avatar-img"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="profile-identity-info">
            <strong>{user.name || "Student"}</strong>
            <span>{user.email || "\u2014"}</span>
            {user.role === "admin" && (
              <div className="profile-role-badge">
                <Shield size={10} /> Admin
              </div>
            )}
          </div>
        </div>

        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-icon">
              <BookOpen size={15} />
            </div>
            <div>
              <strong>{subjectsCount}</strong>
              <span>subjects</span>
            </div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-icon tasks">
              <ListChecks size={15} />
            </div>
            <div>
              <strong>{tasksCount}</strong>
              <span>tasks total</span>
            </div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-icon accent">
              <User size={15} />
            </div>
            <div>
              <strong>Google</strong>
              <span>login method</span>
            </div>
          </div>
        </div>

        <div className="profile-divider" />

        <div className="profile-actions">
          <button
            className="profile-action-btn switch-btn"
            onClick={handleSwitchAccount}
          >
            <RefreshCw size={16} />
            <span>Sign in with a different account</span>
          </button>
          <button
            className="profile-action-btn logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>

        <p className="profile-panel-footer">
          Your data is private and stored securely.<br />
          Signing out keeps your data intact.
        </p>
      </aside>
    </>
  );
}
