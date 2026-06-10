export const TRACKER_HEADERS = [
  "Date",
  "Name",
  "Job Title",
  "Email",
  "LinkedIn",
  "Phone",
  "Source",
  "Remarks",
  "Connects",
  "Project Price",
] as const;

export type TrackerRowInput = {
  date?: string | null;
  name?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  linkedin?: string | null;
  phone?: string | null;
  source?: string | null;
  remarks?: string | null;
  connects?: string | null;
  projectPrice?: string | null;
};

export type TrackerRow = TrackerRowInput & {
  id: number;
  userId?: number;
  ownerName?: string;
  ownerEmail?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TrackerUserOption = {
  id: number;
  name: string;
  email: string;
};

export type TrackerResponse = {
  headers: string[];
  rows: TrackerRow[];
  isAdmin: boolean;
  users?: TrackerUserOption[];
};
