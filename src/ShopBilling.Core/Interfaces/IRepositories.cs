using System.Collections.Generic;
using ShopBilling.Core.Models;

namespace ShopBilling.Core.Interfaces
{
    public interface IProductRepository
    {
        Product GetById(long id);
        Product GetByBarcode(string barcode);
        Product GetByProductCode(string code);
        PagedResult<Product> Search(ProductFilter filter);
        long Insert(Product product);
        bool Update(Product product);
        bool Deactivate(long id);
        bool Activate(long id);
        int BulkInsert(IEnumerable<Product> products, bool updateDuplicates = false);
        bool ExistsBarcode(string barcode, long? excludeId = null);
        bool ExistsProductCode(string code, long? excludeId = null);
        int GetTotalCount();
        int GetLowStockCount();
    }

    public interface ICategoryRepository
    {
        IEnumerable<Category> GetAll(bool includeInactive = false);
        Category GetById(long id);
        Category GetByName(string name);
        long Insert(Category category);
        bool Update(Category category);
        bool Delete(long id);
        
        IEnumerable<Subcategory> GetSubcategories(long categoryId, bool includeInactive = false);
        Subcategory GetSubcategoryById(long id);
        long InsertSubcategory(Subcategory subcategory);
        bool UpdateSubcategory(Subcategory subcategory);
    }

    public interface IBrandRepository
    {
        IEnumerable<Brand> GetAll(bool includeInactive = false);
        Brand GetById(long id);
        Brand GetByName(string name);
        long Insert(Brand brand);
        bool Update(Brand brand);
        bool Delete(long id);
    }

    public interface IAuditLogRepository
    {
        void Log(string entity, string entityId, string action, string details);
        IEnumerable<AuditLog> GetRecent(int limit = 100);
    }

    public interface ISupplierRepository
    {
        Supplier GetById(long id);
        Supplier GetByCode(string code);
        PagedResult<Supplier> Search(SupplierFilter filter);
        IEnumerable<Supplier> GetAllActive();
        long Insert(Supplier supplier);
        bool Update(Supplier supplier);
        bool Deactivate(long id);
        bool Activate(long id);
        bool ExistsCode(string code, long? excludeId = null);
        bool HasTransactions(long id);
        int BulkInsert(IEnumerable<Supplier> suppliers, bool updateDuplicates = false);
    }

    public interface IPurchaseRepository
    {
        PurchaseHeader GetById(long id);
        PurchaseHeader GetByNumber(string purchaseNumber);
        PagedResult<PurchaseHeader> Search(PurchaseFilter filter);
        long CreateDraft(PurchaseHeader purchase);
        bool UpdateDraft(PurchaseHeader purchase);
        bool ConfirmPurchase(long purchaseId, out string errorMessage);
        bool CancelPurchase(long purchaseId, out string errorMessage);
        string GenerateNextPurchaseNumber();
    }

    public interface ISupplierPaymentRepository
    {
        SupplierPayment GetById(long id);
        IEnumerable<SupplierPayment> GetBySupplierId(long supplierId);
        IEnumerable<SupplierPayment> GetByPurchaseId(long purchaseId);
        long InsertPayment(SupplierPayment payment);
        string GenerateNextPaymentNumber();
        IEnumerable<SupplierLedgerEntry> GetLedger(long supplierId);
    }

    public interface IStockMovementRepository
    {
        IEnumerable<StockMovement> GetByProductId(long productId, int limit = 50);
        IEnumerable<StockMovement> GetByReference(string referenceType, string referenceId);
    }

    public interface IStockRepository
    {
        StockDashboardMetrics GetDashboardMetrics();
        PagedResult<CurrentStockSummary> GetCurrentStock(StockFilter filter);
        IEnumerable<StockValuationSummary> GetStockValuation(long? categoryId = null);
        PagedResult<StockMovement> GetMovements(StockMovementFilter filter);
        long CreateAdjustmentDraft(StockAdjustment adjustment);
        bool UpdateAdjustmentDraft(StockAdjustment adjustment);
        bool ConfirmAdjustment(long adjustmentId, out string errorMessage);
        bool CancelAdjustment(long adjustmentId, out string errorMessage);
        StockAdjustment GetAdjustmentById(long id);
        PagedResult<StockAdjustment> SearchAdjustments(StockAdjustmentFilter filter);
        string GenerateNextAdjustmentNumber();
        long CreatePhysicalVerificationDraft(PhysicalStockVerification verification);
        bool ConfirmPhysicalVerification(long verificationId, out string errorMessage);
        PhysicalStockVerification GetPhysicalVerificationById(long id);
        string GenerateNextVerificationNumber();
    }

