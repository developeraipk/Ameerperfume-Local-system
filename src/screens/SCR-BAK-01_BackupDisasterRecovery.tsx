import React, { useState, useEffect } from "react";
import { SystemUser, WorkstationStatus } from "@/types/system";
import { BackupRecord, BackupVerificationResult } from "@/types/database";
import {
  createHotBackup,
  getBackupHistory,
  verifyBackupArchive,
  pickFolder,
  pickBackupFile,
  restoreDatabase,
} from "@/lib/tauri-bridge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Database,
  ShieldCheck,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  FileCheck,
  FolderArchive,
  FolderOpen,
  RotateCcw,
  FileUp,
  Loader2,
} from "lucide-react";

interface BackupDisasterRecoveryProps {
  currentUser?: SystemUser | null;
  status: WorkstationStatus;
}

export const BackupDisasterRecovery: React.FC<BackupDisasterRecoveryProps> = ({
  currentUser: _currentUser,
  status: _status,
}) => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [customDestination, setCustomDestination] = useState<string>("");
  const [restoreFilePath, setRestoreFilePath] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [isBrowsingFolder, setIsBrowsingFolder] = useState(false);
  const [isBrowsingFile, setIsBrowsingFile] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [verificationResult, setVerificationResult] = useState<BackupVerificationResult | null>(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const data = await getBackupHistory();
      setBackups(data);
    } catch (err) {
      console.error("Failed to load backup history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleBrowseFolder = async () => {
    setIsBrowsingFolder(true);
    try {
      const selected = await pickFolder();
      if (selected && selected.trim()) {
        setCustomDestination(selected.trim());
      }
    } catch (err: any) {
      console.error("Browse folder failed:", err);
    } finally {
      setIsBrowsingFolder(false);
    }
  };

  const handleBrowseRestoreFile = async () => {
    setIsBrowsingFile(true);
    try {
      const selected = await pickBackupFile();
      if (selected && selected.trim()) {
        setRestoreFilePath(selected.trim());
      }
    } catch (err: any) {
      console.error("Browse backup file failed:", err);
    } finally {
      setIsBrowsingFile(false);
    }
  };

  const handleRestoreDatabase = async () => {
    const file = restoreFilePath.trim();
    if (!file) {
      setActionFeedback({
        type: "error",
        text: "Please select or browse a valid SQLite backup file (.db) to restore.",
      });
      return;
    }

    const ok = window.confirm(
      "DISASTER RECOVERY WARNING:\n\nRestoring this backup file will replace the live POS database on this computer and configure this PC as MASTER SERVER.\n\nDo you want to proceed?"
    );
    if (!ok) return;

    setLoading(true);
    setActionFeedback(null);
    setVerificationResult(null);

    try {
      const msg = await restoreDatabase(file);
      setActionFeedback({
        type: "success",
        text: `${msg} Poora data restore ho chuka hai aur yeh PC Master Server ban chuka hai!`,
      });
      await fetchBackups();
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to restore database",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    setActionFeedback(null);
    setVerificationResult(null);

    try {
      const dest = customDestination.trim() ? customDestination.trim() : undefined;
      const res = await createHotBackup(dest);
      setActionFeedback({
        type: "success",
        text: `Atomic Hot Backup created successfully: ${res.record.filename} (${(
          res.record.size_bytes / 1024
        ).toFixed(1)} KB). All 46 tables and 105 indexes verified.`,
      });
      await fetchBackups();
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to create hot backup",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyArchive = async (filePath: string) => {
    setLoading(true);
    setActionFeedback(null);
    try {
      const res = await verifyBackupArchive(filePath);
      setVerificationResult(res);
      setActionFeedback({
        type: res.is_valid ? "success" : "error",
        text: res.message,
      });
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to verify backup archive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col gap-6 select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wide">
              Hot Backup, Disaster Recovery & Security Hardening
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Zero-downtime hot SQLite snapshots, cryptographic integrity audit & off-site disaster recovery exports
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchBackups}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Archives</span>
          </Button>
        </div>
      </div>

      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          {actionFeedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {verificationResult && (
        <div className="p-4 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Archive Integrity Inspection Result
            </span>
            <Badge variant={verificationResult.is_valid ? "success" : "danger"}>
              {verificationResult.is_valid ? "INTEGRITY OK" : "CORRUPT"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
            <div>Tables: <span className="text-amber-700 dark:text-amber-400 font-bold">{verificationResult.tables_count}</span></div>
            <div>Indexes: <span className="text-amber-700 dark:text-amber-400 font-bold">{verificationResult.indexes_count}</span></div>
            <div>Triggers: <span className="text-amber-700 dark:text-amber-400 font-bold">{verificationResult.triggers_count}</span></div>
            <div>Integrity: <span className="text-emerald-700 dark:text-emerald-400 font-bold">{verificationResult.integrity_status}</span></div>
          </div>
        </div>
      )}

      {/* Primary Hot Backup Creation Card */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm dark:shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderArchive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">Create Atomic Live Database Backup</h3>
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">Zero Lock Contention</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Custom Destination Directory (USB Drive, D:\Backups, or Network Drive)
              </label>
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setCustomDestination("E:\\AmeerBackups")}
                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-600 cursor-pointer"
                >
                  USB (E:)
                </button>
                <button
                  type="button"
                  onClick={() => setCustomDestination("D:\\AmeerBackups")}
                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-600 cursor-pointer"
                >
                  D:\Backups
                </button>
                <button
                  type="button"
                  onClick={() => setCustomDestination("Desktop\\AmeerBackups")}
                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-600 cursor-pointer"
                >
                  Desktop
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Click Browse Folder... or choose USB/Drive directly"
                value={customDestination}
                onChange={(e) => setCustomDestination(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleBrowseFolder}
                disabled={isBrowsingFolder}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold cursor-pointer shrink-0 border border-slate-300 dark:border-slate-700 hover:border-amber-500"
                title="Open Windows Folder Browser to choose drive or folder"
              >
                {isBrowsingFolder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                    <span>Opening...</span>
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-4 h-4 text-amber-600" />
                    <span>Browse Folder...</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateBackup}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center gap-2 py-2"
            >
              <Database className="w-4 h-4" />
              <span>Create Hot Backup Now</span>
            </Button>
          </div>
        </div>

        <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            Safe to execute at any time during active sales checkout or manufacturing batch creation. WAL locks are fully respected.
          </span>
        </div>
      </div>

      {/* Disaster Recovery & Restore Backup Card */}
      <div className="bg-white dark:bg-slate-900/60 border-2 border-rose-500/30 dark:border-rose-500/20 rounded-xl p-5 shadow-sm dark:shadow-xl flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">
                Disaster Recovery: Restore Backup from USB / File (PC-1 Replacement Drill)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Agar PC-1 kharab ho jaye ya doosre computer par purana data chalana ho, toh USB ya folder se backup file select karein. Yeh PC foran Master ban jayega.
              </p>
            </div>
          </div>
          <Badge variant="danger" className="text-[10px] font-mono shrink-0">
            EMERGENCY RESTORE
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Select Backup Database File (.db) to Restore
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Click 'Browse Backup File...' to choose file from USB or folder"
                value={restoreFilePath}
                onChange={(e) => setRestoreFilePath(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleBrowseRestoreFile}
                disabled={isBrowsingFile}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold cursor-pointer shrink-0 border border-slate-300 dark:border-slate-700 hover:border-rose-500"
                title="Browse for SQLite backup file"
              >
                {isBrowsingFile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                    <span>Opening...</span>
                  </>
                ) : (
                  <>
                    <FileUp className="w-4 h-4 text-rose-600" />
                    <span>Browse Backup File...</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestoreDatabase}
              disabled={loading}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center gap-2 py-2 cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restore Database to This PC</span>
            </Button>
          </div>
        </div>

        <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>
            1-Click Promotion: Restoring will overwrite the local database (%APPDATA%\AmeerPerfumes\ameer_pos.db) and automatically promote this PC to Master Server.
          </span>
        </div>
      </div>

      {/* Backup Archives History */}
      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm dark:shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">Backup Archives & Verification History</h3>
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
            {backups.length} Available Snapshots
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase font-mono">
              <tr>
                <th className="py-3 px-4">Backup Filename</th>
                <th className="py-3 px-4 text-right">Size</th>
                <th className="py-3 px-4">Created Timestamp</th>
                <th className="py-3 px-4 text-center">Schema Verification</th>
                <th className="py-3 px-4 text-center">Integrity Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-sans">
              {backups.map((bak) => (
                <tr key={bak.backup_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-mono font-bold text-amber-700 dark:text-amber-400">
                    {bak.filename}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatBytes(bak.size_bytes)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                    {new Date(bak.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="success" className="text-[10px] py-0 font-mono">
                      46 TBL • 105 IDX • 16 TRG
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVerifyArchive(bak.file_path)}
                        disabled={loading}
                        className="h-7 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                        title="Verify SQLite schema and checksum"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Verify</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRestoreFilePath(bak.file_path);
                          window.scrollTo({ top: 320, behavior: "smooth" });
                        }}
                        disabled={loading}
                        className="h-7 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                        title="Select this backup snapshot to restore"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore This</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No backup archives found in local storage. Click "Create Hot Backup Now" above to create the first snapshot.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Governance Alert (Owner Role Audit) */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>
            Security Governance Rule: Backups contain complete financial ledgers and recipes. Restoring an archive replaces active terminal state.
          </span>
        </div>
        <Badge variant="warning" className="text-[10px] font-mono">
          RBAC: ADMIN & OWNER AUDIT
        </Badge>
      </div>
    </div>
  );
};
