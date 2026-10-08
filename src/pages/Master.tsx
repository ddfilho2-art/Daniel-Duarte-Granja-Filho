import React, { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Palette,
  Eye,
} from "lucide-react";
import {
  listTenants,
  provisionTenant,
  suspendTenant,
  activateTenant,
  createBrandingDraft,
  publishBranding,
  getBrandingVersions,
  type TenantListItem,
  type ProvisionPayload,
  type BrandingDraftPayload,
} from "../lib/tenant-provisioning";
import {
  listTenantAdmins,
  listTenantAdminHistory,
  addTenantAdmin,
  replaceTenantAdmin,
  revokeTenantAdmin,
  createTenantAdminAttachment,
  listTenantAdminAttachments,
  createTenantAdminAttachmentSignedUrl,
  type TenantAdmin,
  type TenantAdminOperation,
  type AdminAttachment,
} from "../lib/tenant-admin-management";

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function MasterDashboard() {