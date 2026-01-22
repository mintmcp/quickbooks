/**
 * Zod schemas for QuickBooks MCP tools
 */

import { z } from "zod";

// ============================================================================
// Common Schemas
// ============================================================================

export const IdSchema = z.object({
  id: z.string().describe("The QuickBooks entity ID"),
}).strict();

export const SearchOperatorSchema = z.enum(["=", "<", ">", "<=", ">=", "LIKE", "IN"]);

export const FilterCriterionSchema = z.object({
  field: z.string().describe("Field name to filter on"),
  value: z.union([z.string(), z.number(), z.boolean()]).describe("Value to match"),
  operator: SearchOperatorSchema.optional().describe("Comparison operator (default: '=')"),
});

export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().describe("Maximum results to return (1-100)"),
  offset: z.number().int().min(0).optional().describe("Number of results to skip"),
  asc: z.string().optional().describe("Field to sort ascending"),
  desc: z.string().optional().describe("Field to sort descending"),
});

export const SearchOptionsSchema = PaginationSchema.extend({
  criteria: z.array(FilterCriterionSchema).optional().describe("Filter criteria"),
  fetchAll: z.boolean().optional().describe("Fetch all results (ignores limit)"),
  count: z.boolean().optional().describe("Return only count of results"),
});

// ============================================================================
// Customer Schemas
// ============================================================================

export const CustomerDataSchema = z.object({
  DisplayName: z.string().optional().describe("Display name for the customer"),
  GivenName: z.string().optional().describe("First name"),
  FamilyName: z.string().optional().describe("Last name"),
  CompanyName: z.string().optional().describe("Company name"),
  PrimaryEmailAddr: z.object({
    Address: z.string().email(),
  }).optional().describe("Primary email address"),
  PrimaryPhone: z.object({
    FreeFormNumber: z.string(),
  }).optional().describe("Primary phone number"),
  BillAddr: z.object({
    Line1: z.string().optional(),
    City: z.string().optional(),
    CountrySubDivisionCode: z.string().optional(),
    PostalCode: z.string().optional(),
    Country: z.string().optional(),
  }).optional().describe("Billing address"),
  Notes: z.string().optional().describe("Notes about the customer"),
}).passthrough(); // Allow additional QB fields

export const CreateCustomerSchema = z.object({
  customer: CustomerDataSchema.describe("Customer data to create"),
}).strict();

export const UpdateCustomerSchema = z.object({
  customer: CustomerDataSchema.extend({
    Id: z.string().describe("Customer ID to update"),
    SyncToken: z.string().describe("Sync token for optimistic locking"),
  }).describe("Customer data with Id and SyncToken"),
}).strict();

export const SearchCustomersSchema = SearchOptionsSchema;

// ============================================================================
// Invoice Schemas
// ============================================================================

export const InvoiceLineItemSchema = z.object({
  DetailType: z.string().default("SalesItemLineDetail"),
  Amount: z.number().describe("Line total amount"),
  SalesItemLineDetail: z.object({
    ItemRef: z.object({
      value: z.string().describe("Item ID"),
      name: z.string().optional(),
    }),
    Qty: z.number().optional().describe("Quantity"),
    UnitPrice: z.number().optional().describe("Unit price"),
  }).optional(),
  Description: z.string().optional(),
}).passthrough();

export const InvoiceDataSchema = z.object({
  CustomerRef: z.object({
    value: z.string().describe("Customer ID"),
    name: z.string().optional(),
  }).describe("Reference to the customer"),
  Line: z.array(InvoiceLineItemSchema).describe("Invoice line items"),
  DueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
  TxnDate: z.string().optional().describe("Transaction date (YYYY-MM-DD)"),
  DocNumber: z.string().optional().describe("Invoice number"),
  PrivateNote: z.string().optional().describe("Private note"),
  CustomerMemo: z.object({
    value: z.string(),
  }).optional().describe("Customer memo"),
}).passthrough();

export const CreateInvoiceSchema = z.object({
  invoice: InvoiceDataSchema.describe("Invoice data to create"),
}).strict();

export const UpdateInvoiceSchema = z.object({
  invoice: InvoiceDataSchema.extend({
    Id: z.string().describe("Invoice ID to update"),
    SyncToken: z.string().describe("Sync token for optimistic locking"),
  }).describe("Invoice data with Id and SyncToken"),
}).strict();

