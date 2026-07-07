import React, { useState, useEffect } from 'react';
import { db, runTransaction, doc, collection, query, where, getDocs, orderBy, serverTimestamp, addDoc } from '../lib/firebaseClient';
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, HelpCircle, History, Cloud, Layers, ArrowRight } from 'lucide-react';
import { UserProfile, FormRecord, DocumentTemplate } from '../types';

interface EmployeeDashboardProps {
  user: UserProfile;
}

export default function EmployeeDashboard({ user }: EmployeeDashboardProps) {
  // Form states
  const [file, setFile] = useState<File | null>(null);
  const [formInitials, setFormInitials] = useState('');
  const [comments, setComments] = useState('');

  // Template states
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateFetchError, setTemplateFetchError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);


  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<FormRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFetchError, setHistoryFetchError] = useState<string | null>(null);

  // Read Cloudinary settings from Vite env
  const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME || 'dbdkqms9c';
  const uploadPreset = (import.meta as any).env.VITE_CLOUDINARY_UPLOAD_PRESET || 'fordaforms';

  useEffect(() => {
    fetchHistory();
    fetchTemplates();
  }, [user.uid]);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    setTemplateFetchError(null);
    try {
      const q = query(
        collection(db, 'document_templates'),
        where('published', '==', true)
      );
      const snapshot = await getDocs(q);
      const fetched: DocumentTemplate[] = [];
      snapshot.forEach((doc) => {
        fetched.push(doc.data() as DocumentTemplate);
      });
      setTemplates(fetched);
      if (fetched.length > 0) {
        setSelectedTemplate(fetched[0]);
        setFormInitials(fetched[0].initials);
      } else {
        setSelectedTemplate(null);
        setFormInitials('');
      }
    } catch (err: any) {
      const isPermissionDenied = err.code === 'permission-denied' || 
                                 (err.message && err.message.toLowerCase().includes('permission')) ||
                                 JSON.stringify(err).toLowerCase().includes('permission');
      
      console.error('Error fetching document templates:', {
        error: err,
        code: err.code,
        message: err.message,
        isPermissionDenied,
        authUserId: user.uid,
        authUserEmail: user.email,
        path: 'document_templates'
      });

      if (isPermissionDenied) {
        setTemplateFetchError('Missing or insufficient database permissions to fetch templates. Please verify your role authorization.');
      } else {
        setTemplateFetchError('An error occurred while fetching form requirements: ' + (err.message || err));
      }
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    setHistoryFetchError(null);
    try {
      const q = query(
        collection(db, 'forms'),
        where('uploaderId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const fetchedHistory: FormRecord[] = [];
      snapshot.forEach((doc) => {
        fetchedHistory.push(doc.data() as FormRecord);
      });
      setHistory(fetchedHistory);
    } catch (err: any) {
      const isPermissionDenied = err.code === 'permission-denied' || 
                                 (err.message && err.message.toLowerCase().includes('permission')) ||
                                 JSON.stringify(err).toLowerCase().includes('permission');
      
      console.error('Error fetching history:', {
        error: err,
        code: err.code,
        message: err.message,
        isPermissionDenied,
        authUserId: user.uid,
        authUserEmail: user.email,
        path: 'forms'
      });

      if (isPermissionDenied) {
        setHistoryFetchError('Missing or insufficient database permissions to retrieve your upload history. Please verify your role authorization.');
      } else {
        setHistoryFetchError('An error occurred while fetching history: ' + (err.message || err));
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select or drag-and-drop a file to upload.');
      return;
    }

    if (!formInitials || formInitials.trim().length < 2 || formInitials.trim().length > 4) {
      setError('Form Initials must be between 2 and 4 characters.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let secureUrl = '';
      try {
        if (cloudName === 'demo' || uploadPreset === 'unsigned_preset') {
          throw new Error('Cloudinary not configured. Using fallback local storage.');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        const cloudinaryRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!cloudinaryRes.ok) {
          const errData = await cloudinaryRes.json().catch(() => ({}));
          throw new Error(
            errData.error?.message || 'Failed to upload document to storage provider.'
          );
        }

        const cloudinaryData = await cloudinaryRes.json();
        secureUrl = cloudinaryData.secure_url;

        if (!secureUrl) {
          throw new Error('Could not retrieve secure storage URL from Cloudinary.');
        }
      } catch (uploadErr: any) {
        console.warn('Cloudinary upload bypassed/failed, using base64 fallback:', uploadErr);
        if (file.size > 900 * 1024) {
          throw new Error('The file is too large for database-backed fallback storage. Please upload a file smaller than 900 KB, or configure your Cloudinary account.');
        }
        secureUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (e) => reject(new Error('Failed to read file: ' + e));
          reader.readAsDataURL(file);
        });
      }

      let finalSystemName = '';

      // 2. Transaction: Read per-form counter, increment, write form record
      await runTransaction(db, async (transaction) => {
        const formattedFormInitials = formInitials.trim().toUpperCase();
        const counterRef = doc(db, 'counters', formattedFormInitials.toLowerCase());
        const counterSnap = await transaction.get(counterRef);

        let currentCount = 1000; // Base starting point for beautiful serial sequencing
        if (counterSnap.exists()) {
          const data = counterSnap.data();
          if (typeof data.formSequenceCount === 'number') {
            currentCount = data.formSequenceCount;
          }
        }

        const nextCount = currentCount + 1;

        // Atomically set/update the counter
        transaction.set(counterRef, { formSequenceCount: nextCount }, { merge: true });

        // Calculate system-assigned file name
        const fileExtension = file.name.split('.').pop() || 'pdf';
        const systemName = `${user.initials}_${formattedFormInitials}_${nextCount}.${fileExtension}`;
        finalSystemName = systemName;

        // Create new form record
        const formsCollectionRef = collection(db, 'forms');
        const newFormDocRef = doc(formsCollectionRef);

        transaction.set(newFormDocRef, {
          id: newFormDocRef.id,
          originalName: file.name,
          systemName: systemName,
          cloudinaryUrl: secureUrl,
          comments: comments.trim(),
          uploaderId: user.uid,
          uploaderInitials: user.initials,
          formInitials: formattedFormInitials,
          sequenceNumber: nextCount,
          createdAt: serverTimestamp(),
        });
      });

      // Add activity log
      try {
        await addDoc(collection(db, 'logs'), {
          action: 'Upload',
          performedBy: user.name || user.email,
          performedByRole: user.role || 'Employee',
          details: `Uploaded file "${finalSystemName}" (Original: "${file.name}")`,
          createdAt: serverTimestamp()
        });
      } catch (logErr) {
        console.error('Failed to write activity log:', logErr);
      }

      // Successful completion
      setSuccess('Form successfully uploaded, registered, and sequenced!');
      setFile(null);
      setFormInitials('');
      setComments('');

      // Refresh list
      fetchHistory();
    } catch (err: any) {
      console.error('Upload flow error:', err);
      setError(
        err.message || 'An unexpected error occurred during sequencing or upload.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isCloudinaryConfigured = cloudName !== 'demo' && uploadPreset !== 'unsigned_preset';

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Introduction Header */}
      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 text-zinc-950 dark:text-white rounded-2xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-sans">Form Delivery Terminal</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            Upload forms securely. Documents undergo sequential naming tracking and are permanently locked after entry.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 text-xs font-mono">
          <Cloud className="w-4 h-4 text-sky-400 animate-pulse" />
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            {isCloudinaryConfigured ? 'Cloud Storage Connected' : 'Demo Mode Connection'}
          </span>
        </div>
      </div>

      {!isCloudinaryConfigured && (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/50 text-amber-400 text-xs flex items-start space-x-3 leading-relaxed font-mono">
          <AlertCircle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <strong>Cloud Storage Configuration Notice:</strong> The system is currently reading default environment secrets (demo cloud name). Unsigned uploads might fail. To integrate your personal Cloudinary storage:
            <ul className="list-disc list-inside mt-1.5 space-y-0.5 text-zinc-500 dark:text-zinc-500">
              <li>VITE_CLOUDINARY_CLOUD_NAME="your_cloud_name"</li>
              <li>VITE_CLOUDINARY_UPLOAD_PRESET="your_unsigned_preset"</li>
            </ul>
          </div>
        </div>
      )}

      {/* Template Fetch Error */}
      {templateFetchError && (
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/50 text-red-400 text-xs flex items-start space-x-3 leading-relaxed font-mono">
          <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Authorization Error:</strong> {templateFetchError}
            <div className="mt-2">
              <button 
                onClick={fetchTemplates}
                className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Retry Loading Templates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Published Form Requirements Cards Grid */}
      {!templateFetchError && templates.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-500/10 text-indigo-400 p-1.5 rounded-lg border border-indigo-500/25">
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 font-mono">
              Published Form Requirements
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((temp) => {
              const isSelected = formInitials.toUpperCase() === temp.initials.toUpperCase();
              return (
                <div
                  key={temp.id}
                  onClick={() => {
                    setFormInitials(temp.initials);
                    setSelectedTemplate(temp);
                    // Scroll upload form into view smoothly
                    const uploadEl = document.getElementById('form-upload');
                    if (uploadEl) {
                      uploadEl.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className={`group p-5 rounded-2xl border transition-all duration-200 cursor-pointer text-left relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-600/5'
                      : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900/80 shadow-md'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-1 text-xs font-bold font-mono tracking-wider rounded-lg border ${
                        isSelected 
                          ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' 
                          : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-indigo-400/90'
                      }`}>
                        {temp.initials}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-indigo-400 font-mono flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                          <span>Selected</span>
                        </span>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tracking-wide group-hover:text-zinc-950 dark:text-white transition-colors">
                        {temp.name}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mt-1.5 min-h-[36px] line-clamp-2">
                        {temp.description || 'No specific description provided by manager.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-500 group-hover:text-zinc-600 dark:text-zinc-400 transition-colors">
                    <span>By: {temp.creatorName}</span>
                    <span className="flex items-center text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">
                      Deliver Document <ArrowRight className="w-3 h-3 ml-1" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Card */}
        <div className="lg:col-span-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl h-fit backdrop-blur-xs">
          <div className="flex items-center space-x-2.5 mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800/80">
            <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-lg border border-indigo-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tracking-wide">
                {selectedTemplate ? `Deliver Form: ${selectedTemplate.initials}` : 'Deliver Document'}
              </h2>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono mt-0.5">
                {selectedTemplate ? `Targeting: ${selectedTemplate.name}` : 'Select a published form requirement'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/25 border border-rose-900/50 text-rose-400 text-xs flex items-start space-x-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-900/50 text-emerald-400 text-xs flex items-start space-x-2 leading-relaxed">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {templates.length === 0 ? (
            <div className="p-5 text-center bg-white dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-850 space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-zinc-800 dark:text-zinc-200 font-bold text-xs">Waiting for Manager Publication</h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                You can only submit documents for templates published by your manager. Please wait for a manager to publish a requirement.
              </p>
            </div>
          ) : (
            <form onSubmit={handleUploadSubmit} className="space-y-4" id="form-upload">
              
              {/* Drag & Drop File Upload Stage */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-2 font-mono">
                  Document File
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : file
                      ? 'border-emerald-800 bg-emerald-950/10'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 hover:bg-zinc-50 dark:bg-zinc-900/30 hover:border-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  <input
                    type="file"
                    id="file-input"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isLoading}
                  />
                  
                  {file ? (
                    <div className="space-y-2">
                      <div className="mx-auto w-10 h-10 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[220px]">
                          {file.name}
                        </p>
                        <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-500 mt-0.5">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="mx-auto w-10 h-10 bg-zinc-9050 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                          Drag & Drop or click to browse
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
                          Supports PDF, PNG, JPG, DOCX up to 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Initials Input - strictly chosen from published templates */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest font-mono">
                    Select Published Form Type
                  </label>
                  <div className="group relative flex items-center">
                    <HelpCircle className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 cursor-help" />
                    <span className="absolute bottom-full right-0 w-48 p-2.5 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none mb-1 shadow-xl border border-zinc-200 dark:border-zinc-800 leading-normal z-10 font-sans">
                      Choose from the form requirements published by your manager.
                    </span>
                  </div>
                </div>
                
                <select
                  required
                  value={formInitials}
                  onChange={(e) => {
                    const selectedInit = e.target.value;
                    setFormInitials(selectedInit);
                    const found = templates.find(t => t.initials.toUpperCase() === selectedInit.toUpperCase());
                    setSelectedTemplate(found || null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-800 dark:text-zinc-200 text-sm font-bold tracking-wider uppercase focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
                  disabled={isLoading}
                >
                  {templates.map((temp) => (
                    <option key={temp.id} value={temp.initials} className="bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-mono text-xs">
                      {temp.initials} - {temp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Comments Field */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Comments (Optional)
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Provide details about the document contents..."
                  rows={3}
                  className="w-full px-3.5 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-800 dark:text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600 resize-none"
                  disabled={isLoading}
                />
              </div>

              {/* Immutability Disclaimer */}
              <div className="p-3 bg-rose-950/15 border border-rose-900/30 rounded-xl text-xs text-rose-400/90 leading-relaxed font-sans">
                <strong>Immutability Clause:</strong> Once submitted, files are immediately integrated into the sequence tracking. They cannot be modified or deleted by your account.
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-zinc-950 dark:text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 flex items-center justify-center space-x-2 cursor-pointer mt-2"
                disabled={isLoading}
                id="btn-upload-form"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing & Sequencing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload & Register Form</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Upload History list */}
        <div className="lg:col-span-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col h-[540px] backdrop-blur-xs">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800/80 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tracking-wide">Upload Delivery Ledger</h2>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono mt-0.5">Your immutable uploads tracked by this terminal</p>
              </div>
            </div>

            <button
              onClick={fetchHistory}
              className="p-1.5 hover:bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800/80 transition-colors cursor-pointer bg-white dark:bg-zinc-950"
              title="Refresh Ledger"
              disabled={loadingHistory}
            >
              <History className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {historyFetchError && (
            <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/50 text-red-400 text-xs flex items-start space-x-3 leading-relaxed font-mono m-4">
              <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong>Authorization Error:</strong> {historyFetchError}
                <div className="mt-2">
                  <button 
                    onClick={fetchHistory}
                    className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Retry Loading History
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History table */}
          {!historyFetchError && (
          <div className="overflow-y-auto flex-1 min-h-0 border border-zinc-200 dark:border-zinc-800/80 rounded-xl bg-white dark:bg-zinc-950/20">
            {loadingHistory && history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-500 space-y-2 font-mono">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="text-xs font-semibold">Retrieving active history ledger...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-500 p-6 text-center">
                <FileText className="w-10 h-10 text-zinc-700 mb-2" />
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No Forms Uploaded Yet</span>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1.5 max-w-xs leading-relaxed">
                  Your uploaded documents will appear in this ledger with their system tracking sequence name.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-500 font-bold text-[11px] uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800/60 font-mono">
                    <th className="py-3 px-4">System File Name</th>
                    <th className="py-3 px-4">Comment</th>
                    <th className="py-3 px-4">Sequence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/40">
                  {history.map((record) => (
                    <tr key={record.id} className="hover:bg-zinc-100 dark:bg-zinc-800/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <a
                          href={record.cloudinaryUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono font-bold text-indigo-400 hover:text-indigo-300 hover:underline text-sm block"
                        >
                          {record.systemName}
                        </a>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-500 block mt-0.5">
                          Original: {record.originalName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                        {record.comments || <em className="text-zinc-600 font-mono text-[11px]">No comment</em>}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-500">
                        #{record.sequenceNumber}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          )}
        </div>

      </div>
    </div>
  );
}
