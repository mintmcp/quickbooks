/**
 * Register all QuickBooks MCP tools
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import QuickBooks from "node-quickbooks";
import * as schemas from "./schemas.js";
import * as qbClient from "../services/quickbooks-client.js";

type GetQBInstance = () => QuickBooks | null;

/**
 * Build search criteria from tool input
 */
function buildSearchCriteria(input: z.infer<typeof schemas.SearchOptionsSchema>): unknown {
  const { criteria = [], limit, offset, asc, desc, fetchAll, count } = input;

  if (criteria.length === 0 && !limit && !offset && !asc && !desc && !fetchAll && !count) {
    return {};
  }

  const result: Array<Record<string, unknown>> = [];

  for (const c of criteria) {
    result.push({
      field: c.field,
      value: c.value,
      operator: c.operator,
    });
  }

  if (limit !== undefined) result.push({ field: "limit", value: limit });
  if (offset !== undefined) result.push({ field: "offset", value: offset });
  if (asc) result.push({ field: "asc", value: asc });
  if (desc) result.push({ field: "desc", value: desc });
  if (fetchAll) result.push({ field: "fetchAll", value: true });
  if (count) result.push({ field: "count", value: true });

  return result.length > 0 ? result : {};
}

/**
 * Register all QuickBooks tools on the MCP server
 */
