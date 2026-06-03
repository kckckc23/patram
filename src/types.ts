export interface PdfDocFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  loading: boolean;
  error?: string;
}

export type ActiveTab = 'merge' | 'split' | 'delete' | 'compress' | 'ocr' | 'organize' | 'converter';

export interface OperationLog {
  id: string;
  timestamp: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
