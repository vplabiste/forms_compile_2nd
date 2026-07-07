const fs = require('fs');

let content = fs.readFileSync('src/components/ManagerDashboard.tsx', 'utf-8');

const newButton = `
          <button
            onClick={() => {
              setBulkStartDate('');
              setBulkEndDate('');
              setBulkDownloadError(null);
              setIsBulkDownloadModalOpen(true);
            }}
            disabled={compilingZip}
            className="flex items-center space-x-2 px-4 py-2.5 font-bold rounded-xl text-sm transition-all shadow-md flex-1 sm:flex-none justify-center cursor-pointer bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
            title="Bulk Download Options"
          >
            <FileArchive className="w-4 h-4" />
            <span className="hidden sm:inline">Bulk Options</span>
          </button>
`;

content = content.replace(
  '<RefreshCw className={`w-4.5 h-4.5 ${loading ? \'animate-spin\' : \'\'}`} />\n          </button>',
  '<RefreshCw className={`w-4.5 h-4.5 ${loading ? \'animate-spin\' : \'\'}`} />\n          </button>\n' + newButton
);

fs.writeFileSync('src/components/ManagerDashboard.tsx', content);