export const SearchInvoicesSchema = SearchOptionsSchema;

// ============================================================================
// Account Schemas
// ============================================================================

export const AccountTypeSchema = z.enum([
  "Bank", "Other Current Asset", "Fixed Asset", "Other Asset",
  "Accounts Receivable", "Equity", "Expense", "Other Expense",
  "Cost of Goods Sold", "Accounts Payable", "Credit Card",
  "Long Term Liability", "Other Current Liability", "Income", "Other Income",
]);

export const AccountDataSchema = z.object({
  Name: z.string().describe("Account name"),
  AccountType: AccountTypeSchema.describe("Type of account"),
  AccountSubType: z.string().optional().describe("Account subtype"),
  Description: z.string().optional().describe("Account description"),
  AcctNum: z.string().optional().describe("Account number"),
}).passthrough();

export const CreateAccountSchema = z.object({
  account: AccountDataSchema.describe("Account data to create"),
}).strict();

export const UpdateAccountSchema = z.object({
  account: AccountDataSchema.extend({
    Id: z.string().describe("Account ID to update"),
    SyncToken: z.string().describe("Sync token for optimistic locking"),
  }).describe("Account data with Id and SyncToken"),
}).strict();

export const SearchAccountsSchema = SearchOptionsSchema;

// ============================================================================
// Item Schemas
// ============================================================================

export const ItemTypeSchema = z.enum(["Inventory", "Service", "NonInventory"]);

export const ItemDataSchema = z.object({
  Name: z.string().describe("Item name"),
  Type: ItemTypeSchema.optional().describe("Item type"),
  Description: z.string().optional().describe("Item description"),
  UnitPrice: z.number().optional().describe("Unit price"),
  PurchaseCost: z.number().optional().describe("Purchase cost"),
  IncomeAccountRef: z.object({
    value: z.string(),
    name: z.string().optional(),
  }).optional().describe("Income account reference"),
  ExpenseAccountRef: z.object({
    value: z.string(),
    name: z.string().optional(),
  }).optional().describe("Expense account reference"),
  AssetAccountRef: z.object({
    value: z.string(),
    name: z.string().optional(),
  }).optional().describe("Asset account reference (for inventory items)"),
  QtyOnHand: z.number().optional().describe("Quantity on hand"),
  InvStartDate: z.string().optional().describe("Inventory start date"),
}).passthrough();

export const CreateItemSchema = z.object({
  item: ItemDataSchema.describe("Item data to create"),
}).strict();

export const UpdateItemSchema = z.object({
  item: ItemDataSchema.extend({
    Id: z.string().describe("Item ID to update"),
    SyncToken: z.string().describe("Sync token for optimistic locking"),
  }).describe("Item data with Id and SyncToken"),
}).strict();

export const SearchItemsSchema = SearchOptionsSchema;

// ============================================================================
// Estimate Schemas
// ============================================================================

export const EstimateDataSchema = z.object({
  CustomerRef: z.object({
    value: z.string().describe("Customer ID"),
    name: z.string().optional(),
  }).describe("Reference to the customer"),
  Line: z.array(InvoiceLineItemSchema).describe("Estimate line items"),
  TxnDate: z.string().optional().describe("Transaction date"),
  ExpirationDate: z.string().optional().describe("Expiration date"),
  DocNumber: z.string().optional().describe("Estimate number"),
  PrivateNote: z.string().optional().describe("Private note"),
  CustomerMemo: z.object({
    value: z.string(),
  }).optional().describe("Customer memo"),
}).passthrough();

export const CreateEstimateSchema = z.object({
  estimate: EstimateDataSchema.describe("Estimate data to create"),
}).strict();

export const UpdateEstimateSchema = z.object({
  estimate: EstimateDataSchema.extend({
    Id: z.string().describe("Estimate ID to update"),
    SyncToken: z.string().describe("Sync token for optimistic locking"),
  }).describe("Estimate data with Id and SyncToken"),
}).strict();

export const SearchEstimatesSchema = SearchOptionsSchema;

// ============================================================================
// Bill Schemas
// ============================================================================

export const BillLineItemSchema = z.object({
  DetailType: z.string().default("AccountBasedExpenseLineDetail"),
  Amount: z.number().describe("Line amount"),
  AccountBasedExpenseLineDetail: z.object({
    AccountRef: z.object({
      value: z.string(),
      name: z.string().optional(),
    }),
  }).optional(),
  Description: z.string().optional(),
}).passthrough();

