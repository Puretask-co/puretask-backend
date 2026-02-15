// src/types/admin.ts
// Comprehensive TypeScript types for Admin API

export interface AdminDashboardStats {
  overview: {
    totalBookings: number;
    activeCleaners: number;
    activeClients: number;
    totalRevenue: number;
    revenueChange: number; // percentage
    bookingsChange: number; // percentage
  };
  recentBookings: {
    id: string;
    date: string;
    clientName: string;
    cleanerName: string;
    status: string;
    amount: number;
  }[];
  systemHealth: {
    status: "healthy" | "warning" | "critical";
    uptime: number;
    lastCheck: string;
    issues: string[];
  };
  alerts: {
    id: string;
    type: "warning" | "error" | "info";
    message: string;
    timestamp: string;
  }[];
}

export interface BookingConsoleFilters {
  status?: string[];
  dateFrom?: string;
  dateTo?: string;
  cleanerId?: string;
  clientId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface BookingConsoleItem {
  id: string;
  date: string;
  startTime: string;
  hours: number;
  status: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  cleaner: {
    id: string;
    name: string;
    email: string;
    tier: string;
  };
  address: string;
  amount: number;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface CleanerManagementItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  tier: string;
  reliabilityScore: number;
  averageRating: number;
  totalJobs: number;
  totalEarnings: number;
  status: "active" | "inactive" | "suspended";
  verifiedBadge: boolean;
  instantBookEnabled: boolean;
  specialtyTags: string[];
  serviceLocations: string[];
  aiOnboardingCompleted: boolean;
  aiFeaturesActiveCount: number;
  createdAt: string;
  lastActiveAt: string;
}

export interface ClientManagementItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  totalBookings: number;
  totalSpent: number;
  creditBalance: number;
  status: "active" | "inactive" | "flagged";
  riskFlags: string[];
  createdAt: string;
  lastBookingAt?: string;
}

export interface AnalyticsData {
  revenue: {
    total: number;
    byPeriod: { date: string; amount: number }[];
    byCleaningType: { type: string; amount: number; count: number }[];
    change: number;
  };
  bookings: {
    total: number;
    byStatus: { status: string; count: number }[];
    byPeriod: { date: string; count: number }[];
    avgValue: number;
  };
  cleaners: {
    total: number;
    active: number;
    byTier: { tier: string; count: number }[];
    topPerformers: {
      id: string;
      name: string;
      earnings: number;
      rating: number;
      jobCount: number;
    }[];
  };
  clients: {
    total: number;
    active: number;
    newThisMonth: number;
    retentionRate: number;
  };
}

export interface FinanceCenterData {
  pendingPayouts: {
    total: number;
    amount: number;
    items: {
      id: string;
      cleanerName: string;
      cleanerId: string;
      amount: number;
      jobCount: number;
      periodStart: string;
      periodEnd: string;
    }[];
  };
  recentTransactions: {
    id: string;
    type: string;
    amount: number;
    description: string;
    timestamp: string;
    status: string;
  }[];
  revenueBreakdown: {
    gross: number;
    cleanerPayouts: number;
    platformFee: number;
    net: number;
  };
}

export interface RiskManagementData {
  flaggedClients: {
    id: string;
    name: string;
    email: string;
    flags: {
      type: string;
      reason: string;
      severity: "low" | "medium" | "high";
      createdAt: string;
    }[];
    totalBookings: number;
    disputeCount: number;
  }[];
  flaggedCleaners: {
    id: string;
    name: string;
    email: string;
    flags: {
      type: string;
      reason: string;
      severity: "low" | "medium" | "high";
      createdAt: string;
    }[];
    reliabilityScore: number;
  }[];
  disputes: {
    id: string;
    bookingId: string;
    initiator: string;
    subject: string;
    status: string;
    createdAt: string;
  }[];
  safetyIncidents: {
    id: string;
    reportedBy: string;
    incidentType: string;
    severity: string;
    status: string;
    createdAt: string;
  }[];
}

export interface MessageLogItem {
  id: string;
  messageType: string;
  cleanerId: string;
  cleanerName: string;
  clientId: string;
  clientName: string;
  bookingId?: string;
  channels: string[];
  deliveryResults: Record<string, any>;
  sentAt: string;
  openedAt?: string;
  clickedAt?: string;
}

export interface SystemConfig {
  featureFlags: {
    name: string;
    enabled: boolean;
    description: string;
  }[];
  platformSettings: {
    maintenanceMode: boolean;
    registrationEnabled: boolean;
    bookingEnabled: boolean;
    minBookingHours: number;
    maxBookingHours: number;
    cancellationWindowHours: number;
  };
  pricingConfig: {
    basePricePerHour: number;
    platformFeePercentage: number;
    stripeFeePercentage: number;
    stripeFeeFixed: number;
  };
}

export interface AdminAuditLogEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export interface BulkActionResult {
  success: number;
  failed: number;
  errors: {
    id: string;
    error: string;
  }[];
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
  variables: string[];
  channels: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PricingRule {
  id: string;
  name: string;
  type: "multiplier" | "fixed_adjustment" | "percentage_discount";
  value: number;
  conditions: {
    cleaningType?: string[];
    dayOfWeek?: number[];
    timeOfDay?: string;
    minHours?: number;
  };
  priority: number;
  enabled: boolean;
  validFrom?: string;
  validTo?: string;
}

export interface BundleOffer {
  id: string;
  name: string;
  description: string;
  bookingCount: number;
  discountPercentage: number;
  validityDays: number;
  price: number;
  enabled: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userType: "client" | "cleaner";
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}
