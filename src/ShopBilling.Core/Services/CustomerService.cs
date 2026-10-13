using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;

namespace ShopBilling.Core.Services
{
    public class CustomerService
    {
        private readonly ICustomerRepository _customerRepo;
        private readonly ICustomerLedgerRepository _ledgerRepo;
        private readonly IInvoiceRepository _invoiceRepo;
        private readonly IPaymentRepository _paymentRepo;
        private readonly IAuditLogRepository _auditRepo;

        public CustomerService(
            ICustomerRepository customerRepo,
            ICustomerLedgerRepository ledgerRepo,
            IInvoiceRepository invoiceRepo,
            IPaymentRepository paymentRepo,
            IAuditLogRepository auditRepo)
        {
            _customerRepo = customerRepo ?? throw new ArgumentNullException(nameof(customerRepo));
            _ledgerRepo = ledgerRepo;
            _invoiceRepo = invoiceRepo;
            _paymentRepo = paymentRepo;
            _auditRepo = auditRepo;
        }

        public ValidationResult ValidateCustomer(Customer c, out List<string> warnings)
        {
            var result = new ValidationResult();
            warnings = new List<string>();

            if (c == null)
            {
                result.AddError("Customer record cannot be null.");
                return result;
            }

            if (string.IsNullOrWhiteSpace(c.Name))
            {
                result.AddError("Customer Name is required.");
            }
            else if (c.Name.Trim().Length < 2)
            {
                result.AddError("Customer Name must be at least 2 characters.");
            }

            if (!string.IsNullOrWhiteSpace(c.Mobile))
            {
                string cleaned = c.Mobile.Trim();
                if (!Regex.IsMatch(cleaned, @"^[0-9]{10}$") && !Regex.IsMatch(cleaned, @"^\+?[0-9]{10,13}$"))
                {
                    result.AddError("Mobile number must be a valid 10-digit number.");
                }
                else
                {
                    // Check duplicate mobile warning
                    if (_customerRepo.ExistsMobile(cleaned, c.Id == 0 ? (long?)null : c.Id))
                    {
                        warnings.Add($"Another active customer with phone number '{cleaned}' already exists.");
                    }
                }
            }

            if (!string.IsNullOrWhiteSpace(c.Gstin))
            {
                string g = c.Gstin.Trim().ToUpper();
                if (g.Length != 15)
                {
                    warnings.Add("GSTIN is usually 15 alphanumeric characters.");
                }
            }

            // Check duplicate code
            if (!string.IsNullOrWhiteSpace(c.Code) && _customerRepo.ExistsCode(c.Code.Trim(), c.Id == 0 ? (long?)null : c.Id))
            {
                result.AddError($"Customer code '{c.Code}' is already in use by another customer.");
            }

            return result;
        }

        public ValidationResult SaveCustomer(Customer c, out List<string> warnings)
        {
            var val = ValidateCustomer(c, out warnings);
            if (!val.IsValid) return val;

            if (c.Id == 0)
            {
                if (string.IsNullOrWhiteSpace(c.Code))
                {
                    c.Code = $"CUST-{Guid.NewGuid().ToString("N").Substring(0, 6).ToUpper()}";
                }
                long newId = _customerRepo.Insert(c);
                c.Id = newId;

                // If customer has an initial opening balance, log into customer ledger
                if (c.CurrentBalance > 0 && _ledgerRepo != null)
                {
                    _ledgerRepo.InsertEntry(new CustomerLedgerEntry
                    {
                        CustomerId = newId,
                        CustomerName = c.Name,
                        TransactionType = "OPENING_BALANCE",
                        ReferenceId = $"OB-{c.Code}",
                        Debit = c.CurrentBalance,
                        Credit = 0,
                        BalanceAfter = c.CurrentBalance,
                        Notes = "Opening balance forward",
                        TransactionDate = DateTime.UtcNow
                    });
                }

                _auditRepo?.Log("Customer", c.Code, "INSERT", $"Created customer '{c.Name}' (Phone: {c.Mobile ?? "N/A"})");
            }
            else
            {
                _customerRepo.Update(c);
                _auditRepo?.Log("Customer", c.Code, "UPDATE", $"Updated customer details for '{c.Name}'");
            }

            return val;
        }

        public bool DeactivateCustomer(long customerId, out string errorMessage)
        {
            errorMessage = string.Empty;
            if (customerId <= 1)
            {
                errorMessage = "The default Walk-in Customer cannot be deactivated.";
                return false;
            }

            var cust = _customerRepo.GetById(customerId);
            if (cust == null)
            {
                errorMessage = "Customer not found.";
                return false;
            }

            bool ok = _customerRepo.Deactivate(customerId);
            if (ok)
            {
                _auditRepo?.Log("Customer", cust.Code, "DEACTIVATE", $"Deactivated/Archived customer '{cust.Name}'");
            }
            return ok;
        }

        public Customer GetById(long id) => _customerRepo.GetById(id);
        public Customer GetByCode(string code) => _customerRepo.GetByCode(code);
        public Customer GetByMobile(string mobile) => _customerRepo.GetByMobile(mobile);
        public IEnumerable<Customer> GetAllActive() => _customerRepo.GetAllActive();
        public PagedResult<Customer> Search(string term, int page = 1, int pageSize = 50) => _customerRepo.Search(term, page, pageSize);

        public CustomerStatement GetCustomerStatement(long customerId, DateTime fromDate, DateTime toDate)
        {
            var cust = _customerRepo.GetById(customerId);
            if (cust == null) return null;

            decimal openingBal = 0;
            if (_ledgerRepo != null)
            {
                openingBal = _ledgerRepo.GetBalanceBeforeDate(customerId, fromDate);
            }

            var entries = (_ledgerRepo != null) 
                ? _ledgerRepo.GetLedger(customerId, fromDate, toDate).ToList()
                : new List<CustomerLedgerEntry>();

            decimal runningBal = openingBal;
            decimal totalDebits = 0;
            decimal totalCredits = 0;

            foreach (var e in entries)
            {
                totalDebits += e.Debit;
                totalCredits += e.Credit;
                runningBal += (e.Debit - e.Credit);
                e.BalanceAfter = runningBal;
            }

            return new CustomerStatement
            {
                Customer = cust,
                FromDate = fromDate,
                ToDate = toDate,
                OpeningBalance = openingBal,
                TotalPeriodDebits = totalDebits,
                TotalPeriodCredits = totalCredits,
                ClosingBalance = runningBal,
                Entries = entries
            };
        }

        public IEnumerable<InvoiceHeader> GetCustomerPurchases(long customerId)
        {
            if (_invoiceRepo == null) return new List<InvoiceHeader>();
            var filter = new InvoiceFilter { CustomerId = customerId, PageSize = 200 };
            return _invoiceRepo.Search(filter).Items;
        }

        public IEnumerable<InvoicePayment> GetCustomerPayments(long customerId)
        {
            if (_paymentRepo == null) return new List<InvoicePayment>();
            return _paymentRepo.GetByCustomer(customerId);
        }
    }
}