    public interface ICustomerRepository
    {
        Customer GetById(long id);
        Customer GetByCode(string code);
        Customer GetByMobile(string mobile);
        PagedResult<Customer> Search(string searchTerm, int page = 1, int pageSize = 50);
        IEnumerable<Customer> GetAllActive();
        long Insert(Customer customer);
        bool Update(Customer customer);
        bool Deactivate(long id);
        bool Activate(long id);
        bool HasTransactions(long id);
        bool ExistsMobile(string mobile, long? excludeId = null);
        bool ExistsCode(string code, long? excludeId = null);
    }

    public interface ICustomerLedgerRepository
    {
        void InsertEntry(CustomerLedgerEntry entry);
        IEnumerable<CustomerLedgerEntry> GetLedger(long customerId, System.DateTime? fromDate = null, System.DateTime? toDate = null);
        decimal GetCustomerBalance(long customerId);
        decimal GetBalanceBeforeDate(long customerId, System.DateTime date);
    }

    public interface IPaymentRepository
    {
        long RecordPayment(long invoiceId, string paymentMethod, decimal amount, string referenceNumber, string notes, out string error);
        bool ReversePayment(long paymentId, string reason, out string error);
        PagedResult<InvoicePayment> Search(PaymentFilter filter);
        IEnumerable<InvoicePayment> GetByInvoice(long invoiceId);
        IEnumerable<InvoicePayment> GetByCustomer(long customerId);
        InvoicePayment GetById(long id);
        string GenerateNextPaymentNumber();
    }

    public interface IInvoiceRepository
    {
        InvoiceHeader GetById(long id);
        InvoiceHeader GetByNumber(string invoiceNumber);
        PagedResult<InvoiceHeader> Search(InvoiceFilter filter);
        long CreateDraft(InvoiceHeader invoice);
        bool UpdateDraft(InvoiceHeader invoice);
        bool FinalizeInvoice(InvoiceHeader invoice, out string errorMessage);
        bool CancelInvoice(long invoiceId, string cancellationReason, out string errorMessage);
        string GenerateNextInvoiceNumber();
        IEnumerable<InvoicePayment> GetPayments(long invoiceId);
    }

    public interface IEstimateRepository
    {
        EstimateHeader GetById(long id);
        EstimateHeader GetByNumber(string estimateNumber);
        PagedResult<EstimateHeader> Search(EstimateFilter filter);
        long CreateDraft(EstimateHeader estimate);
        bool UpdateDraft(EstimateHeader estimate);
        bool ConfirmEstimate(long estimateId, out string errorMessage);
        bool CancelEstimate(long estimateId, string cancellationReason, out string errorMessage);
        bool ConvertToInvoice(long estimateId, InvoiceHeader invoiceToCreate, out InvoiceHeader createdInvoice, out string errorMessage);
        string GenerateNextEstimateNumber();
    }

    public interface ISettingsRepository
    {
        AppSettings GetSettings();
        bool SaveSettings(AppSettings settings, out string errorMessage);
        string GetValue(string key, string defaultValue = null);
        bool SetValue(string key, string value, string description = null);
    }

    public interface IReportRepository
    {
        List<SalesReportRow> GetSalesReport(ReportFilter filter);
        List<ProductWiseSalesReportRow> GetProductWiseSalesReport(ReportFilter filter);
        List<PurchaseReportRow> GetPurchaseReport(ReportFilter filter);
        List<StockReportRow> GetStockReport(ReportFilter filter);
        List<CustomerReportRow> GetCustomerReport(ReportFilter filter);
        List<PaymentCollectionReportRow> GetPaymentCollectionReport(ReportFilter filter);
        DashboardMetrics GetDashboardMetrics();
    }

    public interface IDataManagementRepository
    {
        DataManagementInfo GetDatabaseInfo();
        DataIntegrityResult RunIntegrityCheck();
        bool OptimizeDatabase(out string message);
    }
}

