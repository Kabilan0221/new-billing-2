using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using ShopBilling.Core.Interfaces;
using ShopBilling.Core.Models;

namespace ShopBilling.Core.Services
{
    public class SettingsService
    {
        private readonly ISettingsRepository _settingsRepository;

        public SettingsService(ISettingsRepository settingsRepository)
        {
            _settingsRepository = settingsRepository ?? throw new ArgumentNullException(nameof(settingsRepository));
        }

        public AppSettings GetSettings()
        {
            return _settingsRepository.GetSettings();
        }

        public bool SaveSettings(AppSettings settings, out string errorMessage)
        {
            errorMessage = string.Empty;
            if (settings == null)
            {
                errorMessage = "Settings cannot be null.";
                return false;
            }

            // Validation
            if (string.IsNullOrWhiteSpace(settings.StoreName))
            {
                errorMessage = "Business Name is required.";
                return false;
            }

            if (!string.IsNullOrWhiteSpace(settings.GstNumber))
            {
                // Validate Indian GSTIN format if provided: 15 alphanumeric characters
                string cleanGst = settings.GstNumber.Trim().ToUpper();
                if (cleanGst.Length != 15)
                {
                    errorMessage = "GSTIN must be exactly 15 characters long (e.g., 33AAAAA0000A1Z5).";
                    return false;
                }
            }

            if (settings.DefaultTaxRate < 0 || settings.DefaultTaxRate > 100)
            {
                errorMessage = "Default tax rate must be between 0% and 100%.";
                return false;
            }

            if (settings.DefaultLowStockThreshold < 0)
            {
                errorMessage = "Default low-stock threshold cannot be negative.";
                return false;
            }

            if (settings.DefaultDiscountPercent < 0 || settings.DefaultDiscountPercent > 100)
            {
                errorMessage = "Default discount percent must be between 0% and 100%.";
                return false;
            }

            return _settingsRepository.SaveSettings(settings, out errorMessage);
        }

        public string GetStoreName()
        {
            return _settingsRepository.GetValue("StoreName", "Sri Murugan Super Market");
        }

        public string GetGstNumber()
        {
            return _settingsRepository.GetValue("GstNumber", "");
        }
    }
}