export function registerAllTools(server: McpServer, getQB: GetQBInstance): void {

  // Helper to ensure QB instance exists
  const requireQB = (): QuickBooks => {
    const qb = getQB();
    if (!qb) {
      throw new Error("Not authenticated. Please authenticate with QuickBooks first.");
    }
    return qb;
  };

  // ============================================================================
  // Customer Tools
  // ============================================================================

  server.registerTool(
    "create_customer",
    {
      title: "Create Customer",
      description: `Create a new customer in QuickBooks Online.

Args:
  - customer: Customer data object with fields like DisplayName, GivenName, FamilyName, CompanyName, PrimaryEmailAddr, PrimaryPhone, BillAddr

Returns:
  The created customer object with Id and SyncToken`,
      inputSchema: schemas.CreateCustomerSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.CreateCustomerSchema>) => {
      const qb = requireQB();
      const response = await qbClient.createCustomer(qb, params.customer);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_customer",
    {
      title: "Get Customer",
      description: `Retrieve a customer by ID from QuickBooks Online.

Args:
  - id: The QuickBooks customer ID

Returns:
  The customer object`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.getCustomer(qb, params.id);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_customer",
    {
      title: "Update Customer",
      description: `Update an existing customer in QuickBooks Online.

Args:
  - customer: Customer data with Id and SyncToken (required for optimistic locking)

Returns:
  The updated customer object`,
      inputSchema: schemas.UpdateCustomerSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.UpdateCustomerSchema>) => {
      const qb = requireQB();
      const response = await qbClient.updateCustomer(qb, params.customer);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_customer",
    {
      title: "Delete Customer",
      description: `Delete (deactivate) a customer in QuickBooks Online.

Args:
  - id: The QuickBooks customer ID

Returns:
  Confirmation of deletion`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.deleteCustomer(qb, { Id: params.id });
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: "Customer deleted successfully" }] };
    }
  );

  server.registerTool(
    "search_customers",
    {
      title: "Search Customers",
      description: `Search for customers in QuickBooks Online.

Args:
  - criteria: Array of filter objects with field, value, and optional operator (=, <, >, <=, >=, LIKE, IN)
  - limit: Maximum results (1-100)
  - offset: Skip N results
  - asc/desc: Sort field

Returns:
  Array of matching customers`,
      inputSchema: schemas.SearchCustomersSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SearchCustomersSchema>) => {
      const qb = requireQB();
      const criteria = buildSearchCriteria(params);
      const response = await qbClient.searchCustomers(qb, criteria);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      const results = response.result || [];
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} customers:\n${JSON.stringify(results, null, 2)}`
        }]
      };
    }
  );

  // ============================================================================
  // Invoice Tools
  // ============================================================================

  server.registerTool(
    "create_invoice",
    {
      title: "Create Invoice",
      description: `Create a new invoice in QuickBooks Online.

Args:
  - invoice: Invoice data with CustomerRef, Line items (with ItemRef, Qty, UnitPrice), DueDate, etc.

Returns:
  The created invoice object`,
      inputSchema: schemas.CreateInvoiceSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.CreateInvoiceSchema>) => {
      const qb = requireQB();
      const response = await qbClient.createInvoice(qb, params.invoice);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "read_invoice",
    {
      title: "Read Invoice",
      description: `Retrieve an invoice by ID from QuickBooks Online.

Args:
  - id: The QuickBooks invoice ID

Returns:
  The invoice object`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.getInvoice(qb, params.id);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_invoice",
    {
      title: "Update Invoice",
      description: `Update an existing invoice in QuickBooks Online.

Args:
  - invoice: Invoice data with Id and SyncToken

Returns:
  The updated invoice object`,
      inputSchema: schemas.UpdateInvoiceSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.UpdateInvoiceSchema>) => {
      const qb = requireQB();
      const response = await qbClient.updateInvoice(qb, params.invoice);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "search_invoices",
    {
      title: "Search Invoices",
      description: `Search for invoices in QuickBooks Online.

Args:
  - criteria: Filter criteria
  - limit, offset, asc, desc: Pagination and sorting

Returns:
  Array of matching invoices`,
      inputSchema: schemas.SearchInvoicesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SearchInvoicesSchema>) => {
      const qb = requireQB();
      const criteria = buildSearchCriteria(params);
      const response = await qbClient.searchInvoices(qb, criteria);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      const results = response.result || [];
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} invoices:\n${JSON.stringify(results, null, 2)}`
        }]
      };
    }
  );

  // ============================================================================
  // Account Tools
  // ============================================================================

  server.registerTool(
    "create_account",
    {
      title: "Create Account",
      description: `Create a new account in QuickBooks Online Chart of Accounts.

Args:
  - account: Account data with Name, AccountType (Bank, Expense, Income, etc.), AccountSubType, etc.

Returns:
  The created account object`,
      inputSchema: schemas.CreateAccountSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.CreateAccountSchema>) => {
      const qb = requireQB();
      const response = await qbClient.createAccount(qb, params.account);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_account",
    {
      title: "Get Account",
      description: `Retrieve an account by ID from QuickBooks Online.

Args:
  - id: The QuickBooks account ID

Returns:
  The account object`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.getAccount(qb, params.id);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_account",
    {
      title: "Update Account",
      description: `Update an existing account in QuickBooks Online.

Args:
  - account: Account data with Id and SyncToken

Returns:
  The updated account object`,
      inputSchema: schemas.UpdateAccountSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.UpdateAccountSchema>) => {
      const qb = requireQB();
      const response = await qbClient.updateAccount(qb, params.account);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "search_accounts",
    {
      title: "Search Accounts",
      description: `Search for accounts in QuickBooks Online Chart of Accounts.

Args:
  - criteria: Filter criteria
  - limit, offset, asc, desc: Pagination and sorting

Returns:
  Array of matching accounts`,
      inputSchema: schemas.SearchAccountsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SearchAccountsSchema>) => {
      const qb = requireQB();
      const criteria = buildSearchCriteria(params);
      const response = await qbClient.searchAccounts(qb, criteria);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      const results = response.result || [];
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} accounts:\n${JSON.stringify(results, null, 2)}`
        }]
      };
    }
  );

  // ============================================================================
  // Item Tools
  // ============================================================================

  server.registerTool(
    "create_item",
    {
      title: "Create Item",
      description: `Create a new item (product/service) in QuickBooks Online.

Args:
  - item: Item data with Name, Type (Inventory, Service, NonInventory), UnitPrice, etc.

Returns:
  The created item object`,
      inputSchema: schemas.CreateItemSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.CreateItemSchema>) => {
      const qb = requireQB();
      const response = await qbClient.createItem(qb, params.item);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "read_item",
    {
      title: "Read Item",
      description: `Retrieve an item by ID from QuickBooks Online.

Args:
  - id: The QuickBooks item ID

Returns:
  The item object`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.getItem(qb, params.id);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_item",
    {
      title: "Update Item",
      description: `Update an existing item in QuickBooks Online.

Args:
  - item: Item data with Id and SyncToken

Returns:
  The updated item object`,
      inputSchema: schemas.UpdateItemSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.UpdateItemSchema>) => {
      const qb = requireQB();
      const response = await qbClient.updateItem(qb, params.item);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "search_items",
    {
      title: "Search Items",
      description: `Search for items in QuickBooks Online.

Args:
  - criteria: Filter criteria
  - limit, offset, asc, desc: Pagination and sorting

Returns:
  Array of matching items`,
      inputSchema: schemas.SearchItemsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SearchItemsSchema>) => {
      const qb = requireQB();
      const criteria = buildSearchCriteria(params);
      const response = await qbClient.searchItems(qb, criteria);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      const results = response.result || [];
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} items:\n${JSON.stringify(results, null, 2)}`
        }]
      };
    }
  );

  // ============================================================================
  // Estimate Tools
  // ============================================================================

  server.registerTool(
    "create_estimate",
    {
      title: "Create Estimate",
      description: `Create a new estimate in QuickBooks Online.

Args:
  - estimate: Estimate data with CustomerRef, Line items, ExpirationDate, etc.

Returns:
  The created estimate object`,
      inputSchema: schemas.CreateEstimateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.CreateEstimateSchema>) => {
      const qb = requireQB();
      const response = await qbClient.createEstimate(qb, params.estimate);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_estimate",
    {
      title: "Get Estimate",
      description: `Retrieve an estimate by ID from QuickBooks Online.

Args:
  - id: The QuickBooks estimate ID

Returns:
  The estimate object`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.getEstimate(qb, params.id);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_estimate",
    {
      title: "Update Estimate",
      description: `Update an existing estimate in QuickBooks Online.

Args:
  - estimate: Estimate data with Id and SyncToken

Returns:
  The updated estimate object`,
      inputSchema: schemas.UpdateEstimateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.UpdateEstimateSchema>) => {
      const qb = requireQB();
      const response = await qbClient.updateEstimate(qb, params.estimate);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_estimate",
    {
      title: "Delete Estimate",
      description: `Delete an estimate in QuickBooks Online.

Args:
  - id: The QuickBooks estimate ID

Returns:
  Confirmation of deletion`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.deleteEstimate(qb, { Id: params.id });
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: "Estimate deleted successfully" }] };
    }
  );

  server.registerTool(
    "search_estimates",
    {
      title: "Search Estimates",
      description: `Search for estimates in QuickBooks Online.

Args:
  - criteria: Filter criteria
  - limit, offset, asc, desc: Pagination and sorting

Returns:
  Array of matching estimates`,
      inputSchema: schemas.SearchEstimatesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SearchEstimatesSchema>) => {
      const qb = requireQB();
      const criteria = buildSearchCriteria(params);
      const response = await qbClient.searchEstimates(qb, criteria);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      const results = response.result || [];
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} estimates:\n${JSON.stringify(results, null, 2)}`
        }]
      };
    }
  );

  // ============================================================================
  // Bill Tools
  // ============================================================================

  server.registerTool(
    "create_bill",
    {
      title: "Create Bill",
      description: `Create a new bill in QuickBooks Online.

Args:
  - bill: Bill data with VendorRef, Line items, DueDate, etc.

Returns:
  The created bill object`,
      inputSchema: schemas.CreateBillSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.CreateBillSchema>) => {
      const qb = requireQB();
      const response = await qbClient.createBill(qb, params.bill);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_bill",
    {
      title: "Get Bill",
      description: `Retrieve a bill by ID from QuickBooks Online.

Args:
  - id: The QuickBooks bill ID

Returns:
  The bill object`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.getBill(qb, params.id);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_bill",
    {
      title: "Update Bill",
      description: `Update an existing bill in QuickBooks Online.

Args:
  - bill: Bill data with Id and SyncToken

Returns:
  The updated bill object`,
      inputSchema: schemas.UpdateBillSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.UpdateBillSchema>) => {
      const qb = requireQB();
      const response = await qbClient.updateBill(qb, params.bill);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_bill",
    {
      title: "Delete Bill",
      description: `Delete a bill in QuickBooks Online.

Args:
  - id: The QuickBooks bill ID

Returns:
  Confirmation of deletion`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.deleteBill(qb, { Id: params.id });
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: "Bill deleted successfully" }] };
    }
  );

  server.registerTool(
    "search_bills",
    {
      title: "Search Bills",
      description: `Search for bills in QuickBooks Online.

Args:
  - criteria: Filter criteria
  - limit, offset, asc, desc: Pagination and sorting

Returns:
  Array of matching bills`,
      inputSchema: schemas.SearchBillsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SearchBillsSchema>) => {
      const qb = requireQB();
      const criteria = buildSearchCriteria(params);
      const response = await qbClient.searchBills(qb, criteria);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      const results = response.result || [];
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} bills:\n${JSON.stringify(results, null, 2)}`
        }]
      };
    }
  );

  // ============================================================================
  // Vendor Tools
  // ============================================================================

  server.registerTool(
    "create_vendor",
    {
      title: "Create Vendor",
      description: `Create a new vendor in QuickBooks Online.

Args:
  - vendor: Vendor data with DisplayName, CompanyName, PrimaryEmailAddr, etc.

Returns:
  The created vendor object`,
      inputSchema: schemas.CreateVendorSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.CreateVendorSchema>) => {
      const qb = requireQB();
      const response = await qbClient.createVendor(qb, params.vendor);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_vendor",
    {
      title: "Get Vendor",
      description: `Retrieve a vendor by ID from QuickBooks Online.

Args:
  - id: The QuickBooks vendor ID

Returns:
  The vendor object`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.getVendor(qb, params.id);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_vendor",
    {
      title: "Update Vendor",
      description: `Update an existing vendor in QuickBooks Online.

Args:
  - vendor: Vendor data with Id and SyncToken

Returns:
  The updated vendor object`,
      inputSchema: schemas.UpdateVendorSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.UpdateVendorSchema>) => {
      const qb = requireQB();
      const response = await qbClient.updateVendor(qb, params.vendor);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_vendor",
    {
      title: "Delete Vendor",
      description: `Delete (deactivate) a vendor in QuickBooks Online.

Args:
  - id: The QuickBooks vendor ID

Returns:
  Confirmation of deletion`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.deleteVendor(qb, { Id: params.id });
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: "Vendor deleted successfully" }] };
    }
  );

  server.registerTool(
    "search_vendors",
    {
      title: "Search Vendors",
      description: `Search for vendors in QuickBooks Online.

Args:
  - criteria: Filter criteria
  - limit, offset, asc, desc: Pagination and sorting

Returns:
  Array of matching vendors`,
      inputSchema: schemas.SearchVendorsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SearchVendorsSchema>) => {
      const qb = requireQB();
      const criteria = buildSearchCriteria(params);
      const response = await qbClient.searchVendors(qb, criteria);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      const results = response.result || [];
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} vendors:\n${JSON.stringify(results, null, 2)}`
        }]
      };
    }
  );

  // ============================================================================
  // Employee Tools
  // ============================================================================

  server.registerTool(
    "create_employee",
    {
      title: "Create Employee",
      description: `Create a new employee in QuickBooks Online.

Args:
  - employee: Employee data with GivenName, FamilyName, etc.

Returns:
  The created employee object`,
      inputSchema: schemas.CreateEmployeeSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.CreateEmployeeSchema>) => {
      const qb = requireQB();
      const response = await qbClient.createEmployee(qb, params.employee);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_employee",
    {
      title: "Get Employee",
      description: `Retrieve an employee by ID from QuickBooks Online.

Args:
  - id: The QuickBooks employee ID

Returns:
  The employee object`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.getEmployee(qb, params.id);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_employee",
    {
      title: "Update Employee",
      description: `Update an existing employee in QuickBooks Online.

Args:
  - employee: Employee data with Id and SyncToken

Returns:
  The updated employee object`,
      inputSchema: schemas.UpdateEmployeeSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.UpdateEmployeeSchema>) => {
      const qb = requireQB();
      const response = await qbClient.updateEmployee(qb, params.employee);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "search_employees",
    {
      title: "Search Employees",
      description: `Search for employees in QuickBooks Online.

Args:
  - criteria: Filter criteria
  - limit, offset, asc, desc: Pagination and sorting

Returns:
  Array of matching employees`,
      inputSchema: schemas.SearchEmployeesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SearchEmployeesSchema>) => {
      const qb = requireQB();
      const criteria = buildSearchCriteria(params);
      const response = await qbClient.searchEmployees(qb, criteria);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      const results = response.result || [];
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} employees:\n${JSON.stringify(results, null, 2)}`
        }]
      };
    }
  );

  // ============================================================================
  // Journal Entry Tools
  // ============================================================================

  server.registerTool(
    "create_journal_entry",
    {
      title: "Create Journal Entry",
      description: `Create a new journal entry in QuickBooks Online.

Args:
  - entry: Journal entry data with Line items (Debit/Credit entries that must balance)

Returns:
  The created journal entry object`,
      inputSchema: schemas.CreateJournalEntrySchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.CreateJournalEntrySchema>) => {
      const qb = requireQB();
      const response = await qbClient.createJournalEntry(qb, params.entry);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_journal_entry",
    {
      title: "Get Journal Entry",
      description: `Retrieve a journal entry by ID from QuickBooks Online.

Args:
  - id: The QuickBooks journal entry ID

Returns:
  The journal entry object`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.getJournalEntry(qb, params.id);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_journal_entry",
    {
      title: "Update Journal Entry",
      description: `Update an existing journal entry in QuickBooks Online.

Args:
  - entry: Journal entry data with Id and SyncToken

Returns:
  The updated journal entry object`,
      inputSchema: schemas.UpdateJournalEntrySchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.UpdateJournalEntrySchema>) => {
      const qb = requireQB();
      const response = await qbClient.updateJournalEntry(qb, params.entry);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_journal_entry",
    {
      title: "Delete Journal Entry",
      description: `Delete a journal entry in QuickBooks Online.

Args:
  - id: The QuickBooks journal entry ID

Returns:
  Confirmation of deletion`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.deleteJournalEntry(qb, { Id: params.id });
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: "Journal entry deleted successfully" }] };
    }
  );

  server.registerTool(
    "search_journal_entries",
    {
      title: "Search Journal Entries",
      description: `Search for journal entries in QuickBooks Online.

Args:
  - criteria: Filter criteria
  - limit, offset, asc, desc: Pagination and sorting

Returns:
  Array of matching journal entries`,
      inputSchema: schemas.SearchJournalEntriesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SearchJournalEntriesSchema>) => {
      const qb = requireQB();
      const criteria = buildSearchCriteria(params);
      const response = await qbClient.searchJournalEntries(qb, criteria);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      const results = response.result || [];
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} journal entries:\n${JSON.stringify(results, null, 2)}`
        }]
      };
    }
  );

  // ============================================================================
  // Bill Payment Tools
  // ============================================================================

  server.registerTool(
    "create_bill_payment",
    {
      title: "Create Bill Payment",
      description: `Create a new bill payment in QuickBooks Online.

Args:
  - payment: Bill payment data with VendorRef, PayType, TotalAmt, Line items

Returns:
  The created bill payment object`,
      inputSchema: schemas.CreateBillPaymentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.CreateBillPaymentSchema>) => {
      const qb = requireQB();
      const response = await qbClient.createBillPayment(qb, params.payment);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_bill_payment",
    {
      title: "Get Bill Payment",
      description: `Retrieve a bill payment by ID from QuickBooks Online.

Args:
  - id: The QuickBooks bill payment ID

Returns:
  The bill payment object`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.getBillPayment(qb, params.id);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_bill_payment",
    {
      title: "Update Bill Payment",
      description: `Update an existing bill payment in QuickBooks Online.

Args:
  - payment: Bill payment data with Id and SyncToken

Returns:
  The updated bill payment object`,
      inputSchema: schemas.UpdateBillPaymentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.UpdateBillPaymentSchema>) => {
      const qb = requireQB();
      const response = await qbClient.updateBillPayment(qb, params.payment);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_bill_payment",
    {
      title: "Delete Bill Payment",
      description: `Delete a bill payment in QuickBooks Online.

Args:
  - id: The QuickBooks bill payment ID

Returns:
  Confirmation of deletion`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.deleteBillPayment(qb, { Id: params.id });
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: "Bill payment deleted successfully" }] };
    }
  );

  server.registerTool(
    "search_bill_payments",
    {
      title: "Search Bill Payments",
      description: `Search for bill payments in QuickBooks Online.

Args:
  - criteria: Filter criteria
  - limit, offset, asc, desc: Pagination and sorting

Returns:
  Array of matching bill payments`,
      inputSchema: schemas.SearchBillPaymentsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SearchBillPaymentsSchema>) => {
      const qb = requireQB();
      const criteria = buildSearchCriteria(params);
      const response = await qbClient.searchBillPayments(qb, criteria);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      const results = response.result || [];
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} bill payments:\n${JSON.stringify(results, null, 2)}`
        }]
      };
    }
  );

  // ============================================================================
  // Purchase Tools
  // ============================================================================

  server.registerTool(
    "create_purchase",
    {
      title: "Create Purchase",
      description: `Create a new purchase in QuickBooks Online.

Args:
  - purchase: Purchase data with PaymentType, AccountRef, Line items

Returns:
  The created purchase object`,
      inputSchema: schemas.CreatePurchaseSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.CreatePurchaseSchema>) => {
      const qb = requireQB();
      const response = await qbClient.createPurchase(qb, params.purchase);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_purchase",
    {
      title: "Get Purchase",
      description: `Retrieve a purchase by ID from QuickBooks Online.

Args:
  - id: The QuickBooks purchase ID

Returns:
  The purchase object`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.getPurchase(qb, params.id);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_purchase",
    {
      title: "Update Purchase",
      description: `Update an existing purchase in QuickBooks Online.

Args:
  - purchase: Purchase data with Id and SyncToken

Returns:
  The updated purchase object`,
      inputSchema: schemas.UpdatePurchaseSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.UpdatePurchaseSchema>) => {
      const qb = requireQB();
      const response = await qbClient.updatePurchase(qb, params.purchase);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(response.result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_purchase",
    {
      title: "Delete Purchase",
      description: `Delete a purchase in QuickBooks Online.

Args:
  - id: The QuickBooks purchase ID

Returns:
  Confirmation of deletion`,
      inputSchema: schemas.IdSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.IdSchema>) => {
      const qb = requireQB();
      const response = await qbClient.deletePurchase(qb, { Id: params.id });
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      return { content: [{ type: "text", text: "Purchase deleted successfully" }] };
    }
  );

  server.registerTool(
    "search_purchases",
    {
      title: "Search Purchases",
      description: `Search for purchases in QuickBooks Online.

Args:
  - criteria: Filter criteria
  - limit, offset, asc, desc: Pagination and sorting

Returns:
  Array of matching purchases`,
      inputSchema: schemas.SearchPurchasesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SearchPurchasesSchema>) => {
      const qb = requireQB();
      const criteria = buildSearchCriteria(params);
      const response = await qbClient.searchPurchases(qb, criteria);
      if (response.isError) {
        return { content: [{ type: "text", text: `Error: ${response.error}` }], isError: true };
      }
      const results = response.result || [];
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} purchases:\n${JSON.stringify(results, null, 2)}`
        }]
      };
    }
  );
}
