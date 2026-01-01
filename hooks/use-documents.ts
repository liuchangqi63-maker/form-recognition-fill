import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Document, TableData } from '@/shared/types';

const STORAGE_KEY = 'smart_table_documents';

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  // Load documents from storage
  const loadDocuments = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setDocuments(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save documents to storage
  const saveDocuments = useCallback(async (docs: Document[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to save documents:', error);
    }
  }, []);

  // Create a new document
  const createDocument = useCallback(async (
    title: string,
    tableData: TableData,
    description?: string
  ): Promise<Document> => {
    const now = new Date().toISOString();
    const newDoc: Document = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      tableData,
      createdAt: now,
      updatedAt: now,
    };
    
    const newDocs = [newDoc, ...documents];
    await saveDocuments(newDocs);
    return newDoc;
  }, [documents, saveDocuments]);

  // Update a document
  const updateDocument = useCallback(async (
    id: string,
    updates: Partial<Pick<Document, 'title' | 'description' | 'tableData'>>
  ): Promise<Document | null> => {
    const index = documents.findIndex(doc => doc.id === id);
    if (index === -1) return null;

    const updatedDoc: Document = {
      ...documents[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const newDocs = [...documents];
    newDocs[index] = updatedDoc;
    await saveDocuments(newDocs);
    return updatedDoc;
  }, [documents, saveDocuments]);

  // Delete a document
  const deleteDocument = useCallback(async (id: string): Promise<boolean> => {
    const newDocs = documents.filter(doc => doc.id !== id);
    if (newDocs.length === documents.length) return false;
    
    await saveDocuments(newDocs);
    return true;
  }, [documents, saveDocuments]);

  // Get a single document by ID
  const getDocument = useCallback((id: string): Document | undefined => {
    return documents.find(doc => doc.id === id);
  }, [documents]);

  // Initial load
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return {
    documents,
    loading,
    createDocument,
    updateDocument,
    deleteDocument,
    getDocument,
    refreshDocuments: loadDocuments,
  };
}
