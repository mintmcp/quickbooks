// Type declarations for node-quickbooks

declare module "node-quickbooks" {
  class QuickBooks {
    constructor(
      clientId: string,
      clientSecret: string,
      accessToken: string,
      tokenSecret: boolean,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      minorVersion: number | null,
      oauthVersion: string,
      refreshToken?: string
    );

    // Customer methods
    createCustomer(customer: unknown, callback: (err: unknown, customer: unknown) => void): void;
    getCustomer(id: string, callback: (err: unknown, customer: unknown) => void): void;
    updateCustomer(customer: unknown, callback: (err: unknown, customer: unknown) => void): void;
    deleteCustomer(idOrEntity: unknown, callback: (err: unknown, result: unknown) => void): void;
    findCustomers(criteria: unknown, callback: (err: unknown, result: unknown) => void): void;

    // Invoice methods
    createInvoice(invoice: unknown, callback: (err: unknown, invoice: unknown) => void): void;
    getInvoice(id: string, callback: (err: unknown, invoice: unknown) => void): void;
    updateInvoice(invoice: unknown, callback: (err: unknown, invoice: unknown) => void): void;
    deleteInvoice(idOrEntity: unknown, callback: (err: unknown, result: unknown) => void): void;
    findInvoices(criteria: unknown, callback: (err: unknown, result: unknown) => void): void;

    // Account methods
    createAccount(account: unknown, callback: (err: unknown, account: unknown) => void): void;
    getAccount(id: string, callback: (err: unknown, account: unknown) => void): void;
    updateAccount(account: unknown, callback: (err: unknown, account: unknown) => void): void;
    findAccounts(criteria: unknown, callback: (err: unknown, result: unknown) => void): void;

    // Item methods
    createItem(item: unknown, callback: (err: unknown, item: unknown) => void): void;
    getItem(id: string, callback: (err: unknown, item: unknown) => void): void;
    updateItem(item: unknown, callback: (err: unknown, item: unknown) => void): void;
    findItems(criteria: unknown, callback: (err: unknown, result: unknown) => void): void;

    // Estimate methods
    createEstimate(estimate: unknown, callback: (err: unknown, estimate: unknown) => void): void;
    getEstimate(id: string, callback: (err: unknown, estimate: unknown) => void): void;
    updateEstimate(estimate: unknown, callback: (err: unknown, estimate: unknown) => void): void;
    deleteEstimate(idOrEntity: unknown, callback: (err: unknown, result: unknown) => void): void;
    findEstimates(criteria: unknown, callback: (err: unknown, result: unknown) => void): void;

    // Bill methods
    createBill(bill: unknown, callback: (err: unknown, bill: unknown) => void): void;
    getBill(id: string, callback: (err: unknown, bill: unknown) => void): void;
    updateBill(bill: unknown, callback: (err: unknown, bill: unknown) => void): void;
    deleteBill(idOrEntity: unknown, callback: (err: unknown, result: unknown) => void): void;
    findBills(criteria: unknown, callback: (err: unknown, result: unknown) => void): void;

    // Vendor methods
    createVendor(vendor: unknown, callback: (err: unknown, vendor: unknown) => void): void;
    getVendor(id: string, callback: (err: unknown, vendor: unknown) => void): void;
    updateVendor(vendor: unknown, callback: (err: unknown, vendor: unknown) => void): void;
    deleteVendor(idOrEntity: unknown, callback: (err: unknown, result: unknown) => void): void;
    findVendors(criteria: unknown, callback: (err: unknown, result: unknown) => void): void;

    // Employee methods
    createEmployee(employee: unknown, callback: (err: unknown, employee: unknown) => void): void;
    getEmployee(id: string, callback: (err: unknown, employee: unknown) => void): void;
    updateEmployee(employee: unknown, callback: (err: unknown, employee: unknown) => void): void;
    findEmployees(criteria: unknown, callback: (err: unknown, result: unknown) => void): void;

    // Journal Entry methods
    createJournalEntry(entry: unknown, callback: (err: unknown, entry: unknown) => void): void;
    getJournalEntry(id: string, callback: (err: unknown, entry: unknown) => void): void;
    updateJournalEntry(entry: unknown, callback: (err: unknown, entry: unknown) => void): void;
    deleteJournalEntry(idOrEntity: unknown, callback: (err: unknown, result: unknown) => void): void;
    findJournalEntries(criteria: unknown, callback: (err: unknown, result: unknown) => void): void;

    // Bill Payment methods
    createBillPayment(payment: unknown, callback: (err: unknown, payment: unknown) => void): void;
    getBillPayment(id: string, callback: (err: unknown, payment: unknown) => void): void;
    updateBillPayment(payment: unknown, callback: (err: unknown, payment: unknown) => void): void;
    deleteBillPayment(idOrEntity: unknown, callback: (err: unknown, result: unknown) => void): void;
    findBillPayments(criteria: unknown, callback: (err: unknown, result: unknown) => void): void;

    // Purchase methods
    createPurchase(purchase: unknown, callback: (err: unknown, purchase: unknown) => void): void;
    getPurchase(id: string, callback: (err: unknown, purchase: unknown) => void): void;
    updatePurchase(purchase: unknown, callback: (err: unknown, purchase: unknown) => void): void;
    deletePurchase(idOrEntity: unknown, callback: (err: unknown, result: unknown) => void): void;
    findPurchases(criteria: unknown, callback: (err: unknown, result: unknown) => void): void;
  }

  export = QuickBooks;
}
