# @mintmcp/quickbooks

MCP server for QuickBooks Online with OAuth 2.1 and Dynamic Client Registration (DCR) support.

## Features

- **OAuth 2.1 with DCR**: Full OAuth 2.1 implementation with Dynamic Client Registration per the MCP specification
- **50 QuickBooks Tools**: Complete CRUD operations for customers, invoices, items, accounts, estimates, bills, vendors, employees, journal entries, bill payments, and purchases
- **Dual Transport**: Supports both Streamable HTTP (for remote/OAuth) and stdio (for local development)

## Installation

```bash
npm install @mintmcp/quickbooks
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
# QuickBooks App Credentials (Required)
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret

# Environment: sandbox or production (default: sandbox)
QUICKBOOKS_ENVIRONMENT=sandbox

# OAuth Server Settings
OAUTH_ISSUER=http://localhost:3000
PORT=3000

# Transport: http or stdio (default: http)
TRANSPORT=http
```

### QuickBooks Developer Setup

1. Create an app at [developer.intuit.com](https://developer.intuit.com)
2. Add redirect URI: `http://localhost:3000/callback`
3. Copy your Client ID and Client Secret to `.env`

## Usage

### HTTP Transport (with OAuth)

```bash
npm start
```

The server will be available at:
- OAuth metadata: `http://localhost:3000/.well-known/oauth-authorization-server`
- Protected resource metadata: `http://localhost:3000/.well-known/oauth-protected-resource`
- MCP endpoint: `http://localhost:3000/mcp` (requires Bearer token)

### stdio Transport (local development)

Set additional environment variables:

```env
TRANSPORT=stdio
QUICKBOOKS_ACCESS_TOKEN=your_access_token
QUICKBOOKS_REFRESH_TOKEN=your_refresh_token
QUICKBOOKS_REALM_ID=your_company_id
```

## Available Tools

### Customers
- `create_customer` - Create a new customer
- `get_customer` - Get customer by ID
- `update_customer` - Update customer
- `delete_customer` - Delete (deactivate) customer
- `search_customers` - Search customers

### Invoices
- `create_invoice` - Create a new invoice
- `read_invoice` - Get invoice by ID
- `update_invoice` - Update invoice
- `search_invoices` - Search invoices

### Items
- `create_item` - Create a new item
- `read_item` - Get item by ID
- `update_item` - Update item
- `search_items` - Search items

### Accounts
- `create_account` - Create a new account
- `get_account` - Get account by ID
- `update_account` - Update account
- `search_accounts` - Search accounts

### Estimates
- `create_estimate` - Create a new estimate
- `get_estimate` - Get estimate by ID
- `update_estimate` - Update estimate
- `delete_estimate` - Delete estimate
- `search_estimates` - Search estimates

### Bills
- `create_bill` - Create a new bill
- `get_bill` - Get bill by ID
- `update_bill` - Update bill
- `delete_bill` - Delete bill
- `search_bills` - Search bills

### Vendors
- `create_vendor` - Create a new vendor
- `get_vendor` - Get vendor by ID
- `update_vendor` - Update vendor
- `delete_vendor` - Delete vendor
- `search_vendors` - Search vendors

### Employees
- `create_employee` - Create a new employee
- `get_employee` - Get employee by ID
- `update_employee` - Update employee
- `search_employees` - Search employees

### Journal Entries
- `create_journal_entry` - Create a new journal entry
- `get_journal_entry` - Get journal entry by ID
- `update_journal_entry` - Update journal entry
- `delete_journal_entry` - Delete journal entry
- `search_journal_entries` - Search journal entries

### Bill Payments
- `create_bill_payment` - Create a new bill payment
- `get_bill_payment` - Get bill payment by ID
- `update_bill_payment` - Update bill payment
- `delete_bill_payment` - Delete bill payment
- `search_bill_payments` - Search bill payments

### Purchases
- `create_purchase` - Create a new purchase
- `get_purchase` - Get purchase by ID
- `update_purchase` - Update purchase
- `delete_purchase` - Delete purchase
- `search_purchases` - Search purchases

## OAuth Flow

1. Client discovers OAuth metadata at `/.well-known/oauth-protected-resource`
2. Client registers via Dynamic Client Registration at `/register`
3. Client initiates authorization at `/authorize`
4. User authenticates with QuickBooks
5. Callback returns authorization code to client
6. Client exchanges code for tokens at `/token`
7. Client uses Bearer token for MCP requests

## License

MIT
