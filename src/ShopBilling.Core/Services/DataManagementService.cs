using System;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;

namespace ShopBilling.Core.Services
{
    public class DataManagementService
    {
        private readonly IDataManagementRepository _dataManagementRepository;

        public DataManagementService(IDataManagementRepository dataManagementRepository)
        {
            _dataManagementRepository = dataManagementRepository ?? throw new ArgumentNullException(nameof(dataManagementRepository));
        }

        public DataManagementInfo GetDatabaseInfo()
        {
            return _dataManagementRepository.GetDatabaseInfo();
        }

        public DataIntegrityResult RunIntegrityCheck()
        {
            return _dataManagementRepository.RunIntegrityCheck();
        }

        public bool OptimizeDatabase(out string message)
        {
            return _dataManagementRepository.OptimizeDatabase(out message);
        }
    }
}
