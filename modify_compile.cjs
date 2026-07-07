const fs = require('fs');

let content = fs.readFileSync('src/components/ManagerDashboard.tsx', 'utf-8');

content = content.replace(
  'const handleCompileZip = async () => {\n    if (selectedFormIds.size === 0) return;\n\n    setCompilingZip(true);\n    setCompilationProgress(\'Initializing compilation directory...\');\n    setError(null);\n    setSuccess(null);\n\n    try {\n      const zip = new JSZip();\n      const formsToZip = forms.filter((f) => selectedFormIds.has(f.id));',
  'const handleCompileZip = async (overrideForms?: FormRecord[]) => {\n    const formsToZip = overrideForms && overrideForms.length > 0 ? overrideForms : forms.filter((f) => selectedFormIds.has(f.id));\n    if (formsToZip.length === 0) return;\n\n    setCompilingZip(true);\n    setCompilationProgress(\'Initializing compilation directory...\');\n    setError(null);\n    setSuccess(null);\n\n    try {\n      const zip = new JSZip();'
);

fs.writeFileSync('src/components/ManagerDashboard.tsx', content);
