/**
 * QuickBooks API Client
 *
 * Wraps the node-quickbooks library and handles API calls
 */

import QuickBooks from "node-quickbooks";
import { ToolResponse } from "../types/index.js";

const config = {
  clientId: process.env.QUICKBOOKS_CLIENT_ID || "",
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || "",
  environment: process.env.QUICKBOOKS_ENVIRONMENT || "sandbox",
};

/**
 * Create a QuickBooks instance with the provided credentials
 */
export function createQuickBooksInstance(
  accessToken: string,
  realmId: string,
  refreshToken?: string
): QuickBooks {
  return new QuickBooks(
    config.clientId,
    config.clientSecret,
    accessToken,
    false, // no token secret for OAuth 2.0
    realmId,
    config.environment === "sandbox",
    false, // debug
    null, // minor version
    "2.0", // oauth version
    refreshToken
  );
}

export function isAuthenticationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as Record<string, unknown>;
  if (err.statusCode === 401) return true;
  const fault = (err.fault ?? err.Fault) as Record<string, unknown> | undefined;
  if (typeof fault === "object" && fault !== null) {
    if (fault.type === "AUTHENTICATION") return true;
  }
  return false;
}

// Module-level flag: set when a QB API call fails with an auth error.
// The Express handler checks this to convert the HTTP response to 401.
let _authErrorOccurred = false;

export function getAuthErrorOccurred(): boolean { return _authErrorOccurred; }
export function resetAuthErrorFlag(): void { _authErrorOccurred = false; }

/**
 * Format an error into a readable string
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const qbError = error as Record<string, unknown>;
    const fault = (qbError.fault ?? qbError.Fault) as Record<string, unknown> | undefined;
    if (fault && typeof fault === "object") {
      const errors = (fault.error ?? fault.Error) as Record<string, unknown>[] | undefined;
      if (Array.isArray(errors) && errors.length > 0) {
        const first = errors[0];
        const msg = first.message ?? first.Message ?? "Unknown error";
        const detail = first.detail ?? first.Detail ?? "";
        return `${msg}: ${detail}`;
      }
    }
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Promisify a QuickBooks callback-based method
 */
function promisify<T>(
  qb: QuickBooks,
  method: string,
  ...args: unknown[]
): Promise<T> {
  return new Promise((resolve, reject) => {
    const callback = (err: unknown, result: T) => {
      if (err) {
        if (isAuthenticationError(err)) {
          _authErrorOccurred = true;
        }
        reject(err);
      } else {
        resolve(result);
      }
    };
    (qb as unknown as Record<string, (...args: unknown[]) => void>)[method](...args, callback);
  });
}

// ============================================================================
// Customer Operations
// ============================================================================

