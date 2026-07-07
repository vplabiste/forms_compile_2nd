const fs = require('fs');

let content = fs.readFileSync('src/components/ManagerDashboard.tsx', 'utf-8');

const modal = `
      {/* Bulk Download Modal */}
      {isBulkDownloadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl w-full max-w-md space-y-4 text-left">
            <div className="flex justify-between items-start">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-sans">Bulk Download Options</h3>
              <button 
                onClick={() => setIsBulkDownloadModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Choose how you want to download active documents in bulk.
            </p>

            {bulkDownloadError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-600 dark:text-rose-400 text-xs">
                {bulkDownloadError}
              </div>
            )}

            <div className="space-y-4">
              {/* Option 1: All Active Documents */}
              <div className="p-4 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Download All Active Documents</h4>
                <button
                  onClick={handleBulkDownloadAllActive}
                  className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  Download All
                </button>
              </div>

              {/* Option 2: Date Range */}
              <div className="p-4 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Download by Date Range</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={bulkStartDate}
                      onChange={(e) => setBulkStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={bulkEndDate}
                      onChange={(e) => setBulkEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleBulkDownloadByDateRange}
                  className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  Download Selected Range
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsBulkDownloadModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Downloaded Forms Dialog */}
`;

content = content.replace(
  '      {/* Archive Downloaded Forms Dialog */}',
  modal
);

fs.writeFileSync('src/components/ManagerDashboard.tsx', content);