export const BillDataSchema = z.object({
  VendorRef: z.object({
    value: z.string().describe("Vendor ID"),
    name: z.string().optional(),
  }).describe("Reference to the vendor"),
  Line: z.array(BillLineItemSchema).describe("Bill line items"),
  TxnDate: z.string().optional().describe("Transaction date"),
  DueDate: z.string().optional().describe("Due date"),
  DocNumber: z.string().optional().describe("Bill number"),
  PrivateNote: z.string().optional().describe("Private note"),
}).passthrough();

export const CreateBillSchema = z.object({
  bill: BillDataSchema.describe("Bill data to create"),
}).strict();

export const UpdateBillSchema = z.object({
  bill: BillDataSchema.extend({
    Id: z.string().describe("Bill ID to update"),
    SyncToken: z.string().describe("Sync token for optimistic locking"),
  }).describe("Bill data with Id and SyncToken"),
}).strict();

export const SearchBillsSchema = SearchOptionsSchema;

// ============================================================================
// Vendor Schemas
// ============================================================================

export const VendorDataSchema = z.object({
  DisplayName: z.string().optional().describe("Display name for the vendor"),
  GivenName: z.string().optional().describe("First name"),
  FamilyName: z.string().optional().describe("Last name"),
  CompanyName: z.string().optional().describe("Company name"),
  PrimaryEmailAddr: z.object({
    Address: z.string().email(),
  }).optional().describe("Primary email address"),
  PrimaryPhone: z.object({
    FreeFormNumber: z.string(),
  }).optional().describe("Primary phone number"),
  BillAddr: z.object({
    Line1: z.string().optional(),
    City: z.string().optional(),
    CountrySubDivisionCode: z.string().optional(),
    PostalCode: z.string().optional(),
    Country: z.string().optional(),
  }).optional().describe("Billing address"),
}).passthrough();

export const CreateVendorSchema = z.object({
  vendor: VendorDataSchema.describe("Vendor data to create"),
}).strict();

export const UpdateVendorSchema = z.object({
  vendor: VendorDataSchema.extend({
    Id: z.string().describe("Vendor ID to update"),
    SyncToken: z.string().describe("Sync token for optimistic locking"),
  }).describe("Vendor data with Id and SyncToken"),
}).strict();

export const SearchVendorsSchema = SearchOptionsSchema;

// ============================================================================
// Employee Schemas
// ============================================================================

export const EmployeeDataSchema = z.object({
  DisplayName: z.string().optional().describe("Display name for the employee"),
  GivenName: z.string().optional().describe("First name"),
  FamilyName: z.string().optional().describe("Last name"),
  PrimaryEmailAddr: z.object({
    Address: z.string().email(),
  }).optional().describe("Primary email address"),
  PrimaryPhone: z.object({
    FreeFormNumber: z.string(),
  }).optional().describe("Primary phone number"),
  SSN: z.string().optional().describe("Social Security Number"),
  PrimaryAddr: z.object({
    Line1: z.string().optional(),
    City: z.string().optional(),
    CountrySubDivisionCode: z.string().optional(),
    PostalCode: z.string().optional(),
  }).optional().describe("Primary address"),
}).passthrough();

export const CreateEmployeeSchema = z.object({
  employee: EmployeeDataSchema.describe("Employee data to create"),
}).strict();

export const UpdateEmployeeSchema = z.object({
  employee: EmployeeDataSchema.extend({
    Id: z.string().describe("Employee ID to update"),
    SyncToken: z.string().describe("Sync token for optimistic locking"),
  }).describe("Employee data with Id and SyncToken"),
}).strict();

export const SearchEmployeesSchema = SearchOptionsSchema;

// ============================================================================
// Journal Entry Schemas
// ============================================================================

export const JournalEntryLineSchema = z.object({
  DetailType: z.string().default("JournalEntryLineDetail"),
  Amount: z.number().describe("Line amount"),
  JournalEntryLineDetail: z.object({
    PostingType: z.enum(["Debit", "Credit"]).describe("Debit or Credit"),
    AccountRef: z.object({
      value: z.string(),
      name: z.string().optional(),
    }).describe("Account reference"),
  }),
  Description: z.string().optional(),
}).passthrough();

