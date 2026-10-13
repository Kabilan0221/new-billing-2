using System;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;

namespace ShopBilling.Core.Services
{
    public class DashboardService
    {
        private readonly IReportRepository _reportRepository;

        public DashboardService(IReportRepository reportRepository)
        {
            _reportRepository = reportRepository ?? throw new ArgumentNullException(nameof(reportRepository));
        }

        public DashboardMetrics GetDashboardMetrics()
        {
            try
            {
                return _reportRepository.GetDashboardMetrics();
            }
            catch (Exception ex)
            {
                Logger.LogError("DashboardService.GetDashboardMetrics", ex);
                return new DashboardMetrics();
            }
        }
    }
}
