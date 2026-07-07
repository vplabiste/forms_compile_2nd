import React, { useState, useEffect } from 'react';
import { db, auth, collection, query, getDocs, orderBy, runTransaction, doc, serverTimestamp, updateDoc, deleteDoc, addDoc } from '../lib/firebaseClient';
import { Download, Search, Edit2, CheckSquare, Square, FileArchive, Loader2, AlertCircle, CheckCircle2, RefreshCw, ChevronLeft, ChevronRight, Filter, FileText, Upload, Cloud, Plus, Trash2, Layers, Check, X } from 'lucide-react';
import { FormRecord, UserProfile, DocumentTemplate, ActivityLog } from '../types';
import JSZip from 'jszip';

interface ManagerDashboardProps {
  user?: UserProfile;
}

export default function ManagerDashboard({ user }: ManagerDashboardProps) {
  // All uploaded forms
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUploaderFilter, setSelectedUploaderFilter] = useState('');
  const [selectedFormFilter, setSelectedFormFilter] = useState('');
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');

  // Archive prompt popup states
  const [showArchivePrompt, setShowArchivePrompt] = useState(false);
  const [downloadedFormIds, setDownloadedFormIds] = useState<string[]>([]);

  // File deletion triple-check states
  const [formToDelete, setFormToDelete] = useState<FormRecord | null>(null);
  const [deleteStage, setDeleteStage] = useState<number>(0); // 0 = closed, 1 = stage 1, 2 = stage 2, 3 = stage 3
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingForm, setIsDeletingForm] = useState(false);

  // Selection state
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(new Set());

  // Edit comment modal/state
  const [editingForm, setEditingForm] = useState<FormRecord | null>(null);
  const [newComment, setNewComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  // Compilation / ZIP states
  const [compilingZip, setCompilingZip] = useState(false);
  const [compilationProgress, setCompilationProgress] = useState('');
  
  // Status notifications
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- DOCUMENT TEMPLATE STATES ---
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateFetchError, setTemplateFetchError] = useState<string | null>(null);
  const [formFetchError, setFormFetchError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create template form states
  const [templateName, setTemplateName] = useState('');
  const [templateInitials, setTemplateInitials] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templatePublishing, setTemplatePublishing] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null);

  // --- EDIT & UNPUBLISH CONFIRM STATES ---
  const [isUnpublishConfirmOpen, setIsUnpublishConfirmOpen] = useState(false);
  const [templateToUnpublishAndEdit, setTemplateToUnpublishAndEdit] = useState<DocumentTemplate | null>(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editInitials, setEditInitials] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // --- 2-STAGE PUBLISH STATES ---
  const [publishStage, setPublishStage] = useState(0); // 0 = inactive, 1 = Stage 1, 2 = Stage 2
  const [templateToPublish, setTemplateToPublish] = useState<DocumentTemplate | null>(null);
  const [isPublishingThroughStages, setIsPublishingThroughStages] = useState(false);


  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Upload states for managers (to add forms/bin cards with custom initials)
  const [file, setFile] = useState<File | null>(null);
  const [uploaderInitials, setUploaderInitials] = useState(user?.initials || '');
  const [formInitials, setFormInitials] = useState('');
  const [comments, setComments] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Sync initials when user profile loads
  useEffect(() => {
    if (user?.initials) {
      setUploaderInitials(user.initials);
    }
  }, [user]);

  // Cloudinary keys
  const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME || 'dbdkqms9c';
  const uploadPreset = (import.meta as any).env.VITE_CLOUDINARY_UPLOAD_PRESET || 'fordaforms';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadError(null);
    }
  };

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
      setUploadError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Please select or drag-and-drop a file to upload.');
      return;
    }

    if (!uploaderInitials || uploaderInitials.trim().length < 2 || uploaderInitials.trim().length > 3) {
      setUploadError('Uploader Initials must be 2 or 3 characters.');
      return;
    }

    if (!formInitials || formInitials.trim().length < 2 || formInitials.trim().length > 4) {
      setUploadError('Form Initials must be between 2 and 4 characters.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

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

      await runTransaction(db, async (transaction) => {
        const formattedFormInitials = formInitials.trim().toUpperCase();
        const counterRef = doc(db, 'counters', formattedFormInitials.toLowerCase());
        const counterSnap = await transaction.get(counterRef);

        let currentCount = 1000;
        if (counterSnap.exists()) {
          const data = counterSnap.data();
          if (typeof data.formSequenceCount === 'number') {
            currentCount = data.formSequenceCount;
          }
        }

        const nextCount = currentCount + 1;

        transaction.set(counterRef, { formSequenceCount: nextCount }, { merge: true });

        const fileExtension = file.name.split('.').pop() || 'pdf';
        const formattedUploaderInitials = uploaderInitials.trim().toUpperCase();
        const systemName = `${formattedUploaderInitials}_${formattedFormInitials}_${nextCount}.${fileExtension}`;
        finalSystemName = systemName;

        const formsCollectionRef = collection(db, 'forms');
        const newFormDocRef = doc(formsCollectionRef);

        transaction.set(newFormDocRef, {
          id: newFormDocRef.id,
          originalName: file.name,
          systemName: systemName,
          cloudinaryUrl: secureUrl,
          comments: comments.trim(),
          uploaderId: auth.currentUser?.uid || 'manager-upload',
          uploaderInitials: formattedUploaderInitials,
          formInitials: formattedFormInitials,
          sequenceNumber: nextCount,
          createdAt: serverTimestamp(),
        });
      });

      // Add activity log
      try {
        await addDoc(collection(db, 'logs'), {
          action: 'Upload',
          performedBy: user?.name || user?.email || 'Manager',
          performedByRole: user?.role || 'Manager',
          details: `Manager uploaded file "${finalSystemName}" (Original: "${file.name}")`,
          createdAt: serverTimestamp()
        });
      } catch (logErr) {
        console.error('Failed to write activity log:', logErr);
      }

      setUploadSuccess('Form successfully uploaded, registered, and sequenced!');
      setFile(null);
      setFormInitials('');
      setComments('');

      fetchForms();
    } catch (err: any) {
      console.error('Upload flow error:', err);
      setUploadError(
        err.message || 'An unexpected error occurred during sequencing or upload.'
      );
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchForms();
    fetchTemplates();
  }, []);

  useEffect(() => {
    const published = templates.filter(t => t.published);
    if (published.length > 0) {
      const isStillValid = published.some(t => t.initials.toUpperCase() === formInitials.toUpperCase());
      if (!isStillValid) {
        setFormInitials(published[0].initials);
      }
    } else {
      setFormInitials('');
    }
  }, [templates, formInitials]);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    setTemplateFetchError(null);
    try {
      const q = query(collection(db, 'document_templates'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetched: DocumentTemplate[] = [];
      snapshot.forEach((doc) => {
        fetched.push(doc.data() as DocumentTemplate);
      });
      setTemplates(fetched);
    } catch (err: any) {
      const isPermissionDenied = err.code === 'permission-denied' || 
                                 (err.message && err.message.toLowerCase().includes('permission')) ||
                                 JSON.stringify(err).toLowerCase().includes('permission');
      
      console.error('Error fetching templates:', {
        error: err,
        code: err.code,
        message: err.message,
        isPermissionDenied,
        authUserId: user?.uid,
        authUserEmail: user?.email,
        path: 'document_templates'
      });

      if (isPermissionDenied) {
        setTemplateFetchError('Missing or insufficient database permissions to fetch form templates. Please verify your manager role authorization.');
      } else {
        setTemplateFetchError('An error occurred while fetching form requirements: ' + (err.message || err));
      }
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handlePublishTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateInitials.trim()) {
      setTemplateError('Please enter a Form Name and Form Initials.');
      return;
    }
    const cleanInitials = templateInitials.trim().toUpperCase();
    if (cleanInitials.length < 2 || cleanInitials.length > 4) {
      setTemplateError('Form Initials must be between 2 and 4 characters.');
      return;
    }

    setTemplatePublishing(true);
    setTemplateError(null);
    setTemplateSuccess(null);

    try {
      const templateId = 'temp_' + Math.random().toString(36).substring(2, 11);
      const templateDocRef = doc(db, 'document_templates', templateId);

      await runTransaction(db, async (transaction) => {
        transaction.set(templateDocRef, {
          id: templateId,
          name: templateName.trim(),
          initials: cleanInitials,
          description: templateDescription.trim(),
          published: true,
          createdAt: serverTimestamp(),
          creatorId: user?.uid || 'unknown_manager',
          creatorName: user?.name || 'Manager',
        });
      });

      setTemplateSuccess(`Successfully published new form template: ${cleanInitials}`);
      setTemplateName('');
      setTemplateInitials('');
      setTemplateDescription('');
      fetchTemplates();
    } catch (err: any) {
      console.error('Error publishing template:', err);
      setTemplateError(err.message || 'Failed to publish form template.');
    } finally {
      setTemplatePublishing(false);
    }
  };

  const handleTogglePublish = async (template: DocumentTemplate) => {
    if (!template.published) {
      // Start 2-stage confirmation flow instead of toggling directly
      setTemplateToPublish(template);
      setPublishStage(1);
      return;
    }

    // Unpublishing is direct
    try {
      const templateDocRef = doc(db, 'document_templates', template.id);
      await runTransaction(db, async (transaction) => {
        transaction.update(templateDocRef, {
          published: false
        });
      });
      fetchTemplates();
    } catch (err) {
      console.error('Error unpublishing template:', err);
    }
  };

  // Click handler for Edit icon
  const handleEditClick = (template: DocumentTemplate) => {
    if (template.published) {
      setTemplateToUnpublishAndEdit(template);
      setIsUnpublishConfirmOpen(true);
    } else {
      openEditModal(template);
    }
  };

  // Prepares states for editing template
  const openEditModal = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditInitials(template.initials);
    setEditDescription(template.description || '');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  // Confirms unpublishing to begin editing
  const handleConfirmUnpublishAndEdit = async () => {
    if (!templateToUnpublishAndEdit) return;
    try {
      const templateDocRef = doc(db, 'document_templates', templateToUnpublishAndEdit.id);
      await runTransaction(db, async (transaction) => {
        transaction.update(templateDocRef, {
          published: false
        });
      });
      setIsUnpublishConfirmOpen(false);
      openEditModal(templateToUnpublishAndEdit);
      setTemplateToUnpublishAndEdit(null);
      fetchTemplates();
    } catch (err: any) {
      console.error('Error unpublishing for edit:', err);
      alert('Failed to unpublish: ' + err.message);
    }
  };

  // Saves updated template fields to Firestore
  const handleSaveEdit = async () => {
    if (!editingTemplate) return;
    if (!editName.trim() || !editInitials.trim()) {
      setEditError('Please enter a Form Name and Form Initials.');
      return;
    }
    const cleanInitials = editInitials.trim().toUpperCase();
    if (cleanInitials.length < 2 || cleanInitials.length > 4) {
      setEditError('Form Initials must be between 2 and 4 characters.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const templateDocRef = doc(db, 'document_templates', editingTemplate.id);
      await runTransaction(db, async (transaction) => {
        transaction.update(templateDocRef, {
          name: editName.trim(),
          initials: cleanInitials,
          description: editDescription.trim(),
        });
      });

      setIsEditModalOpen(false);
      setEditingTemplate(null);
      setSuccess(`Form requirement "${cleanInitials}" was successfully updated.`);
      fetchTemplates();
    } catch (err: any) {
      console.error('Error saving edits:', err);
      setEditError(err.message || 'Failed to update requirement.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Final Stage 2 publish activation
  const handleFinalPublish = async () => {
    if (!templateToPublish) return;
    setIsPublishingThroughStages(true);
    try {
      const templateDocRef = doc(db, 'document_templates', templateToPublish.id);
      await runTransaction(db, async (transaction) => {
        transaction.update(templateDocRef, {
          published: true
        });
      });
      setSuccess(`Form requirement "${templateToPublish.initials}" is now published and active!`);
      setPublishStage(0);
      setTemplateToPublish(null);
      fetchTemplates();
    } catch (err: any) {
      console.error('Error during final publish:', err);
      alert('Publishing failed: ' + err.message);
    } finally {
      setIsPublishingThroughStages(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirmDeleteId !== templateId) {
      setConfirmDeleteId(templateId);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    try {
      const templateDocRef = doc(db, 'document_templates', templateId);
      await runTransaction(db, async (transaction) => {
        transaction.delete(templateDocRef);
      });
      setConfirmDeleteId(null);
      fetchTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  const fetchForms = async () => {
    setLoading(true);
    setFormFetchError(null);
    try {
      const q = query(collection(db, 'forms'), orderBy('sequenceNumber', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedForms: FormRecord[] = [];
      snapshot.forEach((doc) => {
        fetchedForms.push(doc.data() as FormRecord);
      });
      setForms(fetchedForms);
    } catch (err: any) {
      const isPermissionDenied = err.code === 'permission-denied' || 
                                 (err.message && err.message.toLowerCase().includes('permission')) ||
                                 JSON.stringify(err).toLowerCase().includes('permission');
      
      console.error('Error fetching forms:', {
        error: err,
        code: err.code,
        message: err.message,
        isPermissionDenied,
        authUserId: user?.uid,
        authUserEmail: user?.email,
        path: 'forms'
      });

      if (isPermissionDenied) {
        setFormFetchError('Missing or insufficient database permissions to fetch form records. Please verify your manager role authorization.');
      } else {
        setFormFetchError('An error occurred while fetching forms: ' + (err.message || err));
      }
    } finally {
      setLoading(false);
    }
  };

  // Selection toggle handlers
  const toggleSelectForm = (id: string) => {
    const nextSelected = new Set(selectedFormIds);
    if (nextSelected.has(id)) {
      nextSelected.delete(id);
    } else {
      nextSelected.add(id);
    }
    setSelectedFormIds(nextSelected);
  };

  const selectFilteredAll = (filteredForms: FormRecord[]) => {
    const nextSelected = new Set(selectedFormIds);
    const allFilteredSelected = filteredForms.every(f => selectedFormIds.has(f.id));

    if (allFilteredSelected) {
      filteredForms.forEach(f => nextSelected.delete(f.id));
    } else {
      filteredForms.forEach(f => nextSelected.add(f.id));
    }
    setSelectedFormIds(nextSelected);
  };

  // Open edit comments modal
  const startEditComment = (form: FormRecord) => {
    setEditingForm(form);
    setNewComment(form.comments);
    setError(null);
    setSuccess(null);
  };

  // Save updated comments
  const handleSaveComment = async () => {
    if (!editingForm) return;

    setSavingComment(true);
    setError(null);
    setSuccess(null);

    try {
      // Write directly to Firestore!
      await updateDoc(doc(db, 'forms', editingForm.id), {
        comments: newComment || ''
      });

      // Update local state
      setForms(
        forms.map((f) =>
          f.id === editingForm.id ? { ...f, comments: newComment } : f
        )
      );

      setSuccess(`Comment for "${editingForm.systemName}" updated successfully.`);
      setEditingForm(null);
    } catch (err: any) {
      console.error('Error saving comment:', err);
      setError(err.message || 'Could not update comment.');
    } finally {
      setSavingComment(false);
    }
  };

  // Archive / unarchive individual forms
  const handleToggleArchive = async (formId: string, currentArchivedState: boolean) => {
    try {
      const formDocRef = doc(db, 'forms', formId);
      await updateDoc(formDocRef, {
        archived: !currentArchivedState
      });
      
      const formObj = forms.find((f) => f.id === formId);
      const docName = formObj ? (formObj.systemName || formObj.originalName) : formId;

      // Add activity log
      try {
        await addDoc(collection(db, 'logs'), {
          action: !currentArchivedState ? 'Archive' : 'Restore',
          performedBy: user?.name || user?.email || 'Manager',
          performedByRole: user?.role || 'Manager',
          details: `${!currentArchivedState ? 'Archived' : 'restored to active'} document "${docName}"`,
          createdAt: serverTimestamp()
        });
      } catch (logErr) {
        console.error('Failed to write activity log:', logErr);
      }

      // Update local state
      setForms(
        forms.map((f) =>
          f.id === formId ? { ...f, archived: !currentArchivedState } : f
        )
      );
      
      setSuccess(`Document successfully ${!currentArchivedState ? 'archived' : 'restored to active'}.`);
    } catch (err: any) {
      console.error('Error toggling archive status:', err);
      setError('Could not update archive status in Firestore.');
    }
  };

  // Start delete process (Stage 1)
  const startDeleteForm = (form: FormRecord) => {
    setFormToDelete(form);
    setDeleteStage(1);
    setDeleteConfirmText('');
    setError(null);
    setSuccess(null);
  };

  // Perform actual deletion (Stage 3 execution)
  const executeDeleteForm = async () => {
    if (!formToDelete) return;
    if (deleteConfirmText !== 'delete files') {
      setError("Authorization text does not match 'delete files'.");
      return;
    }

    setIsDeletingForm(true);
    setError(null);
    setSuccess(null);

    try {
      const formDocRef = doc(db, 'forms', formToDelete.id);
      await deleteDoc(formDocRef);

      // Add activity log
      try {
        await addDoc(collection(db, 'logs'), {
          action: 'Delete',
          performedBy: user?.name || user?.email || 'Manager',
          performedByRole: user?.role || 'Manager',
          details: `Permanently deleted document "${formToDelete.systemName}" (Original: "${formToDelete.originalName}")`,
          createdAt: serverTimestamp()
        });
      } catch (logErr) {
        console.error('Failed to write activity log:', logErr);
      }

      setSuccess(`Document "${formToDelete.systemName}" was permanently deleted.`);
      
      // Update local state
      setForms(forms.filter((f) => f.id !== formToDelete.id));
      
      // Remove from selection state if present
      const nextSelected = new Set(selectedFormIds);
      nextSelected.delete(formToDelete.id);
      setSelectedFormIds(nextSelected);

      // Close modal
      setFormToDelete(null);
      setDeleteStage(0);
      setDeleteConfirmText('');
    } catch (err: any) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document: ' + err.message);
    } finally {
      setIsDeletingForm(false);
    }
  };

  // Compile ZIP and download
  const handleCompileZip = async () => {
    if (selectedFormIds.size === 0) return;

    setCompilingZip(true);
    setCompilationProgress('Initializing compilation directory...');
    setError(null);
    setSuccess(null);

    try {
      const zip = new JSZip();
      const formsToZip = forms.filter((f) => selectedFormIds.has(f.id));

      let processedCount = 0;
      for (const form of formsToZip) {
        processedCount++;
        setCompilationProgress(
          `Downloading and preparing ${processedCount} of ${formsToZip.length}: ${form.systemName}...`
        );

        try {
          // Cloudinary permits CORS for public gets, but to download as blob, we request directly
          const response = await fetch(form.cloudinaryUrl, {
            referrerPolicy: "no-referrer"
          });
          if (!response.ok) {
            throw new Error(`HTTP status ${response.status}`);
          }
          const blob = await response.blob();
          
          // Add the file to JSZip directory using its formal system-assigned name
          zip.file(form.systemName, blob);
        } catch (fetchErr) {
          console.error(`Failed to download ${form.systemName}:`, fetchErr);
          // If direct download fails (e.g. CORS or offline), let's create a backup text record to prevent failing entire ZIP
          zip.file(
            `DOWNLOAD_ERROR_${form.systemName}.txt`,
            `Could not download original asset. Cloud Url: ${form.cloudinaryUrl}`
          );
        }
      }

      setCompilationProgress('Building ZIP folder compressions client-side...');
      const content = await zip.generateAsync({ type: 'blob' });

      // Create download link
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `Forms_Compilation_${dateStr}.zip`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Add activity log
      try {
        const fileNames = formsToZip.map((f) => f.systemName).join(', ');
        await addDoc(collection(db, 'logs'), {
          action: 'Download',
          performedBy: user?.name || user?.email || 'Manager',
          performedByRole: user?.role || 'Manager',
          details: `Compiled and downloaded ZIP containing ${formsToZip.length} forms: [${fileNames}]`,
          createdAt: serverTimestamp()
        });
      } catch (logErr) {
        console.error('Failed to write activity log:', logErr);
      }

      setSuccess(`Successfully compiled and downloaded archive containing ${formsToZip.length} forms!`);
      setDownloadedFormIds(formsToZip.map((f) => f.id));
      setShowArchivePrompt(true);
      setSelectedFormIds(new Set()); // Reset selections
    } catch (zipErr: any) {
      console.error('ZIP generation error:', zipErr);
      setError('Could not complete compilation archive. Please try again.');
    } finally {
      setCompilingZip(false);
      setCompilationProgress('');
    }
  };

  // Filter forms list
  const filteredForms = forms.filter((f) => {
    const text = searchQuery.toLowerCase();
    const matchesQuery =
      f.systemName.toLowerCase().includes(text) ||
      f.originalName.toLowerCase().includes(text) ||
      f.uploaderInitials.toLowerCase().includes(text) ||
      f.comments.toLowerCase().includes(text) ||
      f.formInitials.toLowerCase().includes(text);

    const matchesUploader =
      !selectedUploaderFilter ||
      f.uploaderInitials.toUpperCase() === selectedUploaderFilter.toUpperCase();

    const matchesForm =
      !selectedFormFilter ||
      f.formInitials.toUpperCase() === selectedFormFilter.toUpperCase();

    const matchesArchive =
      viewTab === 'archived' ? !!f.archived : !f.archived;

    return matchesQuery && matchesUploader && matchesForm && matchesArchive;
  });

  // Extract unique uploaders initials for filters
  const uniqueUploaders = Array.from(
    new Set(forms.map((f) => f.uploaderInitials.toUpperCase()))
  ).sort();

  // Extract unique form initials for filters
  const uniqueForms = Array.from(
    new Set(forms.map((f) => f.formInitials.toUpperCase()))
  ).sort();

  // Paginated calculations
  const totalPages = Math.ceil(filteredForms.length / itemsPerPage);
  const paginatedForms = filteredForms.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatTimestamp = (ts: any) => {
    if (!ts) return '';
    // Handle both Firestore timestamp object and JS Date
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Introduction Header */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 text-white rounded-2xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">Manager Compilation Console</h1>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            Search, sort, filter, edit comments, and compile multiple uploaded files into single-click downloaded ZIP directories.
          </p>
        </div>
        
        {/* Actions panel */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={fetchForms}
            className="flex items-center justify-center p-2.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 border border-zinc-800/80 rounded-xl transition-colors cursor-pointer"
            title="Refresh Database"
            disabled={loading || compilingZip}
          >
            <RefreshCw className={`w-4.5 h-4.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleCompileZip}
            disabled={selectedFormIds.size === 0 || compilingZip}
            className={`flex items-center space-x-2 px-5 py-2.5 font-bold rounded-xl text-sm transition-all shadow-lg flex-1 sm:flex-none justify-center cursor-pointer ${
              selectedFormIds.size === 0
                ? 'bg-zinc-900/40 text-zinc-600 cursor-not-allowed border border-zinc-800/50'
                : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-indigo-600/15 hover:shadow-indigo-600/25'
            }`}
          >
            {compilingZip ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Compiling ZIP...</span>
              </>
            ) : (
              <>
                <FileArchive className="w-4 h-4" />
                <span>Compile & Download ZIP ({selectedFormIds.size})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress or status banners */}
      {compilingZip && (
        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/50 text-indigo-400 text-sm flex items-center space-x-3 animate-pulse">
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
          <div className="font-mono text-xs">
            <strong className="font-semibold text-indigo-300">Compiling ZIP Folder:</strong> {compilationProgress}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/25 border border-rose-900/50 text-rose-400 text-sm flex items-start space-x-2.5">
          <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-900/50 text-emerald-400 text-sm flex items-start space-x-2.5">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
          <span>{success}</span>
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
      {!templateFetchError && templates.filter(t => t.published).length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-500/10 text-indigo-400 p-1.5 rounded-lg border border-indigo-500/25">
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 font-mono">
              Published Form Requirements
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {templates.filter(t => t.published).map((temp) => {
              const isSelected = formInitials.toUpperCase() === temp.initials.toUpperCase();
              return (
                <div
                  key={temp.id}
                  onClick={() => {
                    setFormInitials(temp.initials);
                    // Scroll upload form into view smoothly
                    const uploadEl = document.getElementById('manager-upload-form');
                    if (uploadEl) {
                      uploadEl.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className={`group p-5 rounded-2xl border transition-all duration-200 cursor-pointer text-left relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-600/5'
                      : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/80 shadow-md'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-1 text-xs font-bold font-mono tracking-wider rounded-lg border ${
                          isSelected 
                            ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' 
                            : 'bg-zinc-950 border-zinc-800 text-indigo-400/90'
                        }`}>
                          {temp.initials}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(temp);
                          }}
                          className="p-1 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/40 transition-all cursor-pointer shadow-sm"
                          title="Edit form requirement"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-indigo-400 font-mono flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                          <span>Selected</span>
                        </span>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-zinc-100 text-sm tracking-wide group-hover:text-white transition-colors">
                        {temp.name}
                      </h3>
                      <p className="text-xs text-zinc-400 leading-relaxed mt-1.5 min-h-[36px] line-clamp-2">
                        {temp.description || 'No specific description provided by manager.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500 group-hover:text-zinc-400 transition-colors">
                    <span>By: {temp.creatorName}</span>
                    <span className="flex items-center text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">
                      Choose Form <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Sidebar Left Column containing stack of cards */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Deliver New Document Card (Manager Mode - Identical to Employee UI) */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-xl h-fit backdrop-blur-xs space-y-4">
            {(() => {
              const activeUploadTemplate = templates.find(t => t.initials.toUpperCase() === formInitials.toUpperCase()) || null;
              return (
                <div className="flex items-center space-x-2.5 pb-4 border-b border-zinc-800/80">
                  <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-lg border border-indigo-500/20">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-zinc-100 text-sm tracking-wide">
                      {formInitials ? `Deliver Form: ${formInitials.toUpperCase()}` : 'Deliver Document'}
                    </h2>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {activeUploadTemplate ? `Targeting: ${activeUploadTemplate.name}` : 'Select a published form requirement'}
                    </p>
                  </div>
                </div>
              );
            })()}

            {uploadError && (
              <div className="p-3.5 rounded-xl bg-rose-950/25 border border-rose-900/50 text-rose-400 text-xs flex items-start space-x-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-900/50 text-emerald-400 text-xs flex items-start space-x-2 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {templates.filter(t => t.published).length === 0 ? (
              <div className="p-5 text-center bg-zinc-950/60 rounded-xl border border-zinc-850 space-y-3">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="text-zinc-200 font-bold text-xs">Waiting for Manager Publication</h3>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  You can only submit documents for templates published by your manager. Please wait for a manager to publish a requirement.
                </p>
              </div>
            ) : (
              <form onSubmit={handleUploadSubmit} className="space-y-4" id="manager-upload-form">
                
                {/* Drag & Drop File Upload Stage */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 font-mono">
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
                        : 'border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900/30 hover:border-zinc-700'
                    }`}
                  >
                    <input
                      type="file"
                      id="manager-file-input"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={uploading}
                    />
                    
                    {file ? (
                      <div className="space-y-2">
                        <div className="mx-auto w-10 h-10 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-200 truncate max-w-[220px]">
                            {file.name}
                          </p>
                          <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="mx-auto w-10 h-10 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg flex items-center justify-center">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-300">
                            Drag & Drop or click to browse
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Supports PDF, PNG, JPG, DOCX up to 10MB
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Initials Input - choosing from published templates */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                      Select Published Form Type
                    </label>
                  </div>
                  
                  <select
                    required
                    value={formInitials}
                    onChange={(e) => setFormInitials(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm font-bold tracking-wider uppercase focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
                    disabled={uploading}
                  >
                    {templates.filter(t => t.published).map((temp) => (
                      <option key={temp.id} value={temp.initials} className="bg-zinc-950 text-zinc-200 font-mono text-xs">
                        {temp.initials} - {temp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Comments Field */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                    Comments (Optional)
                  </label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Provide details about the document contents..."
                    rows={3}
                    className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600 resize-none"
                    disabled={uploading}
                  />
                </div>

                {/* Immutability Disclaimer */}
                <div className="p-3 bg-rose-950/15 border border-rose-900/30 rounded-xl text-xs text-rose-400/90 leading-relaxed font-sans">
                  <strong>Immutability Clause:</strong> Once submitted, files are immediately integrated into the sequence tracking. They cannot be modified or deleted by your account.
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 flex items-center justify-center space-x-2 cursor-pointer mt-2"
                >
                  {uploading ? (
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

          {/* Publish Document Requirements Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 shadow-xl h-fit backdrop-blur-xs space-y-4">
            <div className="flex items-center space-x-2.5 pb-3.5 border-b border-zinc-800/80">
              <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-lg border border-indigo-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-100 text-sm tracking-wide">Publish Form Requirement</h2>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Set allowed employee uploads</p>
              </div>
            </div>

            {templateError && (
              <div className="p-3 rounded-xl bg-rose-950/25 border border-rose-900/50 text-rose-400 text-xs flex items-start space-x-2 leading-relaxed font-sans">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{templateError}</span>
              </div>
            )}

            {templateSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-900/50 text-emerald-400 text-xs flex items-start space-x-2 leading-relaxed font-sans">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{templateSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePublishTemplate} className="space-y-3" id="template-publish-form">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Form Name
                </label>
                <input
                  type="text"
                  required
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Authority to Deduct"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-sans placeholder:text-zinc-600"
                  disabled={templatePublishing}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Form Initials
                </label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={templateInitials}
                  onChange={(e) => setTemplateInitials(e.target.value)}
                  placeholder="e.g. ATD"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none font-bold tracking-wider uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono placeholder:text-zinc-600"
                  disabled={templatePublishing}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Description / Purpose
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="e.g. Required for payroll deduction authorization."
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600 leading-relaxed resize-none font-sans"
                  disabled={templatePublishing}
                />
              </div>

              <button
                type="submit"
                disabled={templatePublishing}
                className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-lg text-xs transition-all shadow-lg hover:shadow-indigo-600/25 flex items-center justify-center space-x-2 cursor-pointer"
              >
                {templatePublishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Publish Requirement</span>
                  </>
                )}
              </button>
            </form>

            {/* Active Templates list section */}
            <div className="pt-3.5 border-t border-zinc-800/80 space-y-2.5">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                Published Requirements ({templates.length})
              </h3>

              {loadingTemplates && templates.length === 0 ? (
                <div className="py-4 flex justify-center text-zinc-500 text-[11px] font-mono">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500 mr-2" />
                  Loading...
                </div>
              ) : templates.length === 0 ? (
                <div className="py-3 text-center text-zinc-500 text-[11px] bg-zinc-950/40 rounded-lg border border-zinc-800/50">
                  No published requirements.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {templates.map((temp) => (
                    <div key={temp.id} className="flex items-center justify-between p-2.5 bg-zinc-950/50 rounded-xl border border-zinc-850 hover:border-zinc-800 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="px-1.5 py-0.5 bg-zinc-850 text-indigo-400 rounded-md text-[10px] font-bold font-mono tracking-wider">
                            {temp.initials}
                          </span>
                          <h4 className="text-[11px] font-bold text-zinc-200 truncate">{temp.name}</h4>
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">{temp.description || 'No description'}</p>
                      </div>

                      <div className="flex items-center space-x-1 ml-2 shrink-0">
                        {/* Edit button */}
                        <button
                          onClick={() => handleEditClick(temp)}
                          className="p-1 rounded-lg border border-zinc-850 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer"
                          title="Edit requirement"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>

                        {/* Toggle status */}
                        <button
                          onClick={() => handleTogglePublish(temp)}
                          className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                            temp.published 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-850'
                          }`}
                          title={temp.published ? 'Published (Click to unpublish)' : 'Unpublished (Click to publish)'}
                        >
                          {temp.published ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteTemplate(temp.id)}
                          className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                            confirmDeleteId === temp.id
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 font-bold text-[9px] px-1.5'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-rose-400 hover:border-rose-500/30'
                          }`}
                          title="Delete template"
                        >
                          {confirmDeleteId === temp.id ? '?' : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Manager table/filters side column */}
        <div className="lg:col-span-3 space-y-6">

          {/* Active / Archived Document Tabs */}
          <div className="flex border-b border-zinc-800/80">
            <button
              onClick={() => { setViewTab('active'); setCurrentPage(1); }}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
                viewTab === 'active'
                  ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Active Documents ({forms.filter(f => !f.archived).length})</span>
            </button>
            <button
              onClick={() => { setViewTab('archived'); setCurrentPage(1); }}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
                viewTab === 'archived'
                  ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileArchive className="w-4 h-4" />
              <span>Archived Documents ({forms.filter(f => !!f.archived).length})</span>
            </button>
          </div>

              {/* Filters and search box */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Search */}
            <div className="md:col-span-2 relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
                <Search className="w-4.5 h-4.5" />
              </span>
              <input
                type="text"
                placeholder="Search files by system name, initials, original name, comments..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600"
              />
            </div>

            {/* Uploader Initials dropdown */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
                <Filter className="w-4 h-4" />
              </span>
              <select
                value={selectedUploaderFilter}
                onChange={(e) => {
                  setSelectedUploaderFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl text-zinc-300 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer appearance-none"
              >
                <option value="">Uploader (All)</option>
                {uniqueUploaders.map((init) => (
                  <option key={init} value={init}>
                    Uploader: {init}
                  </option>
                ))}
              </select>
            </div>

            {/* Form Initials dropdown */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
                <Layers className="w-4 h-4" />
              </span>
              <select
                value={selectedFormFilter}
                onChange={(e) => {
                  setSelectedFormFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl text-zinc-300 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer appearance-none"
              >
                <option value="">Form (All)</option>
                {uniqueForms.map((init) => (
                  <option key={init} value={init}>
                    Form: {init}
                  </option>
                ))}
              </select>
            </div>

          </div>

      {/* Datatable Card */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-xs">
        
        {formFetchError && (
          <div className="p-4 bg-red-950/20 border-b border-red-900/50 text-red-400 text-xs flex items-start space-x-3 leading-relaxed font-mono">
            <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong>Authorization Error:</strong> {formFetchError}
              <div className="mt-2">
                <button 
                  onClick={fetchForms}
                  className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Retry Loading Forms
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {!formFetchError && loading && forms.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-500 space-y-2 font-mono">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Retrieving files from Firestore database...</span>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-500 px-6 text-center">
              <FileText className="w-12 h-12 text-zinc-700 mb-2" />
              <span className="text-sm font-semibold text-zinc-300">No Document Entries Found</span>
              <p className="text-xs text-zinc-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                No uploaded forms match your search queries or filter settings. Try adjusting search queries.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-zinc-900/70 border-b border-zinc-800/80 text-zinc-500 font-bold text-[11px] uppercase tracking-widest font-mono">
                  <th className="py-3.5 px-4 w-12 text-center">
                    <button
                      onClick={() => selectFilteredAll(filteredForms)}
                      className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors inline-flex cursor-pointer border border-transparent hover:border-zinc-700 bg-zinc-950/40"
                      title="Select all filtered"
                    >
                      {filteredForms.every(f => selectedFormIds.has(f.id)) ? (
                        <CheckSquare className="w-4.5 h-4.5 text-indigo-400" />
                      ) : (
                        <Square className="w-4.5 h-4.5" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 w-16 text-center">Seq #</th>
                  <th className="py-3.5 px-4">System File Identifier</th>
                  <th className="py-3.5 px-4">Uploader Initials</th>
                  <th className="py-3.5 px-4">Original File Details</th>
                  <th className="py-3.5 px-4 max-w-xs">Comments & Notes</th>
                  <th className="py-3.5 px-4">Upload Timestamp</th>
                  <th className="py-3.5 px-4 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {paginatedForms.map((form) => {
                  const isSelected = selectedFormIds.has(form.id);
                  return (
                    <tr
                      key={form.id}
                      className={`hover:bg-zinc-800/25 transition-colors ${
                        isSelected ? 'bg-indigo-950/15 border-l border-indigo-500/80' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => toggleSelectForm(form.id)}
                          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors inline-flex cursor-pointer border border-transparent hover:border-zinc-700 bg-zinc-950/40"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4.5 h-4.5 text-indigo-400" />
                          ) : (
                            <Square className="w-4.5 h-4.5" />
                          )}
                        </button>
                      </td>

                      {/* Sequence Number */}
                      <td className="py-4 px-4 text-center font-mono font-bold text-zinc-500 text-xs">
                        #{form.sequenceNumber}
                      </td>

                      {/* System File Name & Cloudinary Link */}
                      <td className="py-4 px-4">
                        <a
                          href={form.cloudinaryUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono font-bold text-indigo-400 hover:text-indigo-300 hover:underline text-sm flex items-center space-x-1.5"
                        >
                          <span>{form.systemName}</span>
                        </a>
                      </td>

                      {/* Uploader badge */}
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-1.5">
                          <div className="w-6 h-6 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300 font-bold text-[10px] flex items-center justify-center uppercase font-mono shadow-inner">
                            {form.uploaderInitials}
                          </div>
                          <span className="text-xs text-zinc-400 font-medium font-sans">
                            Form: <span className="font-bold text-zinc-300">{form.formInitials}</span>
                          </span>
                        </div>
                      </td>

                      {/* Original details */}
                      <td className="py-4 px-4">
                        <span className="text-xs text-zinc-400 block max-w-[180px] truncate" title={form.originalName}>
                          {form.originalName}
                        </span>
                      </td>

                      {/* Comments */}
                      <td className="py-4 px-4 max-w-xs">
                        <div className="text-xs text-zinc-300 leading-relaxed break-words font-sans">
                          {form.comments ? (
                            form.comments
                          ) : (
                            <span className="text-zinc-600 italic">No notes written</span>
                          )}
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="py-4 px-4 text-xs text-zinc-500 font-mono">
                        {formatTimestamp(form.createdAt)}
                      </td>

                      {/* Action Menu */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => startEditComment(form)}
                            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-indigo-400 transition-colors cursor-pointer border border-zinc-800 bg-zinc-950/40"
                            title="Edit Comment"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleArchive(form.id, !!form.archived)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer bg-zinc-950/40 ${
                              form.archived
                                ? 'border-emerald-800 text-emerald-400 hover:bg-emerald-950/20 hover:text-emerald-300'
                                : 'border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30'
                            }`}
                            title={form.archived ? "Restore to Active" : "Archive Document"}
                          >
                            {form.archived ? (
                              <RefreshCw className="w-3.5 h-3.5" />
                            ) : (
                              <FileArchive className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => startDeleteForm(form)}
                            className="p-1.5 hover:bg-red-950/40 rounded-lg text-zinc-400 hover:text-red-400 hover:border-red-500/30 border border-zinc-800 bg-zinc-950/40 transition-colors cursor-pointer"
                            title="Delete Document permanently (Triple-Check)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="bg-zinc-900/40 px-6 py-4 border-t border-zinc-800/80 flex items-center justify-between">
            <div className="text-xs text-zinc-500 font-semibold font-sans">
              Showing page <strong className="text-zinc-300 font-bold font-mono">{currentPage}</strong> of <strong className="text-zinc-300 font-bold font-mono">{totalPages}</strong> ({filteredForms.length} total matched forms)
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

        </div>
      </div>

      {/* Edit comment dialog */}
      {editingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl w-full max-w-lg space-y-4">
            <div>
              <h3 className="text-base font-bold text-zinc-100 font-sans">Update Form Comments</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Modifying sequence metadata for: <code className="font-mono font-bold text-indigo-400">{editingForm.systemName}</code>
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                Comment & Delivery Notes
              </label>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={4}
                className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600 resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-zinc-800/80">
              <button
                onClick={() => setEditingForm(null)}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 rounded-xl text-sm transition-colors cursor-pointer"
                disabled={savingComment}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveComment}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all flex items-center space-x-1.5 cursor-pointer"
                disabled={savingComment}
              >
                {savingComment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unpublish & Edit confirmation dialog */}
      {isUnpublishConfirmOpen && templateToUnpublishAndEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl w-full max-w-md space-y-4 text-left">
            <div className="flex items-start space-x-3">
              <div className="bg-amber-500/10 text-amber-400 p-2 rounded-lg border border-amber-500/20 shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100 font-sans">Unpublish Required to Edit</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  The form requirement <span className="font-semibold text-zinc-200">"{templateToUnpublishAndEdit.name}" ({templateToUnpublishAndEdit.initials})</span> is currently published and active.
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-850">
              To edit details (including initials or description), this requirement must be unpublished first. Unpublishing will temporarily hide this form type from employee selection dashboards.
            </p>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                onClick={() => {
                  setIsUnpublishConfirmOpen(false);
                  setTemplateToUnpublishAndEdit(null);
                }}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-zinc-400 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnpublishAndEdit}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-600/10 hover:shadow-amber-600/25 transition-all cursor-pointer"
              >
                Yes, Unpublish & Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form Requirement Dialog */}
      {isEditModalOpen && editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl w-full max-w-md space-y-4 text-left">
            <div>
              <h3 className="text-base font-bold text-zinc-100 font-sans">Edit Form Requirement</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Modify parameters for: <code className="font-mono font-bold text-indigo-400">{editingTemplate.initials}</code>
              </p>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-rose-950/25 border border-rose-900/50 text-rose-400 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Form Name / Category
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Bin Card Form"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Form Initials (2-4 characters)
                </label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={editInitials}
                  onChange={(e) => setEditInitials(e.target.value)}
                  placeholder="e.g. BC"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none text-left font-bold tracking-wider uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Description / Instructions
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Instructions for employee upload..."
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600 resize-none font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-zinc-800/80">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-zinc-400 rounded-xl text-xs transition-colors cursor-pointer"
                disabled={isSavingEdit}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all flex items-center space-x-1.5 cursor-pointer"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Edits</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2-Stage Publication Confirmation Dialog */}
      {publishStage > 0 && templateToPublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl w-full max-w-md space-y-4 text-left">
            
            {publishStage === 1 ? (
              <>
                <div className="flex items-start space-x-3">
                  <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-lg border border-indigo-500/20 shrink-0 mt-0.5">
                    <Layers className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 font-sans">Stage 1 of 2: Prepare Publication</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Initiating official activation for requirement: <span className="text-zinc-200 font-semibold">{templateToPublish.name}</span>
                    </p>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 leading-relaxed bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-850 space-y-2">
                  <p>
                    You are publishing this form template to the live portal. Once published, employees will see this requirement as a selectable form category on their dashboards.
                  </p>
                  <p className="text-[11px] text-indigo-400 font-mono">
                    • Template Name: {templateToPublish.name}<br />
                    • Designated Initials: {templateToPublish.initials}
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2.5 pt-2">
                  <button
                    onClick={() => {
                      setPublishStage(0);
                      setTemplateToPublish(null);
                    }}
                    className="px-4 py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-zinc-400 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setPublishStage(2)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <span>Proceed to Stage 2</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start space-x-3">
                  <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg border border-emerald-500/20 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 font-sans text-emerald-400">Stage 2 of 2: Sequence Key Authorization</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Authorize immutable identifier sequence
                    </p>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 leading-relaxed bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-850 space-y-2.5">
                  <p>
                    Please double check that the Form Initials <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-emerald-400 font-mono font-bold tracking-wider">{templateToPublish.initials}</span> are correct.
                  </p>
                  <p className="text-[11px] text-zinc-500 italic">
                    Submissions will register with the format <span className="font-mono text-zinc-400 font-normal">{templateToPublish.initials}_[Sequence].pdf</span>. Sequence drift or editing initials after submissions begin may disrupt integrity reports.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setPublishStage(1)}
                    className="px-3 py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-zinc-400 rounded-xl text-xs transition-all flex items-center space-x-1 cursor-pointer font-sans font-medium"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back to Stage 1</span>
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setPublishStage(0);
                        setTemplateToPublish(null);
                      }}
                      className="px-3.5 py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-zinc-500 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFinalPublish}
                      disabled={isPublishingThroughStages}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/15 hover:shadow-emerald-600/25 transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      {isPublishingThroughStages ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Publishing...</span>
                        </>
                      ) : (
                        <span>Authorize & Publish</span>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* Archive Downloaded Forms Dialog */}
      {showArchivePrompt && downloadedFormIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl w-full max-w-md space-y-4 text-left">
            <div className="flex items-start space-x-3">
              <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-lg border border-indigo-500/20 shrink-0 mt-0.5">
                <FileArchive className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100 font-sans">Archive Compiled Documents?</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  You successfully compiled and downloaded <span className="text-zinc-200 font-semibold">{downloadedFormIds.length}</span> documents.
                </p>
              </div>
            </div>

            <div className="text-xs text-zinc-400 leading-relaxed bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-850 space-y-2">
              <p>
                Would you like to archive these compiled documents now?
              </p>
              <p className="text-[11px] text-zinc-500 italic">
                Archived documents are hidden from your main "Active Documents" list but remain fully safe and accessible anytime from the "Archived Documents" view.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                onClick={() => {
                  setShowArchivePrompt(false);
                  setDownloadedFormIds([]);
                }}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-855 border border-zinc-850 text-zinc-400 rounded-xl text-xs transition-colors cursor-pointer"
              >
                No, Keep Active
              </button>
              <button
                onClick={async () => {
                  try {
                    setShowArchivePrompt(false);
                    setLoading(true);
                    
                    const archivedForms = forms.filter((f) => downloadedFormIds.includes(f.id));
                    const fileNames = archivedForms.map((f) => f.systemName).join(', ');

                    await Promise.all(
                      downloadedFormIds.map((id) =>
                        updateDoc(doc(db, 'forms', id), { archived: true })
                      )
                    );

                    // Add activity log
                    try {
                      await addDoc(collection(db, 'logs'), {
                        action: 'Archive',
                        performedBy: user?.name || user?.email || 'Manager',
                        performedByRole: user?.role || 'Manager',
                        details: `Archived ${downloadedFormIds.length} compiled documents after download: [${fileNames}]`,
                        createdAt: serverTimestamp()
                      });
                    } catch (logErr) {
                      console.error('Failed to write activity log:', logErr);
                    }

                    setSuccess(`Successfully archived ${downloadedFormIds.length} compiled forms!`);
                    setDownloadedFormIds([]);
                    fetchForms();
                  } catch (err: any) {
                    console.error('Error archiving downloaded forms:', err);
                    setError('Archiving failed: ' + err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Yes, Archive Them</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Deletion Triple-Check Dialog */}
      {deleteStage > 0 && formToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-900 border border-red-900/30 rounded-2xl p-6 shadow-2xl w-full max-w-md space-y-4 text-left animate-in fade-in-50 zoom-in-95 duration-150">
            
            {/* STAGE 1: Confirm Permanent Deletion */}
            {deleteStage === 1 && (
              <>
                <div className="flex items-start space-x-3">
                  <div className="bg-red-500/10 text-red-400 p-2.5 rounded-xl border border-red-500/20 shrink-0 mt-0.5">
                    <Trash2 className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 font-sans">Delete Document - Stage 1 of 3</h3>
                    <p className="text-xs text-red-400 font-semibold mt-1">Warning: Destructive action</p>
                  </div>
                </div>

                <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/50 p-4 rounded-xl border border-zinc-850 space-y-2">
                  <p>
                    Are you sure you want to delete <span className="text-zinc-100 font-bold font-mono text-[11px] bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{formToDelete.systemName || formToDelete.systemFileName}</span>?
                  </p>
                  <p className="text-zinc-400">
                    This will permanently delete the document from the database. It cannot be recovered.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2.5 pt-2">
                  <button
                    onClick={() => {
                      setDeleteStage(0);
                      setFormToDelete(null);
                    }}
                    className="px-4 py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-zinc-400 rounded-xl text-xs transition-colors cursor-pointer font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeleteStage(2)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-600/15 hover:shadow-red-600/25 transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <span>Yes, Continue to Stage 2</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}

            {/* STAGE 2: Triple Check Warning */}
            {deleteStage === 2 && (
              <>
                <div className="flex items-start space-x-3">
                  <div className="bg-amber-500/10 text-amber-400 p-2.5 rounded-xl border border-amber-500/20 shrink-0 mt-0.5">
                    <AlertCircle className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 font-sans">Double Check - Stage 2 of 3</h3>
                    <p className="text-xs text-amber-400 font-semibold mt-1">Confirming cascading consequences</p>
                  </div>
                </div>

                <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/50 p-4 rounded-xl border border-zinc-850 space-y-2">
                  <p className="text-amber-300 font-medium">
                    Please consider carefully before proceeding:
                  </p>
                  <p className="text-zinc-400">
                    Deleting this document will remove it from all compile filters, search results, and manager reviews. No employee or manager will ever be able to access it again.
                  </p>
                  <p className="text-zinc-500 italic text-[11px]">
                    Are you absolutely positive you want to destroy this document?
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2.5 pt-2">
                  <button
                    onClick={() => {
                      setDeleteStage(0);
                      setFormToDelete(null);
                    }}
                    className="px-4 py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-zinc-400 rounded-xl text-xs transition-colors cursor-pointer font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeleteStage(3)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-600/15 hover:shadow-amber-600/25 transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <span>Yes, I Am Certain</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}

            {/* STAGE 3: Type Confirm Text */}
            {deleteStage === 3 && (
              <>
                <div className="flex items-start space-x-3">
                  <div className="bg-red-500/15 text-red-500 p-2.5 rounded-xl border border-red-500/30 shrink-0 mt-0.5">
                    <Trash2 className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 font-sans">Final Verification - Stage 3 of 3</h3>
                    <p className="text-xs text-red-500 font-semibold mt-1">Authorization required</p>
                  </div>
                </div>

                <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/50 p-4 rounded-xl border border-zinc-850 space-y-3">
                  <p>
                    To finalize the deletion of <span className="font-semibold text-zinc-100 font-mono text-[11px]">{formToDelete.systemName || formToDelete.systemFileName}</span>, please type <strong className="text-red-400 select-all font-mono font-bold bg-red-950/30 px-1 py-0.5 rounded border border-red-900/30">delete files</strong> in the field below:
                  </p>
                  
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type 'delete files' here"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all font-mono placeholder:text-zinc-600"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end space-x-2.5 pt-2">
                  <button
                    onClick={() => {
                      setDeleteStage(0);
                      setFormToDelete(null);
                    }}
                    className="px-4 py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-zinc-400 rounded-xl text-xs transition-colors cursor-pointer font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeDeleteForm}
                    disabled={deleteConfirmText !== 'delete files' || isDeletingForm}
                    className={`px-4 py-2 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 cursor-pointer ${
                      deleteConfirmText === 'delete files' && !isDeletingForm
                        ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/15 hover:shadow-red-600/25 animate-pulse'
                        : 'bg-zinc-800 text-zinc-500 border border-zinc-850 cursor-not-allowed'
                    }`}
                  >
                    {isDeletingForm ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Permanently Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