export const JournalEntryDataSchema = z.object({
  Line: z.array(JournalEntryLineSchema).describe("Journal entry lines (must balance)"),
  TxnDate: z.string().optional().describe("Transaction date"),
  DocNumber: z.string().optional().describe("Document number"),
  PrivateNote: z.string().optional().describe("Private note"),
}).passthrough();

export const CreateJournalEntrySchema = z.object({
  entry: JournalEntryDataSchema.describe("Journal entry data to create"),
}).strict();

export const UpdateJournalEntrySchema = z.object({
  entry: JournalEntryDataSchema.extend({
    Id: z.string().describe("Journal Entry ID to update"),
    SyncToken: z.string().describe("Sync token for optimistic locking"),
  }).describe("Journal entry data with Id and SyncToken"),
}).strict();

export const SearchJournalEntriesSchema = SearchOptionsSchema;

// ============================================================================
// Bill Payment Schemas
// ============================================================================

export const BillPaymentLineSchema = z.object({
  Amount: z.number().describe("Payment amount for this line"),
  LinkedTxn: z.array(z.object({
    TxnId: z.string().describe("Bill transaction ID"),
    TxnType: z.string().default("Bill"),
  })).describe("Linked transactions (bills being paid)"),
}).passthrough();

export const BillPaymentDataSchema = z.object({
  VendorRef: z.object({
    value: z.string().describe("Vendor ID"),
    name: z.string().optional(),
  }).describe("Reference to the vendor"),
  PayType: z.enum(["Check", "CreditCard"]).describe("Payment type"),
  TotalAmt: z.number().describe("Total payment amount"),
  Line: z.array(BillPaymentLineSchema).describe("Payment line items"),
  CheckPayment: z.object({
    BankAccountRef: z.object({
      value: z.string(),
      name: z.string().optional(),
    }),
  }).optional().describe("Check payment details"),
  CreditCardPayment: z.object({
    CCAccountRef: z.object({
      value: z.string(),
      name: z.string().optional(),
    }),
  }).optional().describe("Credit card payment details"),
  TxnDate: z.string().optional().describe("Transaction date"),
}).passthrough();

export const CreateBillPaymentSchema = z.object({
  payment: BillPaymentDataSchema.describe("Bill payment data to create"),
}).strict();

export const UpdateBillPaymentSchema = z.object({
  payment: BillPaymentDataSchema.extend({
    Id: z.string().describe("Bill Payment ID to update"),
    SyncToken: z.string().describe("Sync token for optimistic locking"),
  }).describe("Bill payment data with Id and SyncToken"),
}).strict();

export const SearchBillPaymentsSchema = SearchOptionsSchema;

// ============================================================================
// Purchase Schemas
// ============================================================================

export const PurchaseLineSchema = z.object({
  DetailType: z.string().default("AccountBasedExpenseLineDetail"),
  Amount: z.number().describe("Line amount"),
  AccountBasedExpenseLineDetail: z.object({
    AccountRef: z.object({
      value: z.string(),
      name: z.string().optional(),
    }),
  }).optional(),
  Description: z.string().optional(),
}).passthrough();

export const PurchaseDataSchema = z.object({
  PaymentType: z.enum(["Cash", "Check", "CreditCard"]).describe("Payment type"),
  AccountRef: z.object({
    value: z.string().describe("Payment account ID"),
    name: z.string().optional(),
  }).describe("Reference to payment account"),
  Line: z.array(PurchaseLineSchema).describe("Purchase line items"),
  EntityRef: z.object({
    value: z.string(),
    name: z.string().optional(),
    type: z.string().optional(),
  }).optional().describe("Reference to vendor/customer"),
  TxnDate: z.string().optional().describe("Transaction date"),
  DocNumber: z.string().optional().describe("Document number"),
  PrivateNote: z.string().optional().describe("Private note"),
}).passthrough();

export const CreatePurchaseSchema = z.object({
  purchase: PurchaseDataSchema.describe("Purchase data to create"),
}).strict();

export const UpdatePurchaseSchema = z.object({
  purchase: PurchaseDataSchema.extend({
    Id: z.string().describe("Purchase ID to update"),
    SyncToken: z.string().describe("Sync token for optimistic locking"),
  }).describe("Purchase data with Id and SyncToken"),
}).strict();

export const SearchPurchasesSchema = SearchOptionsSchema;