export async function createCustomer(
  qb: QuickBooks,
  customerData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "createCustomer", customerData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getCustomer(
  qb: QuickBooks,
  id: string
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "getCustomer", id);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function updateCustomer(
  qb: QuickBooks,
  customerData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "updateCustomer", customerData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function deleteCustomer(
  qb: QuickBooks,
  idOrEntity: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "deleteCustomer", idOrEntity);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function searchCustomers(
  qb: QuickBooks,
  criteria: unknown
): Promise<ToolResponse<unknown[]>> {
  try {
    const result = await promisify<{ QueryResponse?: { Customer?: unknown[]; totalCount?: number } }>(
      qb,
      "findCustomers",
      criteria
    );
    const customers = result?.QueryResponse?.Customer ?? result?.QueryResponse?.totalCount ?? [];
    return { result: Array.isArray(customers) ? customers : [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

// ============================================================================
// Invoice Operations
// ============================================================================

export async function createInvoice(
  qb: QuickBooks,
  invoiceData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "createInvoice", invoiceData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getInvoice(
  qb: QuickBooks,
  id: string
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "getInvoice", id);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function updateInvoice(
  qb: QuickBooks,
  invoiceData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "updateInvoice", invoiceData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function searchInvoices(
  qb: QuickBooks,
  criteria: unknown
): Promise<ToolResponse<unknown[]>> {
  try {
    const result = await promisify<{ QueryResponse?: { Invoice?: unknown[]; totalCount?: number } }>(
      qb,
      "findInvoices",
      criteria
    );
    const invoices = result?.QueryResponse?.Invoice ?? result?.QueryResponse?.totalCount ?? [];
    return { result: Array.isArray(invoices) ? invoices : [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

// ============================================================================
// Account Operations
// ============================================================================

export async function createAccount(
  qb: QuickBooks,
  accountData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "createAccount", accountData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getAccount(
  qb: QuickBooks,
  id: string
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "getAccount", id);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function updateAccount(
  qb: QuickBooks,
  accountData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "updateAccount", accountData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function searchAccounts(
  qb: QuickBooks,
  criteria: unknown
): Promise<ToolResponse<unknown[]>> {
  try {
    const result = await promisify<{ QueryResponse?: { Account?: unknown[]; totalCount?: number } }>(
      qb,
      "findAccounts",
      criteria
    );
    const accounts = result?.QueryResponse?.Account ?? result?.QueryResponse?.totalCount ?? [];
    return { result: Array.isArray(accounts) ? accounts : [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

// ============================================================================
// Item Operations
// ============================================================================

export async function createItem(
  qb: QuickBooks,
  itemData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "createItem", itemData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getItem(
  qb: QuickBooks,
  id: string
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "getItem", id);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function updateItem(
  qb: QuickBooks,
  itemData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "updateItem", itemData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function searchItems(
  qb: QuickBooks,
  criteria: unknown
): Promise<ToolResponse<unknown[]>> {
  try {
    const result = await promisify<{ QueryResponse?: { Item?: unknown[]; totalCount?: number } }>(
      qb,
      "findItems",
      criteria
    );
    const items = result?.QueryResponse?.Item ?? result?.QueryResponse?.totalCount ?? [];
    return { result: Array.isArray(items) ? items : [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

// ============================================================================
// Estimate Operations
// ============================================================================

export async function createEstimate(
  qb: QuickBooks,
  estimateData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "createEstimate", estimateData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getEstimate(
  qb: QuickBooks,
  id: string
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "getEstimate", id);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function updateEstimate(
  qb: QuickBooks,
  estimateData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "updateEstimate", estimateData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function deleteEstimate(
  qb: QuickBooks,
  idOrEntity: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "deleteEstimate", idOrEntity);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function searchEstimates(
  qb: QuickBooks,
  criteria: unknown
): Promise<ToolResponse<unknown[]>> {
  try {
    const result = await promisify<{ QueryResponse?: { Estimate?: unknown[]; totalCount?: number } }>(
      qb,
      "findEstimates",
      criteria
    );
    const estimates = result?.QueryResponse?.Estimate ?? result?.QueryResponse?.totalCount ?? [];
    return { result: Array.isArray(estimates) ? estimates : [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

// ============================================================================
// Bill Operations
// ============================================================================

export async function createBill(
  qb: QuickBooks,
  billData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "createBill", billData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getBill(
  qb: QuickBooks,
  id: string
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "getBill", id);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function updateBill(
  qb: QuickBooks,
  billData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "updateBill", billData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function deleteBill(
  qb: QuickBooks,
  idOrEntity: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "deleteBill", idOrEntity);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function searchBills(
  qb: QuickBooks,
  criteria: unknown
): Promise<ToolResponse<unknown[]>> {
  try {
    const result = await promisify<{ QueryResponse?: { Bill?: unknown[]; totalCount?: number } }>(
      qb,
      "findBills",
      criteria
    );
    const bills = result?.QueryResponse?.Bill ?? result?.QueryResponse?.totalCount ?? [];
    return { result: Array.isArray(bills) ? bills : [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

// ============================================================================
// Vendor Operations
// ============================================================================

export async function createVendor(
  qb: QuickBooks,
  vendorData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "createVendor", vendorData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getVendor(
  qb: QuickBooks,
  id: string
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "getVendor", id);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function updateVendor(
  qb: QuickBooks,
  vendorData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "updateVendor", vendorData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function deleteVendor(
  qb: QuickBooks,
  idOrEntity: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "deleteVendor", idOrEntity);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function searchVendors(
  qb: QuickBooks,
  criteria: unknown
): Promise<ToolResponse<unknown[]>> {
  try {
    const result = await promisify<{ QueryResponse?: { Vendor?: unknown[]; totalCount?: number } }>(
      qb,
      "findVendors",
      criteria
    );
    const vendors = result?.QueryResponse?.Vendor ?? result?.QueryResponse?.totalCount ?? [];
    return { result: Array.isArray(vendors) ? vendors : [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

// ============================================================================
// Employee Operations
// ============================================================================

export async function createEmployee(
  qb: QuickBooks,
  employeeData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "createEmployee", employeeData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getEmployee(
  qb: QuickBooks,
  id: string
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "getEmployee", id);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function updateEmployee(
  qb: QuickBooks,
  employeeData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "updateEmployee", employeeData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function searchEmployees(
  qb: QuickBooks,
  criteria: unknown
): Promise<ToolResponse<unknown[]>> {
  try {
    const result = await promisify<{ QueryResponse?: { Employee?: unknown[]; totalCount?: number } }>(
      qb,
      "findEmployees",
      criteria
    );
    const employees = result?.QueryResponse?.Employee ?? result?.QueryResponse?.totalCount ?? [];
    return { result: Array.isArray(employees) ? employees : [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

// ============================================================================
// Journal Entry Operations
// ============================================================================

export async function createJournalEntry(
  qb: QuickBooks,
  entryData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "createJournalEntry", entryData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getJournalEntry(
  qb: QuickBooks,
  id: string
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "getJournalEntry", id);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function updateJournalEntry(
  qb: QuickBooks,
  entryData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "updateJournalEntry", entryData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function deleteJournalEntry(
  qb: QuickBooks,
  idOrEntity: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "deleteJournalEntry", idOrEntity);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function searchJournalEntries(
  qb: QuickBooks,
  criteria: unknown
): Promise<ToolResponse<unknown[]>> {
  try {
    const result = await promisify<{ QueryResponse?: { JournalEntry?: unknown[]; totalCount?: number } }>(
      qb,
      "findJournalEntries",
      criteria
    );
    const entries = result?.QueryResponse?.JournalEntry ?? result?.QueryResponse?.totalCount ?? [];
    return { result: Array.isArray(entries) ? entries : [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

// ============================================================================
// Bill Payment Operations
// ============================================================================

export async function createBillPayment(
  qb: QuickBooks,
  paymentData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "createBillPayment", paymentData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getBillPayment(
  qb: QuickBooks,
  id: string
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "getBillPayment", id);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function updateBillPayment(
  qb: QuickBooks,
  paymentData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "updateBillPayment", paymentData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function deleteBillPayment(
  qb: QuickBooks,
  idOrEntity: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "deleteBillPayment", idOrEntity);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function searchBillPayments(
  qb: QuickBooks,
  criteria: unknown
): Promise<ToolResponse<unknown[]>> {
  try {
    const result = await promisify<{ QueryResponse?: { BillPayment?: unknown[]; totalCount?: number } }>(
      qb,
      "findBillPayments",
      criteria
    );
    const payments = result?.QueryResponse?.BillPayment ?? result?.QueryResponse?.totalCount ?? [];
    return { result: Array.isArray(payments) ? payments : [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

// ============================================================================
// Purchase Operations
// ============================================================================

export async function createPurchase(
  qb: QuickBooks,
  purchaseData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "createPurchase", purchaseData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function getPurchase(
  qb: QuickBooks,
  id: string
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "getPurchase", id);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function updatePurchase(
  qb: QuickBooks,
  purchaseData: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "updatePurchase", purchaseData);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function deletePurchase(
  qb: QuickBooks,
  idOrEntity: unknown
): Promise<ToolResponse<unknown>> {
  try {
    const result = await promisify<unknown>(qb, "deletePurchase", idOrEntity);
    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

export async function searchPurchases(
  qb: QuickBooks,
  criteria: unknown
): Promise<ToolResponse<unknown[]>> {
  try {
    const result = await promisify<{ QueryResponse?: { Purchase?: unknown[]; totalCount?: number } }>(
      qb,
      "findPurchases",
      criteria
    );
    const purchases = result?.QueryResponse?.Purchase ?? result?.QueryResponse?.totalCount ?? [];
    return { result: Array.isArray(purchases) ? purchases : [], isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
