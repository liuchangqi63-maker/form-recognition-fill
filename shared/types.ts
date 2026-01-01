/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// Document types
export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  tableData: TableData;
  createdAt: string;
  updatedAt: string;
}

// AI Message types
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// API Request/Response types
export interface RecognizeTableRequest {
  imageBase64: string;
  description?: string;
}

export interface RecognizeTableResponse {
  tableData: TableData;
  title?: string;
}

export interface SearchAndFillRequest {
  tableData: TableData;
  instruction: string;
}

export interface SearchAndFillResponse {
  tableData: TableData;
  searchSummary?: string;
}

export interface ModifyTableRequest {
  tableData: TableData;
  instruction: string;
}

export interface ModifyTableResponse {
  tableData: TableData;
  explanation?: string;
}
