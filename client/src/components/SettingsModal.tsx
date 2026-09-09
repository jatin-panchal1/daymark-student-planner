import { useState, useEffect, FormEvent } from "react";
import { ArrowRight, Settings2, X } from "lucide-react";
import { toast } from "sonner";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  leetcodeUsername: string;
  codeforcesHandle: string;
  onSave: (leetcode: string, codeforces: string) => void;
  saving?: boolean;
};

export default function SettingsModal({ open, onClose, leetcodeUsername, codeforcesHandle, onSave, saving }: SettingsModalProps) {
  const [leetcode, setLeetcode] = useState(leetcodeUsername);
  const [codeforces, setCodeforces] = useState(codeforcesHandle);

  useEffect(() => {
    setLeetcode(leetcodeUsername);
    setCodeforces(codeforcesHandle);
  }, [leetcodeUsername, codeforcesHandle, open]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(leetcode.trim(), codeforces.trim());
    toast.success("Settings saved");
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow coral">CONFIGURATION</p>
            <h2>Settings</h2>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="settings-section">
            <p className="eyebrow" style={{ marginBottom: 14 }}>CODING PLATFORM ACCOUNTS</p>
            <label>
              LeetCode username
              <input
                value={leetcode}
                onChange={(e) => setLeetcode(e.target.value)}
                placeholder="e.g. your_leetcode_username"
              />
            </label>
            <label>
              Codeforces handle
              <input
                value={codeforces}
                onChange={(e) => setCodeforces(e.target.value)}
                placeholder="e.g. your_cf_handle"
              />
            </label>
            <p className="smart-note" style={{ marginTop: 8 }}>
              <Settings2 size={15} />
              <span>
                Enter your public usernames. Data is fetched from public APIs — no passwords needed.
              </span>
            </p>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={saving}>
              Save settings <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
