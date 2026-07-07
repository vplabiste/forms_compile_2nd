const fs = require('fs');

let content = fs.readFileSync('src/components/ManagerDashboard.tsx', 'utf-8');

const handlers = `
  const handleBulkDownloadAllActive = () => {
    const activeForms = forms.filter(f => !f.archived);
    if (activeForms.length === 0) {
      setBulkDownloadError("No active documents available to download.");
      return;
    }
    setIsBulkDownloadModalOpen(false);
    handleCompileZip(activeForms);
  };

  const handleBulkDownloadByDateRange = () => {
    if (!bulkStartDate || !bulkEndDate) {
      setBulkDownloadError("Please select both a start date and an end date.");
      return;
    }
    const start = new Date(bulkStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(bulkEndDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      setBulkDownloadError("Start date cannot be after end date.");
      return;
    }

    const rangeForms = forms.filter(f => {
      if (f.archived) return false;
      if (!f.createdAt) return false;
      const createdAt = f.createdAt.toDate ? f.createdAt.toDate() : new Date(f.createdAt);
      return createdAt >= start && createdAt <= end;
    });

    if (rangeForms.length === 0) {
      setBulkDownloadError("No active documents found within the selected date range.");
      return;
    }

    setIsBulkDownloadModalOpen(false);
    handleCompileZip(rangeForms);
  };

`;

content = content.replace(
  '// Compile ZIP and download',
  handlers + '  // Compile ZIP and download'
);

fs.writeFileSync('src/components/ManagerDashboard.tsx', content);
