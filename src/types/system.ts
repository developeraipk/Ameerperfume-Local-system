export type UserRole = "SUPER_ADMIN" | "SHOP_MANAGER" | "CASHIER_OPERATOR" | "OWNER";

export type StationId = "POS-01" | "POS-02";

export interface SystemUser {
  user_id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface StoreConfig {
  storeName: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  ntn: string;
  strn?: string;
  currencySymbol: string;
  receiptFooter: string;
  privacyNotice: string;
}

export interface WorkstationStatus {
  stationId: StationId;
  isPrimaryServer: boolean;
  lanIp: string;
  meshPort: number;
  peerConnected: boolean;
  peerStationId: StationId;
  peerLastHeartbeat: string | null;
  outboxPendingCount: number;
  quarantineConflictCount: number;
  sqliteWalSizeKb: number;
  databaseTablesCount: number;
  databaseIndexesCount: number;
  cloudSyncEnabled: boolean;
  cloudLastSyncedAt: string | null;
  cloudSyncDelayed: boolean;
}

export interface HardwarePeripheralStatus {
  printerConnected: boolean;
  printerModel: string;
  cashDrawerConnected: boolean;
  scannerConnected: boolean;
  spoolerQueuedJobs: number;
}
